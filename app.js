import { signUp, login, resetPassword, observeAuth, logout } from "/firebase/auth.js";
import { createProfile, getProfiles } from "./profiles/profiles.js";
import { addTransaction, getTransactions } from "./modules/transactions.js";
import { addAsset, addLiability, getAssets, getLiabilities } from "./modules/networth.js";
import { deleteTransaction } from "./modules/transactions.js";
import { deleteAsset } from "./modules/networth.js";
import { deleteLiability } from "./modules/networth.js";

// ==========================
// MAIN ROUTER
// ==========================

async function renderApp(user) {
    const selectedProfile = localStorage.getItem("selectedProfile");

    if (selectedProfile) {
        await renderDashboard(user, selectedProfile);
    } else {
        await renderProfiles(user);
    }
}


// ==========================
// PROFILE SCREEN
// ==========================

async function renderProfiles(user) {
    const profiles = await getProfiles(user.uid);

    let selectedType = "personal";

    document.body.innerHTML = `
    <div class="container">
      <div class="card">

        <h1>Arbor</h1>
        <p>${user.email}</p>

        <div class="profiles-grid">
          ${profiles.length === 0 
    ? "<p>No profiles yet</p>"
    : profiles.map(p => `
            <div class="profile-card" data-id="${p.id}">
                <div class="profile-icon">${p.name ? p.name[0].toUpperCase() : "P"}</div>
                <div class="profile-name">${p.name}</div>
                <div class="profile-sub">${p.type}</div>
            </div>
          `).join("")}
        </div>

        <h2>Create Profile</h2>

        <input id="profileName" placeholder="Profile Name" />

        <div class="select">
          <button id="personalBtn" class="active">Personal</button>
          <button id="businessBtn">Business</button>
          <button id="familyBtn">Family</button>
        </div>

        <button id="createProfile" class="primary">Create</button>
        <button id="logout" class="secondary">Logout</button>

      </div>
    </div>
    `;






    // profile type toggle
    ["personal","business","family"].forEach(type => {
        document.getElementById(type+"Btn").onclick = () => {
            selectedType = type;
            document.querySelectorAll(".select button").forEach(b => b.classList.remove("active"));
            document.getElementById(type+"Btn").classList.add("active");
        };
    });

    // click profile
    document.querySelectorAll(".profile-card").forEach(card => {
        card.onclick = () => {
    console.log("Clicked profile:", card.dataset.id);

    localStorage.setItem("selectedProfile", card.dataset.id);
    renderApp(user);
};
    });

    // create profile
    document.getElementById("createProfile").onclick = async () => {
        const name = document.getElementById("profileName").value.trim();

if (!name) {
    alert("Enter profile name");
    return;
}
        await createProfile(user.uid, selectedType, name);
        renderApp(user); // 🔥 no reload
    };

    document.getElementById("logout").onclick = async () => {
        await logout();
    };
    // COLLAPSIBLE SECTIONS
document.querySelectorAll(".section h2").forEach(header => {
    header.onclick = () => {
        const section = header.parentElement;
        section.classList.toggle("collapsed");
    };
});
}

let isGlobalHandlerAttached = false;
// ==========================
// DASHBOARD
// ==========================

