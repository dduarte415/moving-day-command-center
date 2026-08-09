import { prisma } from '../lib/prisma.js';

// The frontend may *display* a running total, but it must never be trusted
// as fact (security req #10) — this is the one place totals are computed,
// straight from the DB, and every budget-item response includes it.
export async function buildBudgetSummary(moveId) {
  const [move, items] = await Promise.all([
    prisma.move.findUnique({ where: { id: moveId } }),
    prisma.budgetItem.findMany({ where: { moveId } }),
  ]);

  const total = items.reduce((sum, item) => sum + Number(item.amount), 0);
  const paidTotal = items
    .filter((item) => item.isPaid)
    .reduce((sum, item) => sum + Number(item.amount), 0);

  return {
    total: Number(total.toFixed(2)),
    paidTotal: Number(paidTotal.toFixed(2)),
    unpaidTotal: Number((total - paidTotal).toFixed(2)),
    budgetCap: move?.budgetCap != null ? Number(move.budgetCap) : null,
  };
}
