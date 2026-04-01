import { signUp, login, resetPassword, observeAuth, logout } from "./firebase/auth.js";
import { createProfile, getProfiles } from "./profiles/profiles.js";
import { addTransaction, getTransactions } from "./modules/transactions.js";
import { addAsset, addLiability, getAssets, getLiabilities } from "./modules/networth.js";
import { deleteTransaction } from "./modules/transactions.js";
import { deleteAsset } from "./modules/networth.js";
import { deleteLiability } from "./modules/networth.js";
import { createAccount, getAccounts } from "./modules/accounts.js";
import { createEMI, getEMIs } from "./modules/emi.js";
import { computeFinancials } from "./modules/engine.js";
import { deleteAccount } from "./modules/accounts.js";
import { deleteEMI } from "./modules/emi.js";
let state = {
    assets: [],
    liabilities: [],
    transactions: [],
    accounts: [],
    emis: []
};
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

// ==========================
// DASHBOARD
// ==========================

async function renderDashboard(user, profileId) {

// LOAD ONLY IF EMPTY
if (
    state.transactions.length === 0 ||
    state.accounts.length === 0
) {
    const [assets, liabilities, allTransactions, accounts, emis] = await Promise.all([
        getAssets(profileId),
        getLiabilities(profileId),
        getTransactions(profileId),
        getAccounts(profileId),
        getEMIs(profileId)
    ]);

    state.assets = assets;
    state.liabilities = liabilities;
    state.transactions = allTransactions;
    state.accounts = accounts;
    state.emis = emis;
}

// USE STATE
const assets = state.assets;
const liabilities = state.liabilities;
const allTransactions = state.transactions;
const accounts = state.accounts;
const emis = state.emis;

// AUTO CREATE DEFAULT ACCOUNT
if (!accounts || accounts.length === 0) {
    await createAccount(profileId, "Main Account", "bank");

    // 🔥 UPDATE STATE
    state.accounts = await getAccounts(profileId);

    return renderDashboard(user, profileId);
}

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

    const netFlow = allTransactions
        .filter(t => t.assetId === a.id)
        .reduce((sum, t) => {
            if (t.type === "buy") return sum + t.amount;
            if (t.type === "sell") return sum - t.amount;
            return sum;
        }, 0);

    adjustedAssets += base + netFlow;
});

let adjustedLiabilities = 0;

liabilities.forEach(l => {
    adjustedLiabilities += calculateLiabilityValue(l);
});


  


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
    const t1 = new Date(b.date).getTime();
    const t2 = new Date(a.date).getTime();

    if (!isNaN(t1) && !isNaN(t2) && t1 !== t2) return t1 - t2;

    return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
});

const metrics = computeFinancials(state);
const netWorth = metrics.netWorth;
const {
    income,
    expense,
    totalCash,
    savingsRate,
    emergencyCoverage,
    MRR,
    balances: accountBalances,
    monthlySavings,
    topCategory,
    status,
    avgExpense,
    avgTransaction,
    lastMonthFlow
} = computeFinancials(state);
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

    <div class="metric-box ${totalCash>=0?'green':'red'}">
    <div>Total Cash</div>
<strong>₹${Math.round(totalCash)}</strong>
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
<div class="section">
<h2 class="toggle">
    <span>Accounts</span>
    <span class="chevron">⌄</span>
</h2>
<div class="content">

