import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { ApiError } from '../middleware/errorHandler.js';
import { lookupLocalPlaces, LocalPlacesError } from '../services/localPlaces.js';

export const localPlacesRouter = Router();

const localPlacesQuerySchema = z.object({
  address: z.string().trim().min(3).max(300),
});

// Overpass is a shared free service — keep our own callers on a short leash
// on top of the global limiter, same as the other outbound-calling routes.
const localPlacesRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many lookups, please wait a moment and try again' },
});

localPlacesRouter.get(
  '/',
  localPlacesRateLimit,
  validate(localPlacesQuerySchema, 'query'),
  async (req, res) => {
    try {
      res.json(await lookupLocalPlaces(req.query.address));
    } catch (err) {
      if (err instanceof LocalPlacesError) {
        // Upstream/lookup problem, not a bug — the UI renders this as an
        // explicit "couldn't load" state rather than a broken page.
        throw new ApiError(502, err.message);
      }
      throw err;
    }
  }
);
