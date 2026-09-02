import { describe, it, expect } from 'vitest';
import { getBudgetTip, SUGGESTED_BUDGET_ITEMS } from './budgetSuggestions';

const item = (label, overrides = {}) => ({ label, category: 'OTHER', amount: '10.00', isPaid: false, ...overrides });

describe('getBudgetTip', () => {
  it('leads with going over budget, ahead of every other tip', () => {
    const tip = getBudgetTip({
      items: [item('Movers')],
      summary: { total: 3200, paidTotal: 0, unpaidTotal: 3200, budgetCap: 3000 },
    });
    expect(tip).toMatch(/over your budget cap/i);
  });

  it('suggests anchoring with the biggest cost when there is nothing yet', () => {
    const tip = getBudgetTip({ items: [], summary: { total: 0, budgetCap: null } });
    expect(tip).toMatch(/biggest expected cost/i);
  });

  it('nudges toward setting a cap once items exist but no cap does', () => {
    const tip = getBudgetTip({ items: [item('Movers')], summary: { total: 800, budgetCap: null } });
    expect(tip).toMatch(/set a budget cap/i);
  });

  it('names a common expense the user has not added yet', () => {
    const tip = getBudgetTip({
      items: [item('Professional movers')],
      summary: { total: 800, budgetCap: 3000 },
    });
    // First suggestion with a hint that isn't already covered.
    expect(tip).toMatch(/moving truck rental/i);
  });

  it('matches existing items case-insensitively so a tip is not repeated', () => {
    const covered = SUGGESTED_BUDGET_ITEMS.filter((s) => s.hint).map((s) => item(s.label.toUpperCase()));
    const tip = getBudgetTip({ items: covered, summary: { total: 100, budgetCap: 3000 } });
    expect(tip).toMatch(/covered the common expenses/i);
  });

  it('never suggests the hint-less catch-all category as a missing expense', () => {
    const withoutHint = SUGGESTED_BUDGET_ITEMS.find((s) => !s.hint);
    const covered = SUGGESTED_BUDGET_ITEMS.filter((s) => s.hint).map((s) => item(s.label));
    const tip = getBudgetTip({ items: covered, summary: { total: 100, budgetCap: 3000 } });
    expect(tip).not.toMatch(new RegExp(withoutHint.label, 'i'));
  });
});
