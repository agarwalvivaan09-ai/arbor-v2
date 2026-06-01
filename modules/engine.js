export function computeFinancials(state, options = {}) {
    const {
        assets = [],
        liabilities = [],
        transactions = [],
        accounts = [],
        emis = []
    } = state || {};
    const taxEnabled = options.taxEnabled || false;
    const today = new Date();
    const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365;

    function amountOf(item) {
        const amount = Number(item?.amount);
        return Number.isFinite(amount) && amount > 0 ? amount : 0;
    }

    function isDue(dateValue) {
        if (!dateValue) return false;
        const date = new Date(dateValue);
        return !Number.isNaN(date.getTime()) && date <= today;
    }

    function hasRemainingPrincipal(emi) {
        if (emi?.remainingPrincipal === undefined || emi?.remainingPrincipal === null || emi?.remainingPrincipal === "") {
            return true;
        }

        return Number(emi.remainingPrincipal) > 0;
    }

    function activeEmiAmount(emi) {
        if (!emi?.accountId || balances[emi.accountId] === undefined) return 0;
        if (!isDue(emi.nextDate)) return 0;
        if (!hasRemainingPrincipal(emi)) return 0;
        return amountOf(emi);
    }

    function monthKey(dateValue) {
        if (!dateValue) return null;

        const date = new Date(dateValue);
        return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 7);
    }

    function timestampValue(createdAt) {
        if (!createdAt) return 0;
        if (typeof createdAt === "number") return createdAt;
        if (typeof createdAt.seconds === "number") return createdAt.seconds * 1000;
        return 0;
    }

    function datedValue(item, defaultRate, direction = 1) {
        const principal = Number(item.value || 0);
        if (!item.startDate) return principal;

        const start = new Date(item.startDate);
        if (Number.isNaN(start.getTime()) || start > today) return 0;

        let years = (today - start) / MS_PER_YEAR;

        if (item.endDate) {
            const end = new Date(item.endDate);
            if (!Number.isNaN(end.getTime()) && today > end) {
                years = Math.max(0, (end - start) / MS_PER_YEAR);
            }
        }

        const rawRate = item.rate === null || item.rate === undefined || item.rate === ""
            ? defaultRate
            : Number(item.rate);
        const rate = (Number.isFinite(rawRate) ? rawRate : defaultRate) / 100;

        if (item.compounding === "compound" || item.type === "compound") {
            return principal * Math.pow(1 + direction * rate, years);
        }

        return principal * (1 + direction * rate * years);
    }

    // ------------------------
    // INIT BALANCES
    // ------------------------
    const balances = {};
    accounts.forEach(a => balances[a.id] = Number(a.openingBalance) || 0);

    const validTxns = transactions.filter(t => amountOf(t) > 0);

    const sorted = [...validTxns].sort((a, b) => {
        const aDate = new Date(a.date).getTime();
        const bDate = new Date(b.date).getTime();
        const aTime = Number.isNaN(aDate) ? 0 : aDate;
        const bTime = Number.isNaN(bDate) ? 0 : bDate;

        if (aTime !== bTime) return aTime - bTime;
        return timestampValue(a.createdAt) - timestampValue(b.createdAt);
    });

    // ------------------------
    // TAX
    // ------------------------


    let income = 0;
    let expense = 0;
    let tax = 0;

    // ------------------------
    // CORE FLOW ENGINE
    // ------------------------
    sorted.forEach(t => {
       const amount = amountOf(t);
       const acc = t.accountId;

if (!acc || balances[acc] === undefined) return;

       if (t.type === "income") {
    income += amount;
    balances[acc] += amount;
}

        if (t.type === "expense") {
            expense += amount;
            balances[acc] -= amount;
        }
if (t.type === "asset_buy") {
    balances[acc] -= amount;
}

if (t.type === "asset_sell") {
    balances[acc] += amount;
}

if (t.type === "liability_add") {
    balances[acc] += amount;
}

if (t.type === "liability_payment") {
    balances[acc] -= amount;
    expense += amount;
}
    });

    // ------------------------
    // EMI (as expense)
    // ------------------------
    emis.forEach(e => {
    const emiAmount = activeEmiAmount(e);
    if (!emiAmount) return;

    balances[e.accountId] -= emiAmount;
    expense += emiAmount;

});

    // ------------------------
    // CASH
    // ------------------------
