import { z } from 'zod';

export const providerLookupQuerySchema = z
  .object({
    address: z.string().trim().min(3).max(300).optional(),
    zip: z
      .string()
      .trim()
      .regex(/^\d{5}$/, 'ZIP must be 5 digits')
      .optional(),
  })
  .refine((data) => data.address || data.zip, {
    message: 'An address or ZIP code is required',
  });
