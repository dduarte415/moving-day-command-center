import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { buildBudgetSummary } from './budgetSummary.js';

// Integration test against the local dev Postgres (same one `npm run dev`
// uses) — creates and cleans up its own move, so it's safe to run alongside
// manual testing. Requires DATABASE_URL to point at a reachable Postgres.
describe('buildBudgetSummary', () => {
  let moveId;

  afterAll(async () => {
    if (moveId) await prisma.move.delete({ where: { id: moveId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('recomputes total/paidTotal/unpaidTotal from the DB, not client input', async () => {
    const move = await prisma.move.create({
      data: {
        oldAddress: 'test old',
        newAddress: 'test new',
        moveDate: new Date('2026-09-15'),
        budgetCap: '2000.00',
      },
    });
    moveId = move.id;

    await prisma.budgetItem.createMany({
      data: [
        { moveId, label: 'Deposit', category: 'DEPOSIT', amount: '500.00', isPaid: true },
        { moveId, label: 'Movers', category: 'MOVERS', amount: '750.50', isPaid: false },
        { moveId, label: 'Boxes', category: 'SUPPLIES', amount: '49.99', isPaid: true },
      ],
    });

    const summary = await buildBudgetSummary(moveId);

    expect(summary.total).toBeCloseTo(1300.49, 2);
    expect(summary.paidTotal).toBeCloseTo(549.99, 2);
    expect(summary.unpaidTotal).toBeCloseTo(750.5, 2);
    expect(summary.budgetCap).toBe(2000);
  });

  it('returns zeroes for a move with no budget items', async () => {
    const move = await prisma.move.create({
      data: { oldAddress: 'a', newAddress: 'b', moveDate: new Date('2026-01-01') },
    });

    const summary = await buildBudgetSummary(move.id);
    expect(summary).toEqual({ total: 0, paidTotal: 0, unpaidTotal: 0, budgetCap: null });

    await prisma.move.delete({ where: { id: move.id } });
  });
});