const totalCash = Object.values(balances).reduce((a, b) => {
    return (a || 0) + (b || 0);
}, 0);

    // ------------------------
    // ASSETS (WITH FLOWS)
    // ------------------------
    const totalAssets = assets.reduce((sum, a) => {
        const direction = a.type === "depreciating" ? -1 : 1;
        const base = datedValue(a, 5, direction);

        const flows = transactions
            .filter(t => t.assetId === a.id)
            .reduce((s, t) => {
                const amount = amountOf(t);
if (t.type === "asset_sell" || t.type === "liquidation" || t.type === "sell") return s - amount;
                return s;
            }, 0);

        return sum + Math.max(0, base + flows);
    }, 0);

    const totalLiabilities = liabilities.reduce((sum, l) => {
        const principal = datedValue(l, 8, 1);
        const repayments = transactions
            .filter(t => t.type === "liability_payment" && t.liabilityId === l.id)
            .reduce((total, t) => total + amountOf(t), 0);

        return sum + Math.max(0, principal - repayments);
    }, 0);

    const netWorth = totalCash + totalAssets - totalLiabilities;

   const netIncomeAfterTax = taxEnabled ? income - tax : income;

    const savingsRate = netIncomeAfterTax > 0
        ? (netIncomeAfterTax - expense) / netIncomeAfterTax
        : 0;

    const emergencyCoverage = expense > 0 ? totalCash / expense : 0;

    let status = "Vulnerable";
    if (savingsRate >= 0.4) status = "Strong";
    else if (savingsRate >= 0.15) status = "Stable";

    // ------------------------
    // CATEGORY FIX
    // ------------------------
    const categoryMap = {};

    transactions.forEach(t => {
        if (t.type !== "expense") return;
        const amount = amountOf(t);
        if (!amount) return;

        const key = t.category || t.subtype || "other";

        categoryMap[key] = (categoryMap[key] || 0) + amount;
    });

    let topCategory = "—";
    let max = 0;

    Object.entries(categoryMap).forEach(([k, v]) => {
        if (v > max) {
            max = v;
            topCategory = k;
        }
    });

    // ------------------------
    // MRR FIX (salary only)
    // ------------------------
    const monthly = {};

    transactions.forEach(t => {
        if (t.type !== "income" || t.subtype !== "salary") return;

        const m = monthKey(t.date);
        if (!m) return;

        const amount = amountOf(t);
        if (!amount) return;

        monthly[m] = (monthly[m] || 0) + amount;
    });

    const MRR = Object.keys(monthly).length
        ? Object.values(monthly).reduce((a,b)=>a+b,0) / Object.keys(monthly).length
        : 0;

    // ------------------------
    // CASH FLOW
    // ------------------------
    const monthlyFlow = {};

    transactions.forEach(t => {
        if (!t.date) return;

        const m = monthKey(t.date);
        if (!m) return;

        if (!monthlyFlow[m]) monthlyFlow[m] = {inc:0, exp:0};

        const amount = amountOf(t);
        if (t.type === "income") monthlyFlow[m].inc += amount;
        if (t.type === "expense" || t.type === "liability_payment") monthlyFlow[m].exp += amount;
        // EMI inclusion

    });
emis.forEach(e => {
    const m = monthKey(e.nextDate);
    if (!m) return;

    if (!monthlyFlow[m]) monthlyFlow[m] = {inc:0, exp:0};

    monthlyFlow[m].exp += activeEmiAmount(e);
});

    const flowMonths = Object.keys(monthlyFlow).sort();
const last = flowMonths[flowMonths.length - 1];

    const lastMonthFlow = last
        ? monthlyFlow[last].inc - monthlyFlow[last].exp
        : 0;
// ------------------------
// AVG EXPENSE (3M)
// ------------------------
const monthlyExpenseMap = {};

transactions.forEach(t => {
    if ((t.type !== "expense" && t.type !== "liability_payment") || !t.date) return;

    const m = monthKey(t.date);
    if (!m) return;

    const amount = amountOf(t);
    if (!amount) return;

    monthlyExpenseMap[m] = (monthlyExpenseMap[m] || 0) + amount;
});

emis.forEach(e => {
    const m = monthKey(e.nextDate);
    if (!m) return;

    const amount = activeEmiAmount(e);
    if (!amount) return;

    monthlyExpenseMap[m] = (monthlyExpenseMap[m] || 0) + amount;
});

const sortedMonths = Object.keys(monthlyExpenseMap).sort();
const last3 = sortedMonths.slice(-3);

const avgExpense = last3.length
    ? last3.reduce((s,m)=>s+monthlyExpenseMap[m],0) / last3.length
    : 0;

// ------------------------
// AVG TRANSACTION SIZE
// ------------------------
const expenseTxns = transactions.filter(t => {
    return (t.type === "expense" || t.type === "liability_payment") && amountOf(t) > 0;
});

const avgTransaction = expenseTxns.length
    ? expenseTxns.reduce((s,t)=>s+amountOf(t),0) / expenseTxns.length
    : 0;
    return {
        balances,
        totalCash,
        income,
        expense,
        tax,
        netIncomeAfterTax,
        totalAssets,
        totalLiabilities,
        netWorth,
        savingsRate,
        emergencyCoverage,
        MRR,
        topCategory,
        status,
        avgExpense,
avgTransaction,
        lastMonthFlow
    };
}
