import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.uuid('Invalid id'),
});

export const createMoveSchema = z.object({
  oldAddress: z.string().trim().min(1).max(300),
  newAddress: z.string().trim().min(1).max(300),
  moveDate: z.coerce.date(),
  budgetCap: z.coerce
    .number()
    .finite()
    .nonnegative()
    .max(1_000_000)
    .nullish()
    .transform((n) => (n == null ? n : n.toFixed(2))),
});

export const updateMoveSchema = createMoveSchema.partial();
