// =========================================================
//               DB — COUCHE D'ACCÈS FIRESTORE
// =========================================================
// La progression n'est sauvegardée que si l'utilisateur
// est connecté (compte email). Les invités jouent en local
// (variables en mémoire seulement, pas de persistance).
// =========================================================

import { db, getCurrentUser } from "./firebase.js";
import {
  doc, getDoc, setDoc, updateDoc, deleteField,
  collection, getDocs, query, orderBy, limit, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export const DEFAULTS = {
  gameVolume:      0.5,
  keyboardLayout:  "zqsd",
  playerCoins:     0,
  dead:            0,
  kill:            0,
  party:           0,
  colorPlayer:     0xAA66CC,
  skins:           {},
  completedLevels: {},
  bestTimes:       {}
};

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

// ── Pseudonyme affiché ────────────────────────────────────
export function getPseudo() {
  const user = getCurrentUser();
  return user?.displayName || null;
}

// ── Charger la progression depuis Firestore ───────────────
// Retourne les données du joueur, ou les DEFAULTS si invité.
export async function loadPlayerData() {
  const ref = playerRef();
  if (!ref) return { ...DEFAULTS }; // invité → défauts en mémoire

  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, DEFAULTS);
    return { ...DEFAULTS };
  }
  return { ...DEFAULTS, ...snap.data() };
}

// ── Sauvegarder des champs (no-op si invité) ─────────────
export async function saveFields(fields) {
  const ref = playerRef();
  if (!ref) return; // invité : pas de sauvegarde
  await updateDoc(ref, fields);
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
  skin:   (key, v)      => saveFields({ [`skins.${key}`]: v }),
  level:     (key)    => saveFields({ [`completedLevels.${key}`]: true }),
  bestTime:  (key, ms) => saveFields({ [`bestTimes.${key}`]: ms }),
};

// ── Vérifier si un skin est débloqué ─────────────────────
export function skinOwned(playerData, key) {
  return !!(playerData.skins && playerData.skins[key]);
}

// ── Reset complet du compte ───────────────────────────────
export async function resetAccount() {
  const ref = playerRef();
  if (!ref) return;
  await setDoc(ref, DEFAULTS);
}

// ── Classement ───────────────────────────────────────────
// Structure Firestore : leaderboards/{levelKey}/entries/{uid}
//   { pseudo, colorPlayer, timeMs }

export async function saveLeaderboard(levelKey, timeMs) {
  const user = getCurrentUser();
  if (!user) return; // invité → pas de classement

  const entryRef = doc(db, "leaderboards", levelKey, "entries", user.uid);
  const snap     = await getDoc(entryRef);

  // N'écrire que si c'est un nouveau record (ou première entrée)
  if (!snap.exists() || snap.data().timeMs > timeMs) {
    await setDoc(entryRef, {
      pseudo:      user.displayName || "Anonyme",
      colorPlayer: (await getDoc(playerRef()))?.data()?.colorPlayer ?? 0xAA66CC,
      timeMs
    });
  }
}

