import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { ApiError } from '../middleware/errorHandler.js';
import { idParamSchema } from '../schemas/moveSchemas.js';
import {
  listBudgetItemsQuerySchema,
  createBudgetItemSchema,
  updateBudgetItemSchema,
} from '../schemas/budgetSchemas.js';

export const budgetItemsRouter = Router();

const DUPLICATE_WINDOW_MS = 10_000;

// The frontend may *display* a running total, but it must never be trusted
// as fact (security req #10) — this is the one place totals are computed,
// straight from the DB, and every response includes it.
async function buildSummary(moveId) {
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

budgetItemsRouter.get('/', validate(listBudgetItemsQuerySchema, 'query'), async (req, res) => {
  const { moveId } = req.query;
  const move = await prisma.move.findUnique({ where: { id: moveId } });
  if (!move) throw new ApiError(404, 'Move not found');

  const [items, summary] = await Promise.all([
    prisma.budgetItem.findMany({ where: { moveId }, orderBy: { createdAt: 'asc' } }),
    buildSummary(moveId),
  ]);
  res.json({ items, summary });
});

budgetItemsRouter.post('/', validate(createBudgetItemSchema), async (req, res) => {
  const { moveId, label, category, amount, isPaid } = req.body;

  const move = await prisma.move.findUnique({ where: { id: moveId } });
  if (!move) throw new ApiError(404, 'Move not found');

  const recentDuplicate = await prisma.budgetItem.findFirst({
    where: {
      moveId,
      label,
      category,
      amount,
      createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
    },
  });
  if (recentDuplicate) {
    res.status(200).json({ item: recentDuplicate, summary: await buildSummary(moveId) });
    return;
  }

  const item = await prisma.budgetItem.create({
    data: { moveId, label, category, amount, isPaid },
  });
  res.status(201).json({ item, summary: await buildSummary(moveId) });
});

budgetItemsRouter.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateBudgetItemSchema),
  async (req, res) => {
    const existing = await prisma.budgetItem.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, 'Budget item not found');

    const item = await prisma.budgetItem.update({ where: { id: req.params.id }, data: req.body });
    res.json({ item, summary: await buildSummary(item.moveId) });
  }
);

budgetItemsRouter.delete('/:id', validate(idParamSchema, 'params'), async (req, res) => {
  const existing = await prisma.budgetItem.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Budget item not found');

  await prisma.budgetItem.delete({ where: { id: req.params.id } });
  res.json({ summary: await buildSummary(existing.moveId) });
});
