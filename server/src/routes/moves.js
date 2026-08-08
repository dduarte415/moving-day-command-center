import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { ApiError } from '../middleware/errorHandler.js';
import { createMoveSchema, updateMoveSchema, idParamSchema } from '../schemas/moveSchemas.js';
import { buildDefaultTasksForMove } from '../lib/defaultTasks.js';

export const movesRouter = Router();

movesRouter.get('/', async (req, res) => {
  const moves = await prisma.move.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(moves);
});

movesRouter.get('/:id', validate(idParamSchema, 'params'), async (req, res) => {
  const move = await prisma.move.findUnique({ where: { id: req.params.id } });
  if (!move) throw new ApiError(404, 'Move not found');
  res.json(move);
});

// Deliberately simple (per the project brief: moves are basic CRUD, not the
// hard part). The one bit of behavior worth calling out: creating a move
// also seeds the default task checklist in the same transaction, so the
// user never lands on an empty checklist.
movesRouter.post('/', validate(createMoveSchema), async (req, res) => {
  const { oldAddress, newAddress, moveDate, budgetCap } = req.body;
  const move = await prisma.move.create({
    data: {
      oldAddress,
      newAddress,
      moveDate,
      budgetCap,
      tasks: { create: buildDefaultTasksForMove(moveDate) },
    },
  });
  res.status(201).json(move);
});

movesRouter.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateMoveSchema),
  async (req, res) => {
    const existing = await prisma.move.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, 'Move not found');

    const move = await prisma.move.update({ where: { id: req.params.id }, data: req.body });
    res.json(move);
  }
);

movesRouter.delete('/:id', validate(idParamSchema, 'params'), async (req, res) => {
  const existing = await prisma.move.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Move not found');

  await prisma.move.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