export async function loadLeaderboard(levelKey) {
  const entriesRef = collection(db, "leaderboards", levelKey, "entries");
  const q          = query(entriesRef, orderBy("timeMs", "asc"), limit(100));
  const snap       = await getDocs(q);
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

// ── Met à jour la couleur du joueur dans toutes ses entrées classement ──
const ALL_LEVELS = [
  "Level1","Level2","Level3","Level4","Level5",
  "Level6","Level7","Level8","Level9"
];

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

// =========================================================
//                        AMIS
// =========================================================
// Structure Firestore :
//   players/{uid}.friends          = { [friendUid]: { pseudo, colorPlayer } }
//   players/{uid}.friendRequests   = { [fromUid]:   { pseudo, colorPlayer, status:"pending" } }
//   players/{uid}.settings         = { blockFriendRequests: bool }

// ── Chercher un joueur par pseudo (scan limité) ───────────
export async function findPlayerByPseudo(pseudo) {
  const pseudoLower = pseudo.trim().toLowerCase();
  // Firestore n'a pas de recherche insensible à la casse ; on compare côté client
  const snap = await getDocs(collection(db, "players"));
  for (const d of snap.docs) {
    const data = d.data();
    const name = (data.displayName || "").toLowerCase();
    // Firebase Auth stocke displayName dans Auth, pas forcément dans Firestore
    // On cherche donc via le pseudo enregistré dans le leaderboard (champ pseudo)
    // OU via un champ dédié si présent
    if (name === pseudoLower) {
      return { uid: d.id, pseudo: data.displayName, colorPlayer: data.colorPlayer ?? 0xAA66CC };
    }
  }
  // Fallback : chercher dans les entrées leaderboard (pseudo y est fiable)
  for (const lvl of ALL_LEVELS) {
    const entriesSnap = await getDocs(collection(db, "leaderboards", lvl, "entries"));
    for (const d of entriesSnap.docs) {
      const data = d.data();
      if ((data.pseudo || "").toLowerCase() === pseudoLower) {
        // Récupérer la couleur actuelle depuis le profil
        const playerSnap = await getDoc(doc(db, "players", d.id));
        const colorPlayer = playerSnap.exists()
          ? (playerSnap.data().colorPlayer ?? 0xAA66CC)
          : (data.colorPlayer ?? 0xAA66CC);
        return { uid: d.id, pseudo: data.pseudo, colorPlayer };
      }
    }
  }
  return null;
}

// ── Envoyer une demande d'ami ─────────────────────────────
export async function sendFriendRequest(targetUid, targetPseudo) {
  const user = getCurrentUser();
  if (!user) return { error: "not_logged_in" };
  if (targetUid === user.uid) return { error: "self" };

  const myRef = doc(db, "players", user.uid);
  const targetRef = doc(db, "players", targetUid);

  const [mySnap, targetSnap] = await Promise.all([getDoc(myRef), getDoc(targetRef)]);

  // Déjà amis ?
  if (mySnap.exists() && mySnap.data().friends?.[targetUid]) return { error: "already_friends" };

  // Demande déjà envoyée ?
  if (targetSnap.exists() && targetSnap.data().friendRequests?.[user.uid]?.status === "pending") {
    return { error: "already_sent" };
  }

  // Cible bloque les demandes ?
  if (targetSnap.exists() && targetSnap.data().settings?.blockFriendRequests) {
    return { error: "blocked" };
  }

  const myColorPlayer = mySnap.exists() ? (mySnap.data().colorPlayer ?? 0xAA66CC) : 0xAA66CC;

  await updateDoc(targetRef, {
    [`friendRequests.${user.uid}`]: {
      pseudo:      user.displayName || "Anonyme",
      colorPlayer: myColorPlayer,
      status:      "pending"
    }
  });

  return { ok: true };
}

// ── Accepter une demande ──────────────────────────────────
export async function acceptFriendRequest(fromUid, fromPseudo, fromColorPlayer) {
  const user = getCurrentUser();
  if (!user) return;

  const myRef   = doc(db, "players", user.uid);
  const fromRef = doc(db, "players", fromUid);

  const mySnap = await getDoc(myRef);
  const myColor = mySnap.exists() ? (mySnap.data().colorPlayer ?? 0xAA66CC) : 0xAA66CC;
  const myPseudo = user.displayName || "Anonyme";

  // Ajouter dans les deux sens + supprimer la demande
  await Promise.all([
    updateDoc(myRef, {
      [`friends.${fromUid}`]: { pseudo: fromPseudo, colorPlayer: fromColorPlayer },
      [`friendRequests.${fromUid}`]: deleteField()
    }),
    updateDoc(fromRef, {
      [`friends.${user.uid}`]: { pseudo: myPseudo, colorPlayer: myColor }
    })
  ]);
}

// ── Refuser / supprimer une demande ──────────────────────
export async function declineFriendRequest(fromUid) {
  const user = getCurrentUser();
  if (!user) return;
  await updateDoc(doc(db, "players", user.uid), {
    [`friendRequests.${fromUid}`]: deleteField()
  });
}

// ── Supprimer un ami ──────────────────────────────────────
export async function removeFriend(friendUid) {
  const user = getCurrentUser();
  if (!user) return;
  await Promise.all([
    updateDoc(doc(db, "players", user.uid),      { [`friends.${friendUid}`]: deleteField() }),
    updateDoc(doc(db, "players", friendUid),     { [`friends.${user.uid}`]:  deleteField() })
  ]);
}

// ── Charger le profil public d'un joueur ─────────────────
// Retourne : { pseudo, colorPlayer, playerCoins, dead, kill, party, bestTimes }
export async function loadFriendProfile(uid) {
  const snap = await getDoc(doc(db, "players", uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    pseudo:      d.displayName  ?? "Anonyme",
    colorPlayer: d.colorPlayer  ?? 0xAA66CC,
    playerCoins: d.playerCoins  ?? 0,
    dead:        d.dead         ?? 0,
    kill:        d.kill         ?? 0,
    party:       d.party        ?? 0,
    bestTimes:   d.bestTimes    ?? {}
  };
}

// ── Bloquer / débloquer les demandes d'ami ────────────────
export async function setBlockFriendRequests(value) {
  await saveFields({ "settings.blockFriendRequests": value });
}

export async function getBlockFriendRequests() {
  const ref = playerRef();
  if (!ref) return false;
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data().settings?.blockFriendRequests ?? false) : false;
}
