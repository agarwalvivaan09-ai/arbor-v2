import { db } from "../firebase/db.js";
import { collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// CREATE EMI
export async function createEMI(profileId, emiData) {
    await addDoc(collection(db, "profiles", profileId, "emis"), {
        ...emiData,
        remainingPrincipal: Number(emiData.principal || emiData.amount),
        createdAt: new Date()
    });
}

// GET EMIs
export async function getEMIs(profileId) {
    const snapshot = await getDocs(collection(db, "profiles", profileId, "emis"));

    return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        
}

import { doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// DELETE EMI

export async function deleteEMI(emiId, profileId) {
    await deleteDoc(doc(db, "profiles", profileId, "emis", emiId));
}