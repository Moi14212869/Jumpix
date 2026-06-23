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
  collection, getDocs, query, orderBy, limit
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
  bestRanks:       {}
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
// CORRECTION : le document initial inclut le pseudo Auth pour
// que le pseudo Auth soit disponible immédiatement.
export async function loadPlayerData() {
  const ref = playerRef();
  if (!ref) return { ...DEFAULTS }; // invité → défauts en mémoire

  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const user = getCurrentUser();
    const initialData = {
      ...DEFAULTS,
      pseudo: user?.displayName || "" // ← préserve le pseudo Auth dès la création
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

// ── Raccourcis ────────────────────────────────────────────
export const save = {
  volume:        v      => saveFields({ gameVolume: v }),
  keyboard:      v      => saveFields({ keyboardLayout: v }),
  coins:         v      => saveFields({ playerCoins: v }),
  dead:          v      => saveFields({ dead: v }),
  kill:          v      => saveFields({ kill: v }),
  party:         v      => saveFields({ party: v }),
  color:         v      => saveFields({ colorPlayer: v }),
  pseudo:        v      => saveFields({ pseudo: v }),
  skin:   (key, v)      => saveFields({ [`skins.${key}`]: v }),
  level:     (key)       => saveFields({ [`completedLevels.${key}`]: true }),
  bestTime:  (key, ms)   => saveFields({ [`bestTimes.${key}`]: ms }),
  bestRank:  (key, rank) => saveFields({ [`bestRanks.${key}`]: rank }),
};

// ── Vérifier si un skin est débloqué ─────────────────────
export function skinOwned(playerData, key) {
  return !!(playerData.skins && playerData.skins[key]);
}

// ── Ghost run (meilleure trajectoire) ────────────────────
// Structure Firestore : players/{uid}/ghostRuns/{levelKey}
//   { timeMs, frames: [{x, y, angle}] }

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

export async function saveLeaderboard(levelKey, timeMs) {
  const user = getCurrentUser();
  if (!user) return null; // invité → pas de classement

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

  // Calculer le rang actuel (après écriture)
  const entriesRef = collection(db, "leaderboards", levelKey, "entries");
  const q          = query(entriesRef, orderBy("timeMs", "asc"), limit(100));
  const allSnap    = await getDocs(q);
  const rank       = allSnap.docs.findIndex(d => d.id === user.uid) + 1;
  return rank > 0 ? rank : null;
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
