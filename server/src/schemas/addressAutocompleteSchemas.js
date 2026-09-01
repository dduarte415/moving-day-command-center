import { z } from 'zod';

export const addressAutocompleteQuerySchema = z.object({
  q: z.string().trim().min(3, 'Type at least 3 characters').max(200),
});
