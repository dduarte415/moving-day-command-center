import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.uuid('Invalid id'),
});

export const createMoveSchema = z.object({
  oldAddress: z.string().trim().min(1).max(300),
  newAddress: z.string().trim().min(1).max(300),
  moveDate: z.coerce.date(),
});

export const updateMoveSchema = createMoveSchema.partial();
