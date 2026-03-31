import { db } from "../firebase/db.js";
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function deleteAsset(id) {
    await deleteDoc(doc(db, "assets", id));
}

export async function deleteLiability(id) {
    await deleteDoc(doc(db, "liabilities", id));
}
export async function addAsset(profileId, name, value, rate, type, endDate) {
    await addDoc(collection(db, "assets"), {
        profileId,
        name,
        value: Number(value),
        rate: rate ? Number(rate) : null,
        type,
        endDate,
        createdAt: new Date()
    });
}

export async function addLiability(profileId, name, value, rate, endDate) {
    await addDoc(collection(db, "liabilities"), {
        profileId,
        name,
        value: Number(value),
        rate: rate ? Number(rate) : null,
        endDate,
        createdAt: new Date()
    });
}

export async function getAssets(profileId) {
    const q = query(collection(db, "assets"), where("profileId", "==", profileId));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({
    id: doc.id,        // 🔥 REQUIRED
    ...doc.data()
}));
}

export async function getLiabilities(profileId) {
    const q = query(collection(db, "liabilities"), where("profileId", "==", profileId));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({
    id: doc.id,        // 🔥 REQUIRED
    ...doc.data()
}));
}