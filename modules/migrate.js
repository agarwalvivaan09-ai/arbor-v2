import { getTransactions } from "./transactions.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "../firebase/db.js";

export async function migrateBalances(profileId) {
    const transactions = await getTransactions(profileId);

    // sort oldest → newest
    transactions.sort((a, b) => {
        const d = new Date(a.date) - new Date(b.date);
        if (d !== 0) return d;
        return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
    });

    let runningBalance = 0;

    for (const t of transactions) {
        runningBalance += t.type === "income"
            ? t.amount
            : -t.amount;

        // write back to Firestore
        await updateDoc(doc(db, "transactions", t.id), {
            balance: runningBalance
        });
    }

    console.log("✅ Migration complete");
}