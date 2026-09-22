// =========================================================
//               DB — COUCHE D'ACCÈS FIRESTORE
// =========================================================
// La progression n'est sauvegardée que si l'utilisateur
// est connecté (compte email). Les invités jouent en local
// (variables en mémoire seulement, pas de persistance).
// =========================================================

import { db, getCurrentUser } from "./firebase.js";
import {
  doc, getDoc, setDoc, updateDoc,
  collection, getDocs, query, orderBy, limit, where,
  increment, deleteField
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export const DEFAULTS = {
  gameVolume:      0.5,
  keyboardLayout:  "zqsd",
  playerCoins:     0,
  dead:            0,
  kill:            0,
  party:           0,
  colorPlayer:     0xAA66CC,
  pseudo:          "",
  skins:           {},
  completedLevels: {},
  bestTimes:       {},
  bestRanks:       {},
  levelPoints:     {}, // points gagnés par niveau pour le classement global (voir recomputeLevelPoints)
  totalPoints:     0   // somme de levelPoints, utilisé pour trier le classement global
};

// ── Barème de points du classement global ─────────────────
// Attribué au top 10 de chaque niveau (classement par temps, avec le
// même départage par "party" que loadLeaderboard/saveLeaderboard).
const RANK_POINTS = { 1: 15, 2: 13, 3: 10, 4: 8, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1 };

// ── Liste des niveaux (utilisée pour parcourir tous les
//    classements lors d'une migration ou d'une mise à jour) ──
const ALL_LEVELS = [
  "Level1","Level2","Level3","Level4","Level5",
  "Level6","Level7","Level8","Level9","Level10","Level11","Level12",
  "Level13","Level14","Level15","Level16","Level17","Level18"
];


// ── Référence document du joueur connecté ────────────────
function playerRef() {
  const user = getCurrentUser();
  if (!user) return null;
  return doc(db, "players", user.uid);
}

// ── Indique si l'utilisateur est connecté ─────────────────
export function isLoggedIn() {
  return getCurrentUser() !== null;
}

// ── Vérifie si un pseudo est déjà pris ────────────────────
// Retourne true si un autre joueur utilise déjà ce pseudo.
// La comparaison est insensible à la casse pour éviter "Mario" / "mario".
export async function isPseudoTaken(pseudo) {
  const normalized = pseudo.trim().toLowerCase();
  const q = query(
    collection(db, "players"),
    where("pseudoLower", "==", normalized),
    limit(1)
  );
  const snap = await getDocs(q);
  // Exclure le joueur actuel (cas du changement de pseudo)
  const currentUid = getCurrentUser()?.uid;
  return snap.docs.some(d => d.id !== currentUid);
}

// ── Pseudonyme affiché ────────────────────────────────────
export function getPseudo() {
  const user = getCurrentUser();
  if (!user) return null;
  // Compte email : utiliser le displayName Firebase
  if (!user.isAnonymous) return user.displayName || null;
  // Compte anonyme : le pseudo est stocké dans localStorage
  return localStorage.getItem("jumpix_pseudo") || null;
}

// ── Charger la progression depuis Firestore ───────────────
export async function loadPlayerData() {
  const ref = playerRef();
  if (!ref) return { ...DEFAULTS }; // invité → défauts en mémoire

  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const user = getCurrentUser();
    const initialData = {
      ...DEFAULTS,
      pseudo: user?.displayName || "",
      pseudoLower: (user?.displayName || "").toLowerCase()
    };
    await setDoc(ref, initialData);
    return { ...initialData };
  }
  return { ...DEFAULTS, ...snap.data() };
}

// ── Sauvegarder des champs (no-op si invité) ─────────────
export async function saveFields(fields) {
  const ref = playerRef();
  if (!ref) return; // invité : pas de sauvegarde
  await updateDoc(ref, fields);
}

