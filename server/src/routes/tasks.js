import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { ApiError } from '../middleware/errorHandler.js';
import { idParamSchema } from '../schemas/moveSchemas.js';
import { listTasksQuerySchema, createTaskSchema, updateTaskSchema } from '../schemas/taskSchemas.js';
import { createIdempotently, duplicateWindowStart } from '../lib/idempotency.js';

export const tasksRouter = Router();

tasksRouter.get('/', validate(listTasksQuerySchema, 'query'), async (req, res) => {
  const move = await prisma.move.findUnique({ where: { id: req.query.moveId } });
  if (!move) throw new ApiError(404, 'Move not found');

  const tasks = await prisma.task.findMany({
    where: { moveId: req.query.moveId },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
  });
  res.json(tasks);
});

tasksRouter.post('/', validate(createTaskSchema), async (req, res) => {
  const { moveId, title, category, dueDate } = req.body;

  const move = await prisma.move.findUnique({ where: { id: moveId } });
  if (!move) throw new ApiError(404, 'Move not found');

  // Idempotent within a short window — see lib/idempotency.js for why the
  // check and insert have to share a transaction and lock.
  const { record: task, deduped } = await createIdempotently({
    dedupeKey: `task:${moveId}|${title.toLowerCase()}|${category}`,
    findExisting: (tx) =>
      tx.task.findFirst({
        where: { moveId, title, category, createdAt: { gte: duplicateWindowStart() } },
      }),
    create: (tx) => tx.task.create({ data: { moveId, title, category, dueDate: dueDate ?? null } }),
  });

  res.status(deduped ? 200 : 201).json(task);
});

// NOTE: in a multi-user v2, this is where an ownership check belongs —
// `task.move.userId === req.user.id` — not just "does this task exist"
// (security req #8). Single-user MVP has no such check to perform yet.
tasksRouter.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateTaskSchema),
  async (req, res) => {
    const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, 'Task not found');

    const task = await prisma.task.update({ where: { id: req.params.id }, data: req.body });
    res.json(task);
  }
);

tasksRouter.delete('/:id', validate(idParamSchema, 'params'), async (req, res) => {
  const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Task not found');

  await prisma.task.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