async function renderDashboard(user, profileId) {

    console.log("Rendering dashboard for:", profileId);
const assets = await getAssets(profileId);
const liabilities = await getLiabilities(profileId);
const allTransactions = await getTransactions(profileId);
function calculateAssetValue(a) {
    if (!a.startDate) return a.value;

    const start = new Date(a.startDate);
    const today = new Date();

    if (start > today) return 0;

    let years = (today - start) / (1000 * 60 * 60 * 24 * 365);

    if (a.endDate) {
        const end = new Date(a.endDate);
        if (today > end) {
            years = (end - start) / (1000 * 60 * 60 * 24 * 365);
        }
    }

    const rate = a.rate ? a.rate : 5; // default 5%

    const direction = a.type === "depreciating" ? -1 : 1;

if (a.compounding === "compound") {
    return a.value * Math.pow(1 + direction * rate / 100, years);
} else {
    return a.value * (1 + direction * (rate / 100) * years);
}
}

function calculateLiabilityValue(l) {
    if (!l.startDate) return l.value;

    const start = new Date(l.startDate);
    const today = new Date();

    if (start > today) return 0;

    let years = (today - start) / (1000 * 60 * 60 * 24 * 365);

    if (l.endDate) {
        const end = new Date(l.endDate);
        if (today > end) {
            years = (end - start) / (1000 * 60 * 60 * 24 * 365);
        }
    }

    const rate = l.rate ? l.rate : 8; // default loan rate

   if (l.type === "compound") {
    return l.value * Math.pow(1 + rate / 100, years);
} else {
    return l.value * (1 + (rate / 100) * years);
}
}

let adjustedAssets = 0;

assets.forEach(a => {
    const base = calculateAssetValue(a);

    const transferImpact = allTransactions
        .filter(t => t.type === "transfer" && t.linkedId === a.id)
        .reduce((sum, t) => {
            if (t.to === "asset") return sum + t.amount;
            if (t.from === "asset") return sum - t.amount;
            return sum;
        }, 0);

    adjustedAssets += base + transferImpact;
});

let adjustedLiabilities = 0;

liabilities.forEach(l => {
    let value = calculateLiabilityValue(l);

    allTransactions.forEach(t => {
        if (t.type === "transfer" && t.linkedId === l.id) {
    if (t.from === "liability") value += t.amount;
    if (t.to === "liability") value -= t.amount;
}
    });

    adjustedLiabilities += value;
});
const netWorth = adjustedAssets - adjustedLiabilities;

  


const selectedMonth = localStorage.getItem("selectedMonth");

let transactions = [...allTransactions];

if (selectedMonth) {
    transactions = allTransactions.filter(t => {
        if (!t.date) return false;

const txnDate = new Date(t.date);
if (isNaN(txnDate)) return false;

const txnMonth = txnDate.toISOString().slice(0, 7);
        return txnMonth === selectedMonth;
    });
}
    transactions.sort((a, b) => {
    const d = new Date(b.date) - new Date(a.date);
    if (d !== 0) return d;
    return b.createdAt?.seconds - a.createdAt?.seconds;
});

    let income = 0;
let expense = 0;

transactions.forEach(t => {
    if (t.type === "income") income += t.amount;
    if (t.type === "expense") expense += t.amount;
});

// CORE

const sortedForBalance = [...allTransactions].sort((a, b) => {
    const d = new Date(a.date) - new Date(b.date);
    if (d !== 0) return d;
    return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
});

let cashBalance = 0;

sortedForBalance.forEach(t => {
    if (t.type === "income") cashBalance += t.amount;
    else if (t.type === "expense") cashBalance -= t.amount;
    else if (t.type === "transfer") {
        if (t.from === "cash") cashBalance -= t.amount;
        if (t.to === "cash") cashBalance += t.amount;
    }
});



// SMART METRICS
const savingsRate = income > 0 ? (income - expense) / income : 0;

// EMERGENCY COVERAGE (months)
const emergencyCoverage = expense > 0
    ? (cashBalance / expense)
    : 0;
// CATEGORY ANALYSIS
const categoryMap = {};

transactions.forEach(t => {
    if (t.type !== "expense") return;

    if (!categoryMap[t.category]) categoryMap[t.category] = 0;
    categoryMap[t.category] += t.amount;
});

// TOP EXPENSE CATEGORY
let topCategory = "—";
let maxSpend = 0;

Object.entries(categoryMap).forEach(([cat, val]) => {
    if (val > maxSpend) {
        maxSpend = val;
        topCategory = cat;
    }
});


let status = "Vulnerable";

if (savingsRate >= 0.4) status = "Strong";
else if (savingsRate >= 0.15) status = "Stable";

const monthlyExpenseMap = {};


allTransactions.forEach(t => {
    if (t.type !== "expense" || !t.date) return;

    const month = new Date(t.date).toISOString().slice(0, 7);

    if (!monthlyExpenseMap[month]) monthlyExpenseMap[month] = 0;

    monthlyExpenseMap[month] += t.amount;
});
// MONTHLY INCOME
const monthlyIncomeMap = {};

allTransactions.forEach(t => {
    if (t.type !== "income" || !t.date) return;

    const month = new Date(t.date).toISOString().slice(0, 7);

    if (!monthlyIncomeMap[month]) monthlyIncomeMap[month] = 0;

    monthlyIncomeMap[month] += t.amount;
});

// NET CASH FLOW
const allMonths = new Set([
    ...Object.keys(monthlyIncomeMap),
    ...Object.keys(monthlyExpenseMap)
]);

const monthlyCashflow = {};

allMonths.forEach(month => {
    const income = monthlyIncomeMap[month] || 0;
    const expense = monthlyExpenseMap[month] || 0;

    monthlyCashflow[month] = income - expense;
});

// LAST MONTH FLOW
const sortedCashflowMonths = Object.keys(monthlyCashflow)
    .sort((a, b) => new Date(a) - new Date(b));
const lastMonth = sortedCashflowMonths[sortedCashflowMonths.length - 1];
const lastMonthFlow = lastMonth ? monthlyCashflow[lastMonth] : 0;
const sortedMonths = Object.keys(monthlyExpenseMap)
    .sort((a, b) => new Date(a) - new Date(b));

const last3MonthsList = sortedMonths.slice(-3);

const monthlyValues = last3MonthsList.map(m => monthlyExpenseMap[m]);

let avgExpense = 0;

if (monthlyValues.length === 0) {
    avgExpense = 0;
} else if (monthlyValues.length === 1) {
    // Only 1 month → don't call it "average"
    avgExpense = monthlyValues[0];
} else {
    avgExpense =
        monthlyValues.reduce((a, b) => a + b, 0) /
        monthlyValues.length;
}
    
// AVG TRANSACTION SIZE (NEW METRIC)
const expenseTransactions = transactions.filter(t => t.type === "expense");

const avgTransaction = expenseTransactions.length > 0
    ? expenseTransactions.reduce((sum, t) => sum + t.amount, 0) /
      expenseTransactions.length
    : 0;

// MRR (Salary-based for now)
const recurringIncome = allTransactions.filter(t =>
    t.type === "income" &&
    t.category &&
    t.category.toLowerCase().includes("salary")
);

const MRR = recurringIncome.reduce((sum, t) => sum + t.amount, 0);
   document.body.innerHTML = `
<div class="app">

    <!-- TOP BAR -->
    <div class="topbar">
    <div class="left">
        <button id="togglePanel">☰</button>
        <button id="backBtn">←</button>
    </div>

    <div class="center">Dashboard</div>

    <div class="right">
        <button id="logout">Logout</button>
    </div>
</div>
       

    </div>

    <div class="layout">

        <!-- LEFT SIDE -->
        <div class="main">

            
<div class="metrics-row">

    <div class="metric-box">
        <div>Income</div>
        <strong>₹${income}</strong>
    </div>

    <div class="metric-box">
        <div>Expense</div>
        <strong>₹${expense}</strong>
    </div>

    <div class="metric-box ${cashBalance>=0?'green':'red'}">
    <div>Cash</div>
    <strong>₹${cashBalance}</strong>
</div>

    
    <div class="metric-box">
        <div>Net Worth</div>
        <strong>₹${netWorth}</strong>
    </div>

    <div class="metric-box">
        <div>Savings</div>
        <strong>${(savingsRate * 100).toFixed(1)}%</strong>
    </div>

    <div class="metric-box">
        <div>Emergency</div>
        <strong>${emergencyCoverage.toFixed(1)}x</strong>
    </div>

    <div class="metric-box">
        <div>Status</div>
        <strong>${status}</strong>
    </div>

    <div class="metric-box">
        <div>Top Spend</div>
        <strong>${topCategory}</strong>
    </div>

    <div class="metric-box">
    <div>3M Avg Expense</div>
    <strong>₹${Math.round(avgExpense)}</strong>
</div>
<div class="metric-box">
    <div>Avg Transaction Size</div>
    <strong>₹${Math.round(avgTransaction)}</strong>
</div>
<div class="metric-box ${lastMonthFlow >= 0 ? 'green' : 'red'}">
    <div>Monthly Flow</div>
    <strong>₹${Math.round(lastMonthFlow)}</strong>
</div>
<div class="metric-box">
    <div>MRR</div>
    <strong>₹${MRR}</strong>
</div>
</div>

            <!-- TRANSACTIONS -->
            <div class="section">
                <h2 class="toggle">
    <span>Transactions</span>
    <span class="chevron">⌄</span>
</h2>
<div class="content">

                ${transactions.map(t => `
                    <div class="list-item">
                        <div>
                            <div class="title">${t.category}</div>
                            <div class="sub">${t.type} • ${new Date(t.date).toLocaleDateString()}</div>
                        </div>
                        <div class="${t.type==="income"?"green":"red"}">
                            ₹${t.amount}
                        </div>
                        <button class="delete" data-id="${t.id}">×</button>
                    </div>
                `).join("")}
            </div>
</div>
            <!-- ASSETS -->
            <div class="section">

                <h2 class="toggle">
    <span>Assets</span>
    <span class="chevron">⌄</span>
</h2>
<div class="content">
    

                ${assets.filter(a => {
    if (!a.startDate) return true;
    return new Date(a.startDate) <= new Date();
}).map(a => `
                    <div class="list-item expandable">
                        <div>
                            <div class="title">${a.name}</div>
                            <div class="sub">${a.type} • ${a.rate || 0}%</div>
                        </div>
                        <div>₹${Math.round(
    calculateAssetValue(a) +
    allTransactions
        .filter(t => t.type === "transfer" && t.linkedId === a.id)
        .reduce((sum, t) => {
            if (t.to === "asset") return sum + t.amount;
            if (t.from === "asset") return sum - t.amount;
            return sum;
        }, 0)
)}</div>
                        <button class="delete-asset" data-id="${a.id}">×</button>
                    </div>
                `).join("")}
            </div>
</div>
            <!-- LIABILITIES -->
            <div class="section">
                <h2 class="toggle">
    <span>Liabilities</span>
    <span class="chevron">⌄</span>
</h2>
<div class="content">
   

                ${liabilities.map(l => `
                    <div class="list-item">
                        <div>
                            <div class="title">${l.name}</div>
                            <div class="sub">${l.rate || 0}%</div>
                        </div>
                        <div class="red">₹${Math.round(
    calculateLiabilityValue(l) +
    allTransactions
        .filter(t => t.type === "transfer" && t.linkedId === l.id)
        .reduce((sum, t) => {
            if (t.from === "liability") return sum + t.amount;
            if (t.to === "liability") return sum - t.amount;
            return sum;
        }, 0)
)}</div>
                        <button class="delete-liability" data-id="${l.id}">×</button>
                    </div>
                `).join("")}
            </div>
</div>
<div class="overlay" id="overlay"></div>
        </div>

        <!-- RIGHT PANEL -->
        <div class="side">

            <h3>Add Transaction</h3>

            <div class="form-group">
    <input id="amount" placeholder="Amount" />
    <input id="category" placeholder="Category" />
    <input id="date" type="date" />
</div>

<div class="button-group txn-type">
    <button id="incomeBtn" class="active">Income</button>
    <button id="expenseBtn">Expense</button>
    <button id="transferBtn">Transfer</button>
</div>

<div id="transferFields" class="transfer-ui">

    <div class="transfer-group">
        <div class="label">From</div>
        <div class="mini-toggle" id="fromGroup">
            <button data-value="cash" class="active">Cash</button>
            <button data-value="asset">Asset</button>
            <button data-value="liability">Debt</button>
        </div>
    </div>

    <div class="transfer-group">
        <div class="label">To</div>
        <div class="mini-toggle" id="toGroup">
            <button data-value="cash">Cash</button>
            <button data-value="asset" class="active">Asset</button>
            <button data-value="liability">Debt</button>
        </div>
    
</div>
<div class="transfer-accounts">

    <div class="account-select">
        <label>From Account</label>
        <select id="fromAccount"></select>
    </div>

    <div class="account-select">
        <label>To Account</label>
        <select id="toAccount"></select>
    </div>

</div>
       

       
</div>



            <button id="addTxn" class="btn-primary">Add Transaction</button>

            <h3>Add Asset</h3>

            <div class="form-group">
    <input id="assetName" placeholder="Name" />
    <input id="assetValue" placeholder="Value" />
    <input id="assetRate" placeholder="Return %" />
</div>
<div class="form-group">
<div style="display:flex; gap:10px;">
    <div style="flex:1;">
        <label style="font-size:11px; color:#64748b;">Start Date</label>
        <input id="assetStart" type="date" />
    </div>

    <div style="flex:1;">
        <label style="font-size:11px; color:#64748b;">End Date (optional)</label>
        <input id="assetEnd" type="date" />
    </div>
</div>
</div>

<div class="button-group asset-type">
    <button id="simpleAsset" class="active">Simple</button>
    <button id="compoundAsset">Compound</button>
</div>


            <div class="button-group asset-type">
    <button id="appBtn" class="active">Appreciating</button>
    <button id="depBtn">Depreciating</button>
</div>
                

            <button id="addAsset" class="btn-primary">Add Asset</button>

            <h3>Add Liability</h3>
<div class="form-group">
            <input id="liabilityName" placeholder="Name" />
<input id="liabilityValue" placeholder="Amount" />
<input id="liabilityRate" placeholder="Interest %" />
</div>
<div class="form-group">
<div style="display:flex; gap:10px;">
    <div style="flex:1;">
        <label style="font-size:11px; color:#64748b;">Start Date</label>
        <input id="liabilityStart" type="date" />
    </div>

    <div style="flex:1;">
        <label style="font-size:11px; color:#64748b;">End Date (optional)</label>
        <input id="liabilityEnd" type="date" />
    </div>
</div>
</div>
<div class="button-group asset-type">
    <button id="simpleLiability" class="active">Simple</button>
    <button id="compoundLiability">Compound</button>
</div>

            <button id="addLiability" class="btn-primary">Add Liability</button>

        </div>

    </div>
</div>
`;
const panel = document.querySelector(".side");
const overlay = document.getElementById("overlay");
    let type = "income";
let from = "cash";
let to = "asset";
let assetType = "appreciating";
let compounding = "simple";
let liabilityType = "simple";

function updateAccountSelectors() {
    const fromSel = document.getElementById("fromAccount");
    const toSel = document.getElementById("toAccount");

    if (!fromSel || !toSel) return;

    // RESET
    fromSel.innerHTML = "";
    toSel.innerHTML = "";

    // ===== FROM SIDE =====
    if (from === "cash") {
        fromSel.innerHTML = `<option>Cash Balance (₹${Math.round(cashBalance)})</option>`;
        fromSel.disabled = true;
    } 
    
    else if (from === "asset") {
        if (assets.length === 0) {
            fromSel.innerHTML = `<option>No assets available</option>`;
            fromSel.disabled = true;
        } else {
            fromSel.innerHTML = `<option value="">Select Asset</option>`;
            assets.forEach(a => {
                fromSel.innerHTML += `<option value="${a.id}">${a.name}</option>`;
            });
            fromSel.disabled = false;
        }
    }

    else if (from === "liability") {
        if (liabilities.length === 0) {
            fromSel.innerHTML = `<option>No liabilities available</option>`;
            fromSel.disabled = true;
        } else {
            fromSel.innerHTML = `<option value="">Select Liability</option>`;
            liabilities.forEach(l => {
                fromSel.innerHTML += `<option value="${l.id}">${l.name}</option>`;
            });
            fromSel.disabled = false;
        }
    }

    // ===== TO SIDE =====
    if (to === "cash") {
        toSel.innerHTML = `<option>Cash (no account)</option>`;
        toSel.disabled = true;
    } 
    
    else if (to === "asset") {
        if (assets.length === 0) {
            toSel.innerHTML = `<option>No assets available</option>`;
            toSel.disabled = true;
        } else {
            toSel.innerHTML = `<option value="">Select Asset</option>`;
            assets.forEach(a => {
                toSel.innerHTML += `<option value="${a.id}">${a.name}</option>`;
            });
            toSel.disabled = false;
        }
    }

    else if (to === "liability") {
        if (liabilities.length === 0) {
            toSel.innerHTML = `<option>No liabilities available</option>`;
            toSel.disabled = true;
        } else {
            toSel.innerHTML = `<option value="">Select Liability</option>`;
            liabilities.forEach(l => {
                toSel.innerHTML += `<option value="${l.id}">${l.name}</option>`;
            });
            toSel.disabled = false;
        }
    }
}

// FROM buttons
document.querySelectorAll("#fromGroup button").forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll("#fromGroup button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        from = btn.dataset.value;
        updateAccountSelectors();// ✅ CORRECT PLACE
    };
});


