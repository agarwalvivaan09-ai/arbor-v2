import { db } from "../firebase/db.js";
import { collection, addDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
export async function createAccount(profileId, name, type, subtype = null, rate = 0) {
    await addDoc(collection(db, "profiles", profileId, "accounts"), {
    name,
    type,
    subtype,
    rate,
    createdAt: new Date()
});
}

export async function getAccounts(profileId) {
    const snapshot = await getDocs(
        collection(db, "profiles", profileId, "accounts")
    );

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

import { doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";



export async function deleteAccount(accountId, profileId) {
    await deleteDoc(doc(db, "profiles", profileId, "accounts", accountId));
}