// ── Migration des données d'un ancien compte invité ──────
// Quand un joueur invité se connecte à un autre compte email puis se
// déconnecte, Firebase ne peut pas "rouvrir" son ancien uid anonyme :
// signInAnonymously() en créerait un tout nouveau, vide. Pour éviter de
// perdre sa progression, on copie les données de l'ANCIEN uid invité
// (stocké côté localStorage) vers le NOUVEAU uid invité, une seule fois.
//
// On migre :
//   - le document players/{uid} (coins, skins, progression…)
//   - les entrées leaderboards/{level}/entries/{uid} pour chaque niveau
//     (sinon les anciens records restent associés à l'ancien uid et ne
//     sont plus reconnus comme "les miens" → plus de surlignage doré)
//   - les ghost runs players/{uid}/ghostRuns/{level}
//
// Retourne true si une migration du document principal a eu lieu.
export async function migrateGuestData(oldUid, newUid) {
  if (!oldUid || oldUid === newUid) return false;

  const oldRef  = doc(db, "players", oldUid);
  const oldSnap = await getDoc(oldRef);
  if (!oldSnap.exists()) return false; // rien à migrer

  const newRef  = doc(db, "players", newUid);
  const newSnap = await getDoc(newRef);
  // Ne pas écraser des données déjà présentes sur le nouveau compte
  if (newSnap.exists()) return false;

  await setDoc(newRef, oldSnap.data());

  // ── Migrer les entrées de classement (best-effort, ne bloque pas
  //    la migration principale si ça échoue niveau par niveau) ──
  await Promise.all(ALL_LEVELS.map(async levelKey => {
    try {
      const oldEntryRef = doc(db, "leaderboards", levelKey, "entries", oldUid);
      const oldEntrySnap = await getDoc(oldEntryRef);
      if (!oldEntrySnap.exists()) return;

      const newEntryRef = doc(db, "leaderboards", levelKey, "entries", newUid);
      const newEntrySnap = await getDoc(newEntryRef);
      if (newEntrySnap.exists()) return; // ne pas écraser un record existant

      await setDoc(newEntryRef, oldEntrySnap.data());
    } catch (err) {
      console.warn(`Leaderboard entry migration failed for ${levelKey}:`, err);
    }
  }));

  // ── Migrer les ghost runs ──
  await Promise.all(ALL_LEVELS.map(async levelKey => {
    try {
      const oldGhostRef = doc(db, "players", oldUid, "ghostRuns", levelKey);
      const oldGhostSnap = await getDoc(oldGhostRef);
      if (!oldGhostSnap.exists()) return;

      const newGhostRef = doc(db, "players", newUid, "ghostRuns", levelKey);
      const newGhostSnap = await getDoc(newGhostRef);
      if (newGhostSnap.exists()) return;

      await setDoc(newGhostRef, oldGhostSnap.data());
    } catch (err) {
      console.warn(`Ghost run migration failed for ${levelKey}:`, err);
    }
  }));

  return true;
}

// ── Raccourcis ────────────────────────────────────────────
export const save = {
  volume:        v      => saveFields({ gameVolume: v }),
  keyboard:      v      => saveFields({ keyboardLayout: v }),
  coins:         v      => saveFields({ playerCoins: v }),
  dead:          v      => saveFields({ dead: v }),
  kill:          v      => saveFields({ kill: v }),
  party:         v      => saveFields({ party: v }),
  color:         v      => saveFields({ colorPlayer: v }),
  pseudo:        v      => saveFields({ pseudo: v, pseudoLower: v.trim().toLowerCase() }),
  skin:   (key, v)      => saveFields({ [`skins.${key}`]: v }),
  level:     (key)       => saveFields({ [`completedLevels.${key}`]: true }),
  bestTime:  (key, ms)   => saveFields({ [`bestTimes.${key}`]: ms }),
  bestRank:  (key, rank) => saveFields({ [`bestRanks.${key}`]: rank }),
};

// ── Vérifier si un skin est débloqué ─────────────────────
export function skinOwned(playerData, key) {
  return !!(playerData.skins && playerData.skins[key]);
}



export async function saveGhostRun(levelKey, timeMs, frames) {
  const user = getCurrentUser();
  if (!user) return;

  // N'écrire que si c'est un nouveau record
  const ghostRef = doc(db, "players", user.uid, "ghostRuns", levelKey);
  const snap     = await getDoc(ghostRef);
  if (snap.exists() && snap.data().timeMs <= timeMs) return; // pas mieux

  await setDoc(ghostRef, { timeMs, frames });
}

export async function loadGhostRun(levelKey) {
  const user = getCurrentUser();
  if (!user) return null;

  const ghostRef = doc(db, "players", user.uid, "ghostRuns", levelKey);
  const snap     = await getDoc(ghostRef);
  return snap.exists() ? snap.data() : null;
}
export async function resetAccount() {
  const ref = playerRef();
  if (!ref) return;
  await setDoc(ref, DEFAULTS);
}

