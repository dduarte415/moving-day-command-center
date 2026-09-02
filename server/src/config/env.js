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
const isProduction = nodeEnv === 'production';

// A present-but-permissive CORS_ORIGIN is the same vulnerability as a missing
// one, so production checks the value, not just that it was set. Locking CORS
// to the real frontend origin is only meaningful if '*' can't slip through.
function requireStrictOrigin(value) {
  if (!isProduction) return value;

  const origin = String(value).trim();
  if (origin === '*' || origin === '' || origin.includes('*')) {
    throw new Error(
      `CORS_ORIGIN must be an exact frontend origin in production, not a wildcard (got: ${origin})`
    );
  }
  if (!/^https?:\/\/[^/\s]+$/.test(origin)) {
    throw new Error(
      `CORS_ORIGIN must be a bare origin like https://app.example.com (got: ${origin})`
    );
  }
  if (origin.startsWith('http://')) {
    throw new Error(`CORS_ORIGIN must use https in production (got: ${origin})`);
  }
  return origin;
}

export const env = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL'),
  // In production this must be the exact deployed frontend origin — never '*'.
  corsOrigin: requireStrictOrigin(
    required('CORS_ORIGIN', isProduction ? undefined : 'http://localhost:5173')
  ),
  // Optional: absent until the provider-lookup feature is wired up (step 7).
  bdcApiUsername: process.env.BDC_API_USERNAME ?? null,
  bdcApiToken: process.env.BDC_API_TOKEN ?? null,
};
