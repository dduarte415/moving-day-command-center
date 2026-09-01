import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { validate } from '../middleware/validate.js';
import { addressAutocompleteQuerySchema } from '../schemas/addressAutocompleteSchemas.js';
import { suggestAddresses } from '../services/addressAutocomplete.js';

export const addressAutocompleteRouter = Router();

// Typing triggers a request per keystroke (debounced client-side, but don't
// rely on that alone) — its own tighter budget on top of the global limiter,
// same pattern as provider-lookup.
const autocompleteRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

addressAutocompleteRouter.get(
  '/',
  autocompleteRateLimit,
  validate(addressAutocompleteQuerySchema, 'query'),
  async (req, res) => {
    const suggestions = await suggestAddresses(req.query.q);
    res.json({ suggestions });
  }
);
