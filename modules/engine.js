export function computeFinancials(state) {
    const { assets, liabilities, transactions, accounts, emis } = state;

    // ------------------------
    // INIT
    // ------------------------
    const balances = {};
    accounts.forEach(a => balances[a.id] = 0);

    const sorted = [...transactions].sort((a, b) => {
        const d = new Date(a.date) - new Date(b.date);
        if (d !== 0) return d;
        return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
    });

    // ------------------------
    // TAX RULES (REALISTIC BASE)
    // ------------------------
    const taxRates = {
        salary: 0.2,
        business: 0.25,
        interest: 0.1,
        dividend: 0.1,
        capital_gain: 0.15
    };

    // ------------------------
    // ACCOUNT BALANCE ENGINE
    // ------------------------
    sorted.forEach(t => {
        let acc = t.accountId || accounts[0]?.id;
        if (!acc) return;

        if (balances[acc] === undefined) balances[acc] = 0;

        if (t.type === "income") {
            let net = t.amount;

            const rate = taxRates[t.subtype] ?? 0;
            net = t.amount * (1 - rate);

            balances[acc] += net;
        }

        if (t.type === "expense") balances[acc] -= t.amount;
        if (t.type === "buy") balances[acc] -= t.amount;
        if (t.type === "sell") balances[acc] += t.amount;
    });

    // ------------------------
    // EMI (CASH IMPACT ONLY)
    // ------------------------
    const today = new Date();

    emis.forEach(e => {
    const due = new Date(e.nextDate);

    if (due > today) return;

    if (!balances[e.accountId] && balances[e.accountId] !== 0) return;

    // monthly interest rate
    const r = (e.rate || 0) / 100 / 12;

    const remaining = e.remainingPrincipal ?? e.principal;

    if (!remaining || remaining <= 0) return;

    // interest component
    const interest = remaining * r;

    // principal component
    const principalPaid = e.amount - interest;

    // safety
    if (principalPaid < 0) return;

    // CASH REDUCTION
    balances[e.accountId] -= e.amount;

    // LIABILITY REDUCTION (in-memory)
    e.remainingPrincipal = remaining - principalPaid;
    

    if (e.remainingPrincipal < 0) e.remainingPrincipal = 0;
    updateDoc(doc(db, "profiles", profileId, "emis", e.id), {
    remainingPrincipal: e.remainingPrincipal
});
});

    // ------------------------
    // BANK INTEREST (SAFE)
    // ------------------------
    accounts.forEach(acc => {
        if (acc.type === "bank" && acc.rate) {
            const monthlyRate = acc.rate / 100 / 12;
            balances[acc.id] *= (1 + monthlyRate);
        }
    });

    const totalCash = Object.values(balances).reduce((a, b) => a + b, 0);

    // ------------------------
    // INCOME / TAX BREAKDOWN
    // ------------------------
    let income = 0;
    let expense = 0;
    let tax = 0;

    const incomeBreakdown = {
        salary: 0,
        business: 0,
        interest: 0,
        dividend: 0,
        capital_gain: 0
    };

    transactions.forEach(t => {
        if (t.type === "income") {
            income += t.amount;

            if (t.subtype && incomeBreakdown[t.subtype] !== undefined) {
                incomeBreakdown[t.subtype] += t.amount;

                const rate = taxRates[t.subtype] ?? 0;
                tax += t.amount * rate;
            }
        }

        if (t.type === "expense") expense += t.amount;
    });

    const netIncomeAfterTax = income - tax;

    // ------------------------
    // TRUE MRR (RECURRING ONLY)
    // ------------------------
    const recurringTypes = ["salary", "business"];

    const monthlyRecurring = {};

    transactions.forEach(t => {
        if (t.type !== "income" || !t.date) return;
        if (!recurringTypes.includes(t.subtype)) return;

        const month = new Date(t.date).toISOString().slice(0, 7);

        if (!monthlyRecurring[month]) monthlyRecurring[month] = 0;

        monthlyRecurring[month] += t.amount;
    });

    const months = Object.keys(monthlyRecurring);

    const MRR = months.length > 0
        ? Object.values(monthlyRecurring).reduce((a, b) => a + b, 0) / months.length
        : 0;

    // ------------------------
    // NET WORTH
    // ------------------------
    const totalAssets = assets.reduce((sum, a) => {
        return sum + Number(a.value || 0);
    }, 0);

    const totalLiabilities = liabilities.reduce((sum, l) => {
        return sum + Number(l.value || 0);
    }, 0);

    const netWorth = totalAssets - totalLiabilities;

    // ------------------------
    // RATIOS
    // ------------------------
    const savingsRate = netIncomeAfterTax > 0
        ? (netIncomeAfterTax - expense) / netIncomeAfterTax
        : 0;

    const emergencyCoverage = expense > 0
        ? totalCash / expense
        : 0;

    // ------------------------
    // CATEGORY ANALYSIS
    // ------------------------
    const categoryMap = {};

    transactions.forEach(t => {
        if (t.type !== "expense") return;

        const key = t.subtype || t.category || "other";

        if (!categoryMap[key]) categoryMap[key] = 0;
        categoryMap[key] += t.amount;
    });

    let topCategory = "—";
    let maxSpend = 0;

    Object.entries(categoryMap).forEach(([cat, val]) => {
        if (val > maxSpend) {
            maxSpend = val;
            topCategory = cat;
        }
    });

    // ------------------------
    // STATUS
    // ------------------------
    let status = "Vulnerable";

    if (savingsRate >= 0.4) status = "Strong";
    else if (savingsRate >= 0.15) status = "Stable";

    // ------------------------
    // MONTHLY CASH FLOW
    // ------------------------
    const monthlyIncomeMap = {};
    const monthlyExpenseMap = {};

    transactions.forEach(t => {
        if (!t.date) return;

        const month = new Date(t.date).toISOString().slice(0, 7);

        if (t.type === "income") {
            if (!monthlyIncomeMap[month]) monthlyIncomeMap[month] = 0;
            monthlyIncomeMap[month] += t.amount;
        }

        if (t.type === "expense") {
            if (!monthlyExpenseMap[month]) monthlyExpenseMap[month] = 0;
            monthlyExpenseMap[month] += t.amount;
        }
    });

    const allMonths = new Set([
        ...Object.keys(monthlyIncomeMap),
        ...Object.keys(monthlyExpenseMap)
    ]);

    const monthlyCashflow = {};

    allMonths.forEach(m => {
        const inc = monthlyIncomeMap[m] || 0;
        const exp = monthlyExpenseMap[m] || 0;

        monthlyCashflow[m] = inc - exp;
    });

    const sortedMonths = Object.keys(monthlyCashflow)
        .sort((a, b) => new Date(a) - new Date(b));

    const lastMonth = sortedMonths[sortedMonths.length - 1];
    const lastMonthFlow = lastMonth ? monthlyCashflow[lastMonth] : 0;

    const monthlySavings = netIncomeAfterTax - expense;

    return {
        balances,
        totalCash,

        income,
        tax,
        netIncomeAfterTax,

        expense,
        netWorth,
        savingsRate,
        emergencyCoverage,
        MRR,

        monthlySavings,
        topCategory,
        status,

        lastMonthFlow
    };
}