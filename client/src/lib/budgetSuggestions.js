// Common moving expenses people forget to budget for, each with a rough
// cost range pulled from typical moving-cost guides — not live data, just
// enough context to help someone size a line item they haven't priced yet.
export const SUGGESTED_BUDGET_ITEMS = [
  { label: 'Professional movers', category: 'MOVERS', hint: 'Often $800–$2,500 depending on distance and load' },
  { label: 'Moving truck rental', category: 'MOVERS', hint: 'Typically $100–$300 per day for a local move' },
  { label: 'Packing supplies', category: 'SUPPLIES', hint: 'Boxes, tape, and padding usually run $50–$150' },
  { label: 'Security deposit', category: 'DEPOSIT', hint: "Commonly one month's rent" },
  { label: 'Move-out cleaning', category: 'SUPPLIES', hint: 'Averages $150–$300 for a full clean' },
  { label: 'Storage unit', category: 'OTHER', hint: '$50–$200 per month depending on size' },
  { label: 'Furniture', category: 'FURNITURE', hint: null },
];

// One short, contextual line — not a wall of advice. Prioritizes whatever
// is most actionable right now: over budget > no cap set yet > no items
// yet > a still-unadded common expense > a generic tip once the basics
// are covered.
export function getBudgetTip({ items, summary }) {
  const hasCap = summary?.budgetCap != null;
  const capExceeded = hasCap && summary.total > summary.budgetCap;

  if (capExceeded) {
    return "You're over your budget cap — check the Furniture and Supplies categories first, they're usually the easiest to trim.";
  }
  if (items.length === 0) {
    return 'Start with your biggest expected cost (usually movers or a truck rental) — it anchors the rest of the budget.';
  }
  if (!hasCap) {
    return 'Set a budget cap from the Moves page to track spending against a target as you add expenses.';
  }

  const labels = new Set(items.map((i) => i.label.toLowerCase()));
  const missing = SUGGESTED_BUDGET_ITEMS.find((s) => !labels.has(s.label.toLowerCase()) && s.hint);
  if (missing) {
    return `Don't forget ${missing.label.toLowerCase()} — ${missing.hint.toLowerCase()}.`;
  }

  return "You've covered the common expenses — nice work staying ahead of moving day.";
}
