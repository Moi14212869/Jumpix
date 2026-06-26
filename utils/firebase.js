// =========================================================
//               FIREBASE — CONFIG & INIT
// =========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  linkWithCredential,
  EmailAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyC-4rJznjrmnnpGtzH3iYEXtwjtaSLWqSg",
  authDomain:        "jumpix-500b7.firebaseapp.com",
  projectId:         "jumpix-500b7",
  storageBucket:     "jumpix-500b7.firebasestorage.app",
  messagingSenderId: "581640767120",
  appId:             "1:581640767120:web:283f6f0ac21d1b642f3a15",
  measurementId:     "G-7XGDJYDMXC"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);

// ── Récupère l'utilisateur connecté (ou null) ─────────────
export function getCurrentUser() {
  return auth.currentUser;
}

// ── Attend que Firebase ait résolu l'état d'auth ──────────
// Utile au démarrage : Firebase prend un court instant
// pour restaurer la session depuis son cache local.
export function waitForAuthReady() {
  return new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, user => {
      unsub();
      resolve(user); // null si non connecté
    });
  });
}

// ── Inscription email + pseudo + mot de passe ─────────────
export async function registerWithEmail(email, password, pseudo) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: pseudo });
  return cred.user;
}

// ── Connexion email + mot de passe ────────────────────────
export async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// ── Connexion anonyme (invité avec uid Firebase) ──────────
// Crée un compte anonyme Firebase qui permet de sauvegarder
// la progression même sans email. Peut être lié à un email plus tard.
// On garde toujours une trace de l'uid invité en localStorage : c'est
// ce qui permet de retrouver/migrer sa progression après une déconnexion
// (voir logout() plus bas et migrateGuestData() dans db.js).
export async function signInAsGuest() {
  const cred = await signInAnonymously(auth);
  localStorage.setItem("jumpix_guest_uid", cred.user.uid);
  return cred.user;
}

// ── Récupère l'uid du dernier compte invité connu (ou null) ──
export function getStoredGuestUid() {
  return localStorage.getItem("jumpix_guest_uid") || null;
}

// ── Indique si l'utilisateur connecté est anonyme ─────────
export function isAnonymousUser() {
  return auth.currentUser?.isAnonymous ?? false;
}

// ── Lier un compte anonyme à un email/mot de passe ────────
// Convertit le compte anonyme en compte permanent sans perte de données.
// Retourne l'utilisateur lié (son uid reste le même).
export async function linkGuestToEmail(email, password, pseudo) {
  const user = auth.currentUser;
  if (!user || !user.isAnonymous) throw new Error("no-anonymous-user");

  const credential = EmailAuthProvider.credential(email, password);
  const result = await linkWithCredential(user, credential);
  await updateProfile(result.user, { displayName: pseudo });
  return result.user;
}

// ── Déconnexion ───────────────────────────────────────────
// Note : on NE supprime PAS jumpix_guest_uid ici. Il sert de point de
// repère pour retrouver/migrer la progression invité au prochain
// démarrage (voir LoadingScene.create()).
export async function logout() {
  await signOut(auth);
}

// ── Traduction des codes d'erreur Firebase en français ────
export function firebaseErrorMessage(code) {
  const messages = {
    "auth/email-already-in-use":   "Cette adresse e-mail est déjà utilisée.",
    "auth/invalid-email":          "Adresse e-mail invalide.",
    "auth/weak-password":          "Mot de passe trop faible (6 caractères min.).",
    "auth/user-not-found":         "Aucun compte trouvé avec cet e-mail.",
    "auth/wrong-password":         "Mot de passe incorrect.",
    "auth/invalid-credential":     "E-mail ou mot de passe incorrect.",
    "auth/too-many-requests":      "Trop de tentatives. Réessayez plus tard.",
    "auth/network-request-failed": "Erreur réseau. Vérifiez votre connexion.",
  };
  return messages[code] || "Une erreur est survenue. Réessayez.";
}

// ── English version, used by LoadingScene's login popup ──
export function firebaseErrorMessageEN(code) {
  const messages = {
    "auth/email-already-in-use":   "This email address is already in use.",
    "auth/invalid-email":          "Invalid email address.",
    "auth/weak-password":          "Password too weak (6 characters min.).",
    "auth/user-not-found":         "No account found with this email.",
    "auth/wrong-password":         "Incorrect password.",
    "auth/invalid-credential":     "Incorrect email or password.",
    "auth/too-many-requests":      "Too many attempts. Please try again later.",
    "auth/network-request-failed": "Network error. Please check your connection.",
  };
  return messages[code] || "An error occurred. Please try again.";
}
