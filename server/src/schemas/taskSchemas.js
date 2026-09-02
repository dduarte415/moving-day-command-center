import { z } from 'zod';
import { calendarDateSchema } from './calendarDate.js';

export const TASK_CATEGORIES = ['BEFORE_MOVE', 'MOVING_DAY', 'AFTER_MOVE'];

export const listTasksQuerySchema = z.object({
  moveId: z.uuid('Invalid moveId'),
});

export const createTaskSchema = z.object({
  moveId: z.uuid('Invalid moveId'),
  title: z.string().trim().min(1).max(200),
  category: z.enum(TASK_CATEGORIES),
  dueDate: calendarDateSchema.nullish(),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  category: z.enum(TASK_CATEGORIES).optional(),
  dueDate: calendarDateSchema.nullish(),
  isComplete: z.boolean().optional(),
});
