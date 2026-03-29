import { 
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import app from "./firebase.js";

const auth = getAuth(app);

// SIGN UP
export async function signUp(email, password) {
  return await createUserWithEmailAndPassword(auth, email, password);
}

// LOGIN
export async function login(email, password) {
  return await signInWithEmailAndPassword(auth, email, password);
}

// RESET PASSWORD
export async function resetPassword(email) {
  return await sendPasswordResetEmail(auth, email);
}

// LOGOUT
export async function logout() {
  return await signOut(auth);
}

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export function observeAuth(callback) {
  onAuthStateChanged(auth, callback);
}