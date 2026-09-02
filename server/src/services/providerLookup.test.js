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

const resolveApproximateLocation = vi.fn();
vi.mock('./geocoding.js', () => ({
  resolveApproximateLocation: (...a) => resolveApproximateLocation(...a),
}));

const { lookupProviders, normalizeQuery, hashQuery, ProviderLookupFailedError } = await import(
  './providerLookup.js'
);

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
    resolveApproximateLocation.mockReset();
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

// Regression coverage for the bug the "Your New Area" page surfaced: the
// address path used to call the Census geocoder directly and 502 on any
// address Census couldn't pin — including the app's own demo address. It now
// goes through resolveApproximateLocation, which degrades to area precision.
describe('lookupProviders address path (geocoding fallback)', () => {
  beforeEach(() => {
    findUnique.mockReset();
    upsert.mockReset();
    fetchProviders.mockReset();
    resolveApproximateLocation.mockReset();
  });

  it('succeeds with area-level results when the exact address cannot be pinned', async () => {
    findUnique.mockResolvedValue(null);
    // No blockFips — exactly what an area-level (ZIP/city) match looks like.
    resolveApproximateLocation.mockResolvedValue({
      matchedAddress: '94945, Novato, Marin County, California',
      lat: 38.1096,
      lon: -122.5731,
      precision: 'area',
    });
    fetchProviders.mockResolvedValue([{ providerName: 'Metro Fiber Co', technology: 'Fiber' }]);

    const result = await lookupProviders({ address: '456 Fake Ave, Novato, CA 94945' });

    expect(result.providers).toHaveLength(1);
    expect(result.matchedAddress).toContain('94945');
    expect(fetchProviders).toHaveBeenCalledWith(
      expect.objectContaining({ blockFips: null, address: '456 Fake Ave, Novato, CA 94945' })
    );
  });

  it('passes the census block through when the address resolves precisely', async () => {
    findUnique.mockResolvedValue(null);
    resolveApproximateLocation.mockResolvedValue({
      matchedAddress: '1600 PENNSYLVANIA AVE NW, WASHINGTON, DC, 20500',
      lat: 38.8987,
      lon: -77.0353,
      blockFips: '110019800001034',
      precision: 'address',
    });
    fetchProviders.mockResolvedValue([{ providerName: 'Metro Fiber Co' }]);

    await lookupProviders({ address: '1600 Pennsylvania Ave NW, Washington, DC 20500' });

    // The live FCC data source keys on blockFips — losing it here would
    // silently break real provider lookups once credentials are configured.
    expect(fetchProviders).toHaveBeenCalledWith(
      expect.objectContaining({ blockFips: '110019800001034' })
    );
  });

  it('still reports a clean failure when the address cannot be located at all', async () => {
    findUnique.mockResolvedValue(null);
    resolveApproximateLocation.mockResolvedValue(null);

    await expect(
      lookupProviders({ address: 'definitely not a place' })
    ).rejects.toBeInstanceOf(ProviderLookupFailedError);
    expect(fetchProviders).not.toHaveBeenCalled();
  });
});
