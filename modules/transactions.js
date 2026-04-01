import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "../firebase/db.js";
import { doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// DELETE TRANSACTION
export async function deleteTransaction(transactionId, profileId) {
    await deleteDoc(doc(db, "profiles", profileId, "transactions", transactionId));

    const transactions = await getTransactions(profileId);

    // SORT oldest → newest
    transactions.sort((a, b) => {
        const d = new Date(a.date) - new Date(b.date);
        if (d !== 0) return d;
        return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
    });

    // 🔥 RECOMPUTE BALANCES (WITH TRANSFER SUPPORT)
    let runningBalance = 0;

    for (const t of transactions) {
        if (t.type === "income") runningBalance += t.amount;
        else if (t.type === "expense") runningBalance -= t.amount;
        else if (t.type === "transfer") {
            if (t.from === "cash") runningBalance -= t.amount;
            if (t.to === "cash") runningBalance += t.amount;
        }

        await updateDoc(doc(db, "profiles", profileId, "transactions", t.id), {
            balance: runningBalance
        });
    }
}

// ADD TRANSACTION (NO BALANCE LOGIC)
export async function addTransaction(profileId, amount, type, category, date, from = null, to = null, linkedId = null) {
    const transactions = await getTransactions(profileId);

    const newTxn = {
    amount: Number(amount),
    type,
    category,
    date,
    from,
    to,
    accountId: linkedId?.accountId || null,
    assetId: linkedId?.assetId || null,
    subtype: linkedId?.subtype || null,
    createdAt: Date.now()
};

    const updated = [...transactions, newTxn];

    // SORT
    updated.sort((a, b) => {
        const d = new Date(a.date) - new Date(b.date);
        if (d !== 0) return d;
        return (a.createdAt || 0) - (b.createdAt || 0);
    });

    // 🔥 BALANCE ENGINE (UPDATED FOR TRANSFERS)
    let runningBalance = 0;

    for (const t of updated) {
        if (t.type === "income") runningBalance += t.amount;
        else if (t.type === "expense") runningBalance -= t.amount;
        else if (t.type === "transfer") {
            if (t.from === "cash") runningBalance -= t.amount;
            if (t.to === "cash") runningBalance += t.amount;
        }

        t.balance = runningBalance;
    }

    const finalTxn = updated[updated.length - 1];

   await addDoc(collection(db, "profiles", profileId, "transactions"), {
    profileId,
    amount: finalTxn.amount,
    type: finalTxn.type,
    category: finalTxn.category,
    date: finalTxn.date,
    accountId: finalTxn.accountId || null,
    assetId: finalTxn.assetId || null,
    subtype: finalTxn.subtype || null,
    from: finalTxn.from || null,
    to: finalTxn.to || null,
    balance: finalTxn.balance,
    createdAt: serverTimestamp()
});
    // UPDATE OLD TXNS
    const existing = updated.slice(0, -1);

// Run updates in parallel instead of sequential
await Promise.all(
    existing.map(t => {
        if (!t.id) return Promise.resolve();

        return updateDoc(
            doc(db, "profiles", profileId, "transactions", t.id),
            { balance: t.balance }
        );
    })
);
}

// GET TRANSACTIONS
export async function getTransactions(profileId) {
    const q = query(
        collection(db, "profiles", profileId, "transactions"),
        where("profileId", "==", profileId)
    );

    const snapshot = await getDocs(q);

    const transactions = [];

    snapshot.forEach(doc => {
        transactions.push({
            id: doc.id,
            ...doc.data()
        });
    });

    return transactions;
}