// TO buttons
document.querySelectorAll("#toGroup button").forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll("#toGroup button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        to = btn.dataset.value;
        updateAccountSelectors(); // ✅ CORRECT PLACE
    };
});

const incomeBtn = document.getElementById("incomeBtn");
const expenseBtn = document.getElementById("expenseBtn");


const transferBtn = document.getElementById("transferBtn");
const transferFields = document.getElementById("transferFields");

if (transferBtn && incomeBtn && expenseBtn && transferFields) {

    transferBtn.onclick = () => {
    type = "transfer";

    transferBtn.classList.add("active");
    incomeBtn.classList.remove("active");
    expenseBtn.classList.remove("active");

    transferFields.style.display = "block";

    from = "cash";
to = "asset";
// Sync UI buttons
document.querySelectorAll("#fromGroup button").forEach(b => b.classList.remove("active"));
document.querySelector('#fromGroup [data-value="asset"]').classList.add("active");

document.querySelectorAll("#toGroup button").forEach(b => b.classList.remove("active"));
document.querySelector('#toGroup [data-value="cash"]').classList.add("active");
    updateAccountSelectors();
};

    incomeBtn.onclick = () => {
    type = "income";

    incomeBtn.classList.add("active");
    expenseBtn.classList.remove("active");
    transferBtn.classList.remove("active");

    transferFields.style.display = "none";

    // 🔥 RESET
    from = "cash";
    to = "asset";
};

    expenseBtn.onclick = () => {
    type = "expense";

    expenseBtn.classList.add("active");
    incomeBtn.classList.remove("active");
    transferBtn.classList.remove("active");

    transferFields.style.display = "none";

    // 🔥 RESET
    from = "cash";
    to = "asset";
};
updateAccountSelectors();
}

