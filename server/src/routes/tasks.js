import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { ApiError } from '../middleware/errorHandler.js';
import { idParamSchema } from '../schemas/moveSchemas.js';
import { listTasksQuerySchema, createTaskSchema, updateTaskSchema } from '../schemas/taskSchemas.js';

export const tasksRouter = Router();

// Window within which an identical (moveId, title, category) create is
// treated as a duplicate submission rather than a new task — covers the
// double-click / slow-network-retry case (security req #9) without
// permanently blocking a legitimately reused title.
const DUPLICATE_WINDOW_MS = 10_000;

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

  const recentDuplicate = await prisma.task.findFirst({
    where: {
      moveId,
      title,
      category,
      createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
    },
  });
  if (recentDuplicate) {
    res.status(200).json(recentDuplicate);
    return;
  }

  const task = await prisma.task.create({
    data: { moveId, title, category, dueDate: dueDate ?? null },
  });
  res.status(201).json(task);
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