// ── Classement ───────────────────────────────────────────
// Structure Firestore : leaderboards/{levelKey}/entries/{uid}
//   { pseudo, colorPlayer, timeMs }

// ── Départage des égalités de temps par nombre de parties jouées ──
// À temps égal, le joueur avec le plus de "party" (parties jouées,
// cf. players/{uid}.party) est classé devant. Ce tri est recalculé
// à chaque lecture à partir des documents `players` actuels : rien
// n'est écrit dans les entrées de classement elles-mêmes, donc le
// départage s'applique automatiquement, y compris aux égalités déjà
// existantes avant ce changement.
async function sortEntriesWithTieBreak(entries) {
  // entries doit déjà être trié par timeMs croissant (requête Firestore)
  const result = [...entries];

  let i = 0;
  while (i < result.length) {
    let j = i;
    while (j < result.length && result[j].timeMs === result[i].timeMs) j++;

    if (j - i > 1) {
      const group = result.slice(i, j);
      const parties = await Promise.all(group.map(async entry => {
        const snap = await getDoc(doc(db, "players", entry.uid));
        return snap.exists() ? (snap.data().party ?? 0) : 0;
      }));
      const withParty = group.map((entry, idx) => ({ entry, party: parties[idx] }));
      // Plus de parties jouées = meilleur classement en cas d'égalité
      withParty.sort((a, b) => b.party - a.party);
      withParty.forEach(({ entry }, k) => { result[i + k] = entry; });
    }

    i = j;
  }

  return result;
}

// ── Recalcule les points du classement global pour un niveau ──
// Attribue les points du barème RANK_POINTS au top 10 actuel du niveau
// (sortedEntries, déjà départagé par party) et répercute la différence
// avec l'attribution précédente sur players/{uid}.totalPoints. On stocke
// l'attribution précédente dans leaderboards/{levelKey}.pointsAwarded
// pour savoir qui retirer du total si son rang a changé (ex: quelqu'un
// sorti du top 10, ou qui monte/descend dedans).
async function recomputeLevelPoints(levelKey, sortedEntries) {
  try {
    const top10 = sortedEntries.slice(0, 10);
    const newAwards = {};
    top10.forEach((entry, i) => { newAwards[entry.uid] = RANK_POINTS[i + 1]; });

    const levelRef  = doc(db, "leaderboards", levelKey);
    const levelSnap = await getDoc(levelRef);
    const oldAwards = levelSnap.exists() ? (levelSnap.data().pointsAwarded || {}) : {};

    const uids = new Set([...Object.keys(oldAwards), ...Object.keys(newAwards)]);

    await Promise.all([...uids].map(async uid => {
      const oldPts = oldAwards[uid] || 0;
      const newPts = newAwards[uid] || 0;
      if (oldPts === newPts) return; // pas de changement pour ce joueur

      try {
        await updateDoc(doc(db, "players", uid), {
          totalPoints: increment(newPts - oldPts),
          [`levelPoints.${levelKey}`]: newPts > 0 ? newPts : deleteField()
        });
      } catch (err) {
        console.warn(`Points update failed for ${uid} on ${levelKey}:`, err);
      }
    }));

    await setDoc(levelRef, { pointsAwarded: newAwards }, { merge: true });
  } catch (err) {
    // Ne jamais laisser un échec de calcul de points faire planter
    // saveLeaderboard() (et donc la sauvegarde du temps / du rang) :
    // on logue clairement l'erreur pour pouvoir la diagnostiquer
    // (souvent un problème de règles de sécurité Firestore).
    console.error(`recomputeLevelPoints failed for ${levelKey}:`, err);
  }
}

// ── Recalcul ponctuel des points sur TOUS les niveaux ─────
// Les points ne sont normalement recalculés qu'au moment où quelqu'un
// termine un niveau (voir saveLeaderboard). Les temps enregistrés AVANT
// l'ajout du système de points n'ont donc jamais déclenché ce calcul :
// leurs auteurs n'apparaissent pas dans le classement global tant que
// personne ne rejoue ces niveaux. Cette fonction parcourt tous les
// niveaux et applique le barème RANK_POINTS aux classements déjà en
// place, une bonne fois pour toutes. Sans danger à relancer plusieurs
// fois (idempotente : ne modifie que ce qui a réellement changé).
export async function backfillGlobalPoints() {
  for (const levelKey of ALL_LEVELS) {
    const sorted = await loadLeaderboard(levelKey);
    if (sorted.length > 0) await recomputeLevelPoints(levelKey, sorted);
  }
}

