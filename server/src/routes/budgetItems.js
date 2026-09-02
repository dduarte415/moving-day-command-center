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
import { buildBudgetSummary as buildSummary } from '../services/budgetSummary.js';
import { createIdempotently, duplicateWindowStart } from '../lib/idempotency.js';

export const budgetItemsRouter = Router();

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

  // Idempotent within a short window — see lib/idempotency.js.
  const { record: item, deduped } = await createIdempotently({
    dedupeKey: `budget:${moveId}|${label.toLowerCase()}|${category}|${amount}`,
    findExisting: (tx) =>
      tx.budgetItem.findFirst({
        where: { moveId, label, category, amount, createdAt: { gte: duplicateWindowStart() } },
      }),
    create: (tx) => tx.budgetItem.create({ data: { moveId, label, category, amount, isPaid } }),
  });

  res.status(deduped ? 200 : 201).json({ item, summary: await buildSummary(moveId) });
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
