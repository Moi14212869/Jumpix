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
