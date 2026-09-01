import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.uuid('Invalid id'),
});

const moneySchema = z.coerce
  .number()
  .finite()
  .nonnegative()
  .max(1_000_000)
  .nullish()
  .transform((n) => (n == null ? n : n.toFixed(2)));

export const createMoveSchema = z.object({
  oldAddress: z.string().trim().min(1).max(300),
  newAddress: z.string().trim().min(1).max(300),
  moveDate: z.coerce.date(),
  budgetCap: moneySchema,
  // Power the "leftover after rent" tracker on the Budget page.
  monthlyIncome: moneySchema,
  monthlyRent: moneySchema,
});

export const updateMoveSchema = createMoveSchema.partial();
