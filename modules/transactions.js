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

function createdAtValue(createdAt) {
    if (!createdAt) return 0;
    if (typeof createdAt === "number") return createdAt;
    if (typeof createdAt.seconds === "number") return createdAt.seconds * 1000;
    return 0;
}

function applyTransactionToBalances(t, balances) {
    const acc = t.accountId || "default";
    const amount = Number(t.amount) || 0;

    if (balances[acc] === undefined) balances[acc] = 0;

    if (t.type === "income") balances[acc] += amount;
    else if (t.type === "expense") balances[acc] -= amount;
    else if (t.type === "asset_buy") balances[acc] -= amount;
    else if (t.type === "asset_sell") balances[acc] += amount;
    else if (t.type === "liability_add") balances[acc] += amount;
    else if (t.type === "liability_payment") balances[acc] -= amount;
    else if (t.type === "transfer") {
        if (t.from === "cash") balances[acc] -= amount;
        if (t.to === "cash") balances[acc] += amount;
    }

    t.balance = balances[acc];
}

async function getOpeningBalances(profileId) {
    const snapshot = await getDocs(collection(db, "profiles", profileId, "accounts"));
    const balances = {};

    snapshot.forEach(accountDoc => {
        const account = accountDoc.data();
        balances[accountDoc.id] = Number(account.openingBalance) || 0;
    });

    return balances;
}

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

    const runningBalances = await getOpeningBalances(profileId);

    for (const t of transactions) {
        applyTransactionToBalances(t, runningBalances);

        await updateDoc(doc(db, "profiles", profileId, "transactions", t.id), {
            balance: t.balance
        });
    }
}

// ADD TRANSACTION (NO BALANCE LOGIC)
export async function addTransaction(profileId, amount, type, category, date, from = null, to = null, linkedId = null) {
    const transactions = await getTransactions(profileId);
    const localId = `new-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const newTxn = {
    localId,
    amount: Number(amount),
    type,
    category,
    date,
    from,
    to,
    accountId: linkedId?.accountId || null,
    assetId: linkedId?.assetId || null,
    liabilityId: linkedId?.liabilityId || null,
    subtype: linkedId?.subtype || null,
    createdAt: Date.now()
};

    const updated = [...transactions, newTxn];

    // SORT
    updated.sort((a, b) => {
        const d = new Date(a.date) - new Date(b.date);
        if (d !== 0) return d;
        return createdAtValue(a.createdAt) - createdAtValue(b.createdAt);
    });

    // 🔥 BALANCE ENGINE (UPDATED FOR TRANSFERS)
    const runningBalances = await getOpeningBalances(profileId);

    for (const t of updated) {
        applyTransactionToBalances(t, runningBalances);
    }

    const finalTxn = updated.find(t => t.localId === localId);

   await addDoc(collection(db, "profiles", profileId, "transactions"), {
    profileId,
    amount: finalTxn.amount,
    type: finalTxn.type,
    category: finalTxn.category,
    date: finalTxn.date,

    assetId: linkedId?.assetId || null,
    liabilityId: linkedId?.liabilityId || null,
    accountId: linkedId?.accountId || null,
    subtype: linkedId?.subtype || null,

    balance: finalTxn.balance,
    createdAt: serverTimestamp()
});
    // UPDATE OLD TXNS
    const existing = updated.filter(t => t.id);

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
