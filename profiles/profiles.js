import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "../firebase/db.js";

// CREATE PROFILE
export async function createProfile(userId, type, name) {
    return await addDoc(collection(db, "profiles"), {
        userId: userId,
        type: type,
        name: name,
        createdAt: new Date()
    });
}

// GET ALL PROFILES OF USER
export async function getProfiles(userId) {
    const q = query(
        collection(db, "profiles"),
        where("userId", "==", userId)
    );

    const snapshot = await getDocs(q);

    const profiles = [];

    snapshot.forEach(doc => {
        profiles.push({
            id: doc.id,
            ...doc.data()
        });
    });

    return profiles;
}