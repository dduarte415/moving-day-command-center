import 'dotenv/config';

// Centralized, validated access to environment config. Nothing else in the
// app should read process.env directly — this is the one place that does,
// so dev/prod differences and missing-var failures are easy to reason about.

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL'),
  // In production this must be the exact deployed frontend origin — never '*'.
  corsOrigin: required('CORS_ORIGIN', nodeEnv === 'production' ? undefined : 'http://localhost:5173'),
  // Optional: absent until the provider-lookup feature is wired up (step 7).
  bdcApiUsername: process.env.BDC_API_USERNAME ?? null,
  bdcApiToken: process.env.BDC_API_TOKEN ?? null,
};