export async function saveLeaderboard(levelKey, timeMs) {
  const user = getCurrentUser();
  if (!user) return null; // invité → pas de classement

  const entryRef = doc(db, "leaderboards", levelKey, "entries", user.uid);
  const snap     = await getDoc(entryRef);

  // N'écrire que si c'est un nouveau record (ou première entrée)
  if (!snap.exists() || snap.data().timeMs > timeMs) {
    // user.displayName n'existe que pour les comptes email : un compte
    // anonyme Firebase n'a jamais de displayName. getPseudo() gère les
    // deux cas correctement (displayName pour email, localStorage pour
    // les invités), donc on s'en sert au lieu de lire user.displayName.
    await setDoc(entryRef, {
      pseudo:      getPseudo() || "Anonyme",
      colorPlayer: (await getDoc(playerRef()))?.data()?.colorPlayer ?? 0xAA66CC,
      timeMs
    });
  }

  // Calculer le rang actuel (après écriture), en départageant les
  // égalités de temps par nombre de parties jouées (voir sortEntriesWithTieBreak)
  const entriesRef = collection(db, "leaderboards", levelKey, "entries");
  const q          = query(entriesRef, orderBy("timeMs", "asc"), limit(100));
  const allSnap    = await getDocs(q);
  const entries    = allSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
  const sorted     = await sortEntriesWithTieBreak(entries);
  const rank       = sorted.findIndex(e => e.uid === user.uid) + 1;

  // Le rang ayant pu changer (nouveau temps, ou departage par party
  // recalculé), on met à jour les points du classement global en
  // conséquence à chaque appel — l'opération est sans effet si rien n'a
  // changé depuis le dernier calcul.
  await recomputeLevelPoints(levelKey, sorted);

  return rank > 0 ? rank : null;
}

// ── Classement global par points (voir RANK_POINTS) ───────
export async function loadGlobalLeaderboard() {
  const playersRef = collection(db, "players");
  const q          = query(playersRef, orderBy("totalPoints", "desc"), limit(100));
  const snap       = await getDocs(q);
  return snap.docs.map(d => ({
    uid:         d.id,
    pseudo:      d.data().pseudo || "Anonyme",
    colorPlayer: d.data().colorPlayer ?? 0xAA66CC,
    totalPoints: d.data().totalPoints ?? 0
  }));
}

export async function loadLeaderboard(levelKey) {
  const entriesRef = collection(db, "leaderboards", levelKey, "entries");
  const q          = query(entriesRef, orderBy("timeMs", "asc"), limit(100));
  const snap       = await getDocs(q);
  const entries    = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  return sortEntriesWithTieBreak(entries);
}

// ── Met à jour la couleur du joueur dans toutes ses entrées classement ──

export async function updateLeaderboardColor(colorPlayer) {
  const user = getCurrentUser();
  if (!user) return;

  await Promise.all(ALL_LEVELS.map(async levelKey => {
    const entryRef = doc(db, "leaderboards", levelKey, "entries", user.uid);
    const snap     = await getDoc(entryRef);
    if (snap.exists()) {
      await updateDoc(entryRef, { colorPlayer });
    }
  }));
}

// ── Met à jour le pseudo dans toutes les entrées classement existantes ──
// Utile quand un joueur anonyme dont les entrées disaient "Anonyme" (avant
// correctif) ou un joueur ayant changé de pseudo veut voir ses anciennes
// entrées de classement se mettre à jour sans attendre un nouveau record.
export async function updateLeaderboardPseudo(pseudo) {
  const user = getCurrentUser();
  if (!user) return;

  await Promise.all(ALL_LEVELS.map(async levelKey => {
    const entryRef = doc(db, "leaderboards", levelKey, "entries", user.uid);
    const snap     = await getDoc(entryRef);
    if (snap.exists()) {
      await updateDoc(entryRef, { pseudo });
    }
  }));
}
// ── Stats publiques d'un joueur (vue depuis le leaderboard) ──
export async function loadPublicPlayerStats(uid) {
  const ref  = doc(db, "players", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { ...DEFAULTS };
  return { ...DEFAULTS, ...snap.data() };
}
