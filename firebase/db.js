import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import app from "./firebase.js";

export const db = getFirestore(app);