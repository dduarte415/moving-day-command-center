import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// env.js reads process.env at import time, so each case needs a fresh module
// registry with the environment already set.
async function loadEnv({ nodeEnv, corsOrigin }) {
  vi.resetModules();
  process.env.NODE_ENV = nodeEnv;
  process.env.DATABASE_URL = 'postgresql://user@host:5432/db';
  if (corsOrigin === undefined) delete process.env.CORS_ORIGIN;
  else process.env.CORS_ORIGIN = corsOrigin;
  return (await import('./env.js')).env;
}

const original = { ...process.env };
beforeEach(() => vi.resetModules());
afterEach(() => {
  process.env = { ...original };
});

describe('CORS_ORIGIN validation in production', () => {
  // A present-but-permissive value is the same hole as a missing one, so the
  // guard has to check the value rather than just its presence.
  it.each([
    ['*', 'bare wildcard'],
    ['', 'empty string'],
    ['   ', 'whitespace only'],
    ['https://*.onrender.com', 'wildcard subdomain'],
    ['http://app.onrender.com', 'plain http'],
    ['https://app.onrender.com/path', 'has a path'],
    ['app.onrender.com', 'missing scheme'],
    ['not a url at all', 'not a URL'],
  ])('refuses to boot with CORS_ORIGIN=%j (%s)', async (corsOrigin) => {
    await expect(loadEnv({ nodeEnv: 'production', corsOrigin })).rejects.toThrow(/CORS_ORIGIN/);
  });

  it('refuses to boot when CORS_ORIGIN is missing entirely', async () => {
    await expect(loadEnv({ nodeEnv: 'production', corsOrigin: undefined })).rejects.toThrow(
      /CORS_ORIGIN/
    );
  });

  it('boots with an exact https origin', async () => {
    const env = await loadEnv({
      nodeEnv: 'production',
      corsOrigin: 'https://moving-day-app.onrender.com',
    });
    expect(env.corsOrigin).toBe('https://moving-day-app.onrender.com');
    expect(env.isProduction).toBe(true);
  });
});

describe('development config', () => {
  it('falls back to the local frontend origin', async () => {
    const env = await loadEnv({ nodeEnv: 'development', corsOrigin: undefined });
    expect(env.corsOrigin).toBe('http://localhost:5173');
  });

  // The strict-origin rules are production-only; local http must keep working.
  it('allows plain http locally', async () => {
    const env = await loadEnv({ nodeEnv: 'development', corsOrigin: 'http://localhost:3000' });
    expect(env.corsOrigin).toBe('http://localhost:3000');
  });
});
