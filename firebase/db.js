import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

const app = getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApp();

export const db = getFirestore(app);
export { app };