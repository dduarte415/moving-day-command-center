import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { env } from './config/env.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { movesRouter } from './routes/moves.js';
import { tasksRouter } from './routes/tasks.js';
import { budgetItemsRouter } from './routes/budgetItems.js';
import { providerLookupRouter } from './routes/providerLookup.js';
import { addressAutocompleteRouter } from './routes/addressAutocomplete.js';
import { localPlacesRouter } from './routes/localPlaces.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigin,
    })
  );
  app.use(express.json());

  // Applies to every /api route. Individual routers can layer stricter
  // limits on top (e.g. the provider-lookup endpoint, which calls out to
  // rate-limited third-party APIs).
  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', env: env.nodeEnv });
  });

  // Feature routers are mounted here as they're built (moves, tasks,
  // budget-items, provider-lookup) — always before the 404 catch-all below.
  app.use('/api/moves', movesRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/budget-items', budgetItemsRouter);
  app.use('/api/provider-lookup', providerLookupRouter);
  app.use('/api/address-autocomplete', addressAutocompleteRouter);
  app.use('/api/local-places', localPlacesRouter);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
