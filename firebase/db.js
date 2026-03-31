import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDl-0tuobzAlbj448VUhsKs3oj5qOH9mc4",
  authDomain: "arbor-23130.firebaseapp.com",
  projectId: "arbor-23130",
  storageBucket: "arbor-23130.firebasestorage.app",
  messagingSenderId: "815056574993",
  appId: "1:815056574993:web:6edd2efd636f1494c1efb0"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);