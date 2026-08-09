import { describe, it, expect, vi, beforeEach } from 'vitest';

const findUnique = vi.fn();
const upsert = vi.fn();
vi.mock('../lib/prisma.js', () => ({
  prisma: { providerLookup: { findUnique: (...a) => findUnique(...a), upsert: (...a) => upsert(...a) } },
}));

const fetchProviders = vi.fn();
vi.mock('./providerDataSource.js', () => ({
  getProviderDataSource: () => ({ name: 'mock', fetchProviders: (...a) => fetchProviders(...a) }),
  ProviderUnavailableError: class ProviderUnavailableError extends Error {},
}));

const { lookupProviders, normalizeQuery, hashQuery } = await import('./providerLookup.js');

describe('normalizeQuery / hashQuery', () => {
  it('prefers address over zip when both given, and hashes case-insensitively', () => {
    expect(normalizeQuery({ address: '123 Main St', zip: '90210' })).toEqual({
      type: 'address',
      value: '123 Main St',
    });
    const a = hashQuery({ type: 'zip', value: '90210' });
    const b = hashQuery({ type: 'zip', value: '90210' });
    expect(a).toBe(b);
    expect(hashQuery({ type: 'zip', value: '90210' })).not.toBe(hashQuery({ type: 'zip', value: '90211' }));
  });
});

describe('lookupProviders cache/fallback behavior', () => {
  beforeEach(() => {
    findUnique.mockReset();
    upsert.mockReset();
    fetchProviders.mockReset();
  });

  it('returns a fresh cache hit without calling the data source', async () => {
    findUnique.mockResolvedValue({
      providersJson: { providers: [{ providerName: 'X' }], source: 'mock' },
      fetchedAt: new Date(),
    });

    const result = await lookupProviders({ zip: '90210' });

    expect(result.stale).toBe(false);
    expect(fetchProviders).not.toHaveBeenCalled();
  });

  it('falls back to a stale cached row when the live fetch fails', async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000); // older than the 24h freshness window
    findUnique.mockResolvedValue({
      providersJson: { providers: [{ providerName: 'Cached Co' }], source: 'mock' },
      fetchedAt: oldDate,
    });
    fetchProviders.mockRejectedValue(new Error('upstream down'));

    const result = await lookupProviders({ zip: '90210' });

    expect(result.stale).toBe(true);
    expect(result.providers[0].providerName).toBe('Cached Co');
  });

  it('throws when the live fetch fails and there is no cache at all', async () => {
    findUnique.mockResolvedValue(null);
    fetchProviders.mockRejectedValue(new Error('upstream down'));

    await expect(lookupProviders({ zip: '90210' })).rejects.toThrow();
  });

  it('writes through to the cache on a successful live fetch', async () => {
    findUnique.mockResolvedValue(null);
    fetchProviders.mockResolvedValue([{ providerName: 'Fresh Co' }]);

    const result = await lookupProviders({ zip: '90210' });

    expect(result.stale).toBe(false);
    expect(upsert).toHaveBeenCalledOnce();
  });
});