const addTxnBtn = document.getElementById("addTxn");

if (addTxnBtn) {
    addTxnBtn.onclick = async () => {

        const cat = document.getElementById("category").value.trim();
        const rawAmt = document.getElementById("amount").value.trim();
        const amt = parseFloat(rawAmt);

        if (!rawAmt || isNaN(amt) || amt <= 0) {
            alert("Enter valid amount");
            return;
        }

        if (!cat) {
            alert("Enter category");
            return;
        }

        const rawDate = document.getElementById("date").value;
        const date = rawDate ? rawDate : new Date().toISOString().slice(0,10);

        if (type === "transfer") {

            if (from === to) {
                alert("Invalid transfer: Same account");
                return;
            }

            if (
                (from === "asset" && to === "asset") ||
                (from === "liability" && to === "liability") ||
                (from === "asset" && to === "liability") ||
                (from === "liability" && to === "asset")
            ) {
                alert("Invalid transfer type");
                return;
            }
        }

        let fromAccount = document.getElementById("fromAccount")?.value || null;
let toAccount = document.getElementById("toAccount")?.value || null;

if (type === "transfer") {

    if (from === to && fromAccount === toAccount) {
        alert("Cannot transfer to same account");
        return;
    }

    if ((from === "asset" || from === "liability") && !fromAccount) {
        alert("Select FROM account");
        return;
    }

    if ((to === "asset" || to === "liability") && !toAccount) {
        alert("Select TO account");
        return;
    }
}

     

        await addTransaction(profileId, amt, type, cat, date, from, to, {
    fromAccount,
    toAccount
});

        document.getElementById("amount").value = "";
        document.getElementById("category").value = "";

        renderDashboard(user, profileId);
    };
}
    const addAssetBtn = document.getElementById("addAsset");

