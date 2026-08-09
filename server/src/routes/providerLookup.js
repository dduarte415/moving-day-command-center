import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { validate } from '../middleware/validate.js';
import { ApiError } from '../middleware/errorHandler.js';
import { providerLookupQuerySchema } from '../schemas/providerLookupSchemas.js';
import { lookupProviders, ProviderLookupFailedError } from '../services/providerLookup.js';

export const providerLookupRouter = Router();

// Stricter than the general /api limiter — this route is the one that can
// burn third-party API quota, so it gets its own tighter budget on top.
const providerLookupRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many lookups, please wait a moment and try again' },
});

providerLookupRouter.get(
  '/',
  providerLookupRateLimit,
  validate(providerLookupQuerySchema, 'query'),
  async (req, res) => {
    const { address, zip } = req.query;
    try {
      const result = await lookupProviders({ address, zip });
      res.json(result);
    } catch (err) {
      if (err instanceof ProviderLookupFailedError) {
        // Distinct from a 500: this is the honest "couldn't retrieve live
        // data and nothing cached to fall back to" state the brief asks
        // for, not a bug — the frontend renders it as a clear error state.
        throw new ApiError(502, err.message);
      }
      throw err;
    }
  }
);
