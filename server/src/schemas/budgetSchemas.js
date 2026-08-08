import { z } from 'zod';

export const BUDGET_CATEGORIES = ['DEPOSIT', 'MOVERS', 'FURNITURE', 'SUPPLIES', 'OTHER'];

export const listBudgetItemsQuerySchema = z.object({
  moveId: z.uuid('Invalid moveId'),
});

// Amounts arrive as strings (or numbers) and are stored as Prisma Decimal —
// avoids floating point drift on money. Bounded to a sane max so a typo
// can't produce an absurd running total.
const amountSchema = z.coerce
  .number()
  .finite()
  .nonnegative('Amount must be zero or greater')
  .max(1_000_000, 'Amount is unreasonably large')
  .transform((n) => n.toFixed(2));

export const createBudgetItemSchema = z.object({
  moveId: z.uuid('Invalid moveId'),
  label: z.string().trim().min(1).max(200),
  category: z.enum(BUDGET_CATEGORIES),
  amount: amountSchema,
  isPaid: z.boolean().optional().default(false),
});

export const updateBudgetItemSchema = z.object({
  label: z.string().trim().min(1).max(200).optional(),
  category: z.enum(BUDGET_CATEGORIES).optional(),
  amount: amountSchema.optional(),
  isPaid: z.boolean().optional(),
});