if (addAssetBtn) {
    addAssetBtn.onclick = async () => {
    const name = document.getElementById("assetName").value;
    const value = document.getElementById("assetValue").value;
    const rate = document.getElementById("assetRate").value;

   const startDate = document.getElementById("assetStart").value;
const endDate = document.getElementById("assetEnd").value;

const compoundingType = compounding;

    if (!name || !value || !startDate) {
    return alert("Start date is required");
}

   await addAsset(
    profileId,
    name,
    value,
    rate,
    assetType,
    startDate,
    endDate,
    compoundingType
);
    renderDashboard(user, profileId);
};
}
const addLiabilityBtn = document.getElementById("addLiability");

if (addLiabilityBtn) {
    addLiabilityBtn.onclick = async () => {
    const name = document.getElementById("liabilityName").value;
    const value = document.getElementById("liabilityValue").value;
    const rate = document.getElementById("liabilityRate").value;
    const startDate = document.getElementById("liabilityStart").value;
const endDate = document.getElementById("liabilityEnd").value;
const liabilityMode = liabilityType;

    if (!name || !value || !startDate) {
    return alert("Start date is required");
}

    await addLiability(
    profileId,
    name,
    value,
    rate,
    startDate,
    endDate,
    liabilityMode
);
    renderDashboard(user, profileId);
};
}
if (!isGlobalHandlerAttached) {

    document.body.addEventListener("click", async (e) => {

    // BACK
    if (e.target.id === "backBtn") {
        localStorage.removeItem("selectedProfile");
        renderApp(user);
    }

    // LOGOUT
    if (e.target.id === "logout") {
        await logout();
    }

    // PANEL OPEN
    if (e.target.id === "togglePanel") {
        panel?.classList.add("open");
        document.getElementById("overlay")?.classList.add("show");
    }

    // PANEL CLOSE
    if (e.target.id === "overlay") {
        panel?.classList.remove("open");
        document.getElementById("overlay")?.classList.remove("show");
    }

    // DELETE TXN
    if (e.target.classList.contains("delete")) {
        await deleteTransaction(e.target.dataset.id, profileId);
        renderDashboard(user, profileId);
    }

    // DELETE ASSET
    if (e.target.classList.contains("delete-asset")) {
        await deleteAsset(e.target.dataset.id);
        renderDashboard(user, profileId);
    }

    // DELETE LIABILITY
    if (e.target.classList.contains("delete-liability")) {
        await deleteLiability(e.target.dataset.id);
        renderDashboard(user, profileId);
    }

    // COLLAPSE
    if (e.target.closest(".toggle")) {
        const section = e.target.closest(".section");
        section.classList.toggle("collapsed");
    }
});

    isGlobalHandlerAttached = true;
}

}
// ==========================
// AUTH
// ==========================

observeAuth(async (user) => {
    if (user) {
        await renderApp(user);
    } else {
        document.body.innerHTML = `
        <div class="container">

            <div class="hero">
                <h1 class="hero-title">Arbor</h1>
                <p class="hero-sub">Quant Financial Operating System</p>
                <p class="hero-mini">Built by Vivaan Agarwal</p>
            </div>

            <div class="card auth-card">

                <input id="email" placeholder="Email" />
                <input id="password" type="password" placeholder="Password" />

                <button id="login" class="primary">Login</button>
                <button id="signup" class="secondary">Create Account</button>
                <button id="reset" class="link">Forgot Password?</button>

            </div>

        </div>
        `;
        setTimeout(() => {
    updateAccountSelectors();
}, 0);

        const emailInput = document.getElementById("email");
        const passwordInput = document.getElementById("password");

        document.getElementById("signup").onclick = async () => {
            await signUp(emailInput.value, passwordInput.value);
        };

        document.getElementById("login").onclick = async () => {
            await login(emailInput.value, passwordInput.value);
        };

        document.getElementById("reset").onclick = async () => {
            await resetPassword(emailInput.value);
       };
    }
});