${accounts.map(a => `
    <div class="list-item">
        <div>
            <div class="title">${a.name}</div>
            <div class="sub">${a.type}</div>
        </div>
        <div>₹${Math.round(accountBalances[a.id] || 0)}</div>
        <button class="delete-account" data-id="${a.id}">×</button>
    </div>
`).join("")}

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
        .filter(t => t.assetId === a.id)
        .reduce((sum, t) => {
            if (t.type === "buy") return sum + t.amount;
            if (t.type === "sell") return sum - t.amount;
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
                        <div class="red">₹${Math.round(calculateLiabilityValue(l))}</div>
                        <button class="delete-liability" data-id="${l.id}">×</button>
                    </div>
                `).join("")}
            </div>
</div>

<div class="section">
<h2 class="toggle">
    <span>EMIs</span>
    <span class="chevron">⌄</span>
</h2>
<div class="content">

${emis.map(e => `
    <div class="list-item">
        <div>
            <div class="title">${e.name || "EMI"}</div>
            <div class="sub">Due: ${new Date(e.nextDate).toLocaleDateString()}</div>
        </div>
        <div class="red">₹${e.amount}</div>
        <button class="delete-emi" data-id="${e.id}">×</button>
    </div>
`).join("")}

</div>
</div>
<div class="overlay" id="overlay"></div>
        </div>

        <!-- RIGHT PANEL -->
        <div class="side">
<h3>Add Account</h3>

<input id="accName" placeholder="Account Name" />

<select id="accType">
  <option value="cash">Cash</option>
  <option value="bank">Bank</option>
  <option value="wallet">Wallet</option>
</select>
<select id="accSubType" style="display:none;">
  <option value="savings">Savings</option>
  <option value="current">Current</option>
</select>

<input id="accRate" placeholder="Interest %" style="display:none;" />
<button id="addAccount">Add Account</button>
            <h3>Add Transaction</h3>

<select id="txnType">
  <option value="income">Income</option>
  <option value="expense">Expense</option>
  <option value="buy">Buy Asset</option>
  <option value="sell">Sell Asset</option>
</select>

<select id="txnSubType"></select>

<div class="form-group">
    <input id="amount" placeholder="Amount" />
    <input id="category" placeholder="Description (e.g. Rent, Salary)" />
    
    <select id="accountSelect"></select>
    <select id="assetSelect" style="display:none;"></select>

    <input id="date" type="date" />
</div>

<button id="addTxn" class="btn-primary">Add</button>

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

        
<h3>Add EMI</h3>

<input id="emiName" placeholder="Loan Name (e.g. Car Loan)" />

<input id="emiPrincipal" placeholder="Principal Amount" />
<input id="emiRate" placeholder="Interest % (Annual)" />
<input id="emiTenure" placeholder="Tenure (Months)" />

<input id="emiAmount" placeholder="EMI Amount" />
<input id="emiDate" type="date" />

<button id="addEMI">Add EMI</button>
    </div>
</div>
</div>
`;
const panel = document.querySelector(".side");
document.getElementById("addAccount").onclick = async () => {
    const name = document.getElementById("accName").value;
    const accType = document.getElementById("accType").value;
const subtype = document.getElementById("accSubType").value;
    if (!name) return alert("Enter name");

    const rate = Number(document.getElementById("accRate").value) || 0;

await createAccount(profileId, name, accType, subtype, rate);

// update state
state.accounts = await getAccounts(profileId);

// re-render
renderDashboard(user, profileId);
    closePanel();

};
const overlay = document.getElementById("overlay");
function openPanel() {
    panel.classList.add("open");
    overlay.classList.add("show");
}

function closePanel() {
    panel.classList.remove("open");
    overlay.classList.remove("show");
}

let selectedAssetId = null;
let assetType = "appreciating";
let compounding = "simple";
let liabilityType = "simple";






const assetSelect = document.getElementById("assetSelect") || { style: {} };
const accountSelect = document.getElementById("accountSelect");
const txnTypeEl = document.getElementById("txnType");
if (!txnTypeEl) {
    console.error("txnType not found");
}
const txnSubTypeEl = document.getElementById("txnSubType") || {
    value: null,
    innerHTML: ""
};

const subtypeMap = {
    income: ["salary", "business", "interest", "dividend", "capital_gain"],
    expense: ["fixed", "variable", "discretionary"],
    buy: ["investment"],
    sell: ["liquidation"]
};

function updateSubtypes() {
    const type = txnTypeEl.value;

    txnSubTypeEl.innerHTML = "";

    if (!subtypeMap[type]) return;

subtypeMap[type].forEach(s => {
        txnSubTypeEl.innerHTML += `<option value="${s}">${s}</option>`;
    });

    // asset visibility
    if (type === "buy" || type === "sell") {
        assetSelect.style.display = "block";
        populateAssets();
    } else {
        assetSelect.style.display = "none";
    }
}

txnTypeEl.onchange = updateSubtypes;
try {
    updateSubtypes();
} catch (e) {
    console.error("Subtype init error:", e);
}
const accTypeEl = document.getElementById("accType");
const accSubTypeEl = document.getElementById("accSubType");
const accRateEl = document.getElementById("accRate");

accTypeEl.onchange = () => {
    if (accTypeEl.value === "bank") {
        accSubTypeEl.style.display = "block";
        accRateEl.style.display = "block";
    } else {
        accSubTypeEl.style.display = "none";
        accRateEl.style.display = "none";
    }
};
// ASSET TYPE TOGGLE
document.getElementById("appBtn").onclick = () => {
    assetType = "appreciating";
    document.getElementById("appBtn").classList.add("active");
    document.getElementById("depBtn").classList.remove("active");
};

document.getElementById("depBtn").onclick = () => {
    assetType = "depreciating";
    document.getElementById("depBtn").classList.add("active");
    document.getElementById("appBtn").classList.remove("active");
};

// COMPOUNDING
document.getElementById("simpleAsset").onclick = () => {
    compounding = "simple";
    document.getElementById("simpleAsset").classList.add("active");
    document.getElementById("compoundAsset").classList.remove("active");
};

document.getElementById("compoundAsset").onclick = () => {
    compounding = "compound";
    document.getElementById("compoundAsset").classList.add("active");
    document.getElementById("simpleAsset").classList.remove("active");
};

// LIABILITY TYPE
document.getElementById("simpleLiability").onclick = () => {
    liabilityType = "simple";
    document.getElementById("simpleLiability").classList.add("active");
    document.getElementById("compoundLiability").classList.remove("active");
};

document.getElementById("compoundLiability").onclick = () => {
    liabilityType = "compound";
    document.getElementById("compoundLiability").classList.add("active");
    document.getElementById("simpleLiability").classList.remove("active");
};
const addEMIBtn = document.getElementById("addEMI");

if (addEMIBtn) {
    addEMIBtn.onclick = async () => {
        const name = document.getElementById("emiName").value;

const principal = Number(document.getElementById("emiPrincipal").value);
const rate = Number(document.getElementById("emiRate").value);
const tenure = Number(document.getElementById("emiTenure").value);

const amount = Number(document.getElementById("emiAmount").value);
const nextDate = document.getElementById("emiDate").value;
let accountId = document.getElementById("accountSelect")?.value;

if (!accountId && accounts.length > 0) {
    accountId = accounts[0].id;
}
        if (!name || !principal || !rate || !tenure || !amount || !nextDate) {
    return alert("Fill all EMI fields properly");
}

       const newEMI = {
    id: "temp-" + Date.now(),
    name,
    principal,
    rate,
    tenure,
    amount,
    nextDate,
    accountId,
    remainingPrincipal: principal
};

        state.emis.push(newEMI);

        renderDashboard(user, profileId);

        createEMI(profileId, {
    name,
    amount,        // EMI amount
    principal,     // total loan
    rate,          // annual %
    tenure,        // months
    startDate,
    nextDate,
    accountId
});
    };
}
function populateAccounts() {
    accountSelect.innerHTML = `<option value="">Select Account</option>`;
    accounts.forEach(a => {
        accountSelect.innerHTML += `<option value="${a.id}">${a.name}</option>`;
    });
}

populateAccounts();
function populateAssets() {
    assetSelect.innerHTML = `<option value="">Select Asset</option>`;
    assets.forEach(a => {
        assetSelect.innerHTML += `<option value="${a.id}">${a.name}</option>`;
    });
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

        

        



     

        const selectedAssetId = document.getElementById("assetSelect")?.value || null;
let accountId = document.getElementById("accountSelect")?.value;

// AUTO DEFAULT
if (!accountId && accounts.length > 0) {
    accountId = accounts[0].id;
}

const type = txnTypeEl.value;

if ((type === "buy" || type === "sell") && !selectedAssetId) {
    alert("Select asset");
    return;
}

const subtype = txnSubTypeEl ? txnSubTypeEl.value : null;

await addTransaction(
    profileId,
    amt,
    type,
    cat,
    date,
    null,
    null,
    {
        assetId: selectedAssetId,
        accountId: accountId,
        subtype: subtype
    }
);

// fetch fresh data
state.transactions = await getTransactions(profileId);

// render
renderDashboard(user, profileId);




        document.getElementById("amount").value = "";
        document.getElementById("category").value = "";

        closePanel();

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

   const newAsset = {
    id: "temp-" + Date.now(),
    name,
    value,
    rate,
    type: assetType,
    startDate,
    endDate,
    compounding: compoundingType
};

state.assets.push(newAsset);

renderDashboard(user, profileId);

addAsset(
    profileId,
    name,
    value,
    rate,
    assetType,
    startDate,
    endDate,
    compoundingType
);
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
const newLiability = {
    id: "temp-" + Date.now(),
    name,
    value,
    rate,
    startDate,
    endDate,
    type: liabilityMode
};

state.liabilities.push(newLiability);

renderDashboard(user, profileId);

addLiability(
    profileId,
    name,
    value,
    rate,
    startDate,
    endDate,
    liabilityMode
);

};
}
document.body.onclick = async (e) => {
    // DELETE ACCOUNT
if (e.target.classList.contains("delete-account")) {
    const id = e.target.dataset.id;

    // 🚫 prevent deleting last account
    if (state.accounts.length <= 1) {
        alert("At least one account required");
        return;
    }

    // optimistic UI
    state.accounts = state.accounts.filter(a => a.id !== id);
    renderDashboard(user, profileId);

    // backend sync
    deleteAccount(id, profileId)
        .then(async () => {
            state.accounts = await getAccounts(profileId);
        })
        .catch(err => console.error(err));
}

// DELETE EMI
if (e.target.classList.contains("delete-emi")) {
    const id = e.target.dataset.id;

    state.emis = state.emis.filter(e => e.id !== id);
    renderDashboard(user, profileId);

    deleteEMI(id, profileId)
        .then(async () => {
            state.emis = await getEMIs(profileId);
        })
        .catch(err => console.error(err));
}
    // BACK
    if (e.target.id === "backBtn") {
        state = {
        assets: [],
        liabilities: [],
        transactions: [],
        accounts: [],
        emis: []
    };
        localStorage.removeItem("selectedProfile");
        renderApp(user);
    }

    // LOGOUT
    if (e.target.id === "logout") {

        state = {
        assets: [],
        liabilities: [],
        transactions: [],
        accounts: [],
        emis: []
    };
        await logout();
    }

    // PANEL OPEN
    if (e.target.closest("#togglePanel")) {
        openPanel();
    }

    // PANEL CLOSE
    if (e.target.closest("#overlay")) {
        closePanel();
    }

    // DELETE TXN
 if (e.target.classList.contains("delete")) {
    const id = e.target.dataset.id;

    // 🚫 block temp ids
    if (id.startsWith("temp-")) return;

    // optimistic UI
    state.transactions = state.transactions.filter(t => t.id !== id);
    renderDashboard(user, profileId);

    // backend sync + refetch
    deleteTransaction(id, profileId)
        .then(async () => {
            state.transactions = await getTransactions(profileId);
        })
        .catch(err => {
            console.error(err);
        });
}

    // DELETE ASSET
    if (e.target.classList.contains("delete-asset")) {
       // remove from state
state.assets = state.assets.filter(a => a.id !== e.target.dataset.id);

// instant render
renderDashboard(user, profileId);

// backend
await deleteAsset(profileId, e.target.dataset.id);

    }

    // DELETE LIABILITY
    if (e.target.classList.contains("delete-liability")) {
       state.liabilities = state.liabilities.filter(l => l.id !== e.target.dataset.id);

renderDashboard(user, profileId);

await deleteLiability(profileId, e.target.dataset.id);
  
    }

    // COLLAPSE
    if (e.target.closest(".toggle")) {
        const section = e.target.closest(".section");
        section.classList.toggle("collapsed");
    }
};

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
