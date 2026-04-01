export function classifyTransaction(t) {
    if (t.type === "income") return "income";
    if (t.type === "expense") return "expense";
    if (t.type === "buy") return "investment";
    if (t.type === "sell") return "liquidation";
    return "other";
}