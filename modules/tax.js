export function computeTax(income) {
    // simple Indian-style slab logic (editable later)

    if (income <= 250000) return 0;
    if (income <= 500000) return income * 0.05;
    if (income <= 1000000) return income * 0.2;

    return income * 0.3;
}