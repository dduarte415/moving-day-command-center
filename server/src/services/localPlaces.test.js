import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OUTBOUND_USER_AGENT } from '../lib/userAgent.js';

const findUnique = vi.fn();
const upsert = vi.fn();
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    placeLookup: {
      findUnique: (...a) => findUnique(...a),
      upsert: (...a) => upsert(...a),
    },
  },
}));

const resolveApproximateLocation = vi.fn();
vi.mock('./geocoding.js', () => ({
  resolveApproximateLocation: (...a) => resolveApproximateLocation(...a),
}));

const { lookupLocalPlaces, LocalPlacesError } = await import('./localPlaces.js');

// Novato-ish origin; offsets below are ~0.0145 deg lat per mile.
const ORIGIN = { lat: 38.1074, lon: -122.5697, matchedAddress: 'Novato, CA', precision: 'address' };

function node(id, tags, latOffset = 0) {
  return { type: 'node', id, lat: ORIGIN.lat + latOffset, lon: ORIGIN.lon, tags };
}

function overpassResponse(elements) {
  return { ok: true, status: 200, json: async () => ({ elements }) };
}

let fetchMock;
beforeEach(() => {
  findUnique.mockReset();
  upsert.mockReset();
  resolveApproximateLocation.mockReset();
  resolveApproximateLocation.mockResolvedValue(ORIGIN);
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function groupFor(result, key) {
  return result.groups.find((g) => g.key === key);
}

describe('lookupLocalPlaces result shaping', () => {
  it('drops unnamed POIs', async () => {
    findUnique.mockResolvedValue(null);
    fetchMock.mockResolvedValue(
      overpassResponse([
        node(1, { amenity: 'restaurant', name: 'Named Diner' }),
        node(2, { amenity: 'restaurant' }), // no name — noise in a "what's nearby" list
      ])
    );

    const result = await lookupLocalPlaces('456 Fake Ave, Novato, CA');
    const food = groupFor(result, 'food');

    expect(food.places).toHaveLength(1);
    expect(food.places[0].name).toBe('Named Diner');
  });

  it('sorts nearest-first and computes distance in miles', async () => {
    findUnique.mockResolvedValue(null);
    fetchMock.mockResolvedValue(
      overpassResponse([
        node(1, { amenity: 'restaurant', name: 'Far' }, 0.0145 * 3), // ~3 mi
        node(2, { amenity: 'restaurant', name: 'Near' }, 0.0145 * 1), // ~1 mi
      ])
    );

    const result = await lookupLocalPlaces('456 Fake Ave, Novato, CA');
    const food = groupFor(result, 'food');

    expect(food.places.map((p) => p.name)).toEqual(['Near', 'Far']);
    expect(food.places[0].distanceMi).toBeCloseTo(1, 0);
    expect(food.places[1].distanceMi).toBeCloseTo(3, 0);
  });

  it('caps each category so a dense one cannot crowd out the others', async () => {
    findUnique.mockResolvedValue(null);
    const manyRestaurants = Array.from({ length: 30 }, (_, i) =>
      node(100 + i, { amenity: 'restaurant', name: `Diner ${i}` }, 0.0145 * (i + 1))
    );
    fetchMock.mockResolvedValue(
      overpassResponse([...manyRestaurants, node(999, { leisure: 'park', name: 'Solo Park' })])
    );

    const result = await lookupLocalPlaces('456 Fake Ave, Novato, CA');

    expect(groupFor(result, 'food').places.length).toBeLessThanOrEqual(8);
    // The whole point of the cap: the sparse category still survives.
    expect(groupFor(result, 'parks').places).toHaveLength(1);
  });

  it('categorizes a pilates studio as fitness rather than falling through', async () => {
    findUnique.mockResolvedValue(null);
    fetchMock.mockResolvedValue(
      overpassResponse([node(1, { leisure: 'fitness_centre', sport: 'pilates', name: 'Club Pilates' })])
    );

    const result = await lookupLocalPlaces('456 Fake Ave, Novato, CA');
    expect(groupFor(result, 'fitness').places[0].name).toBe('Club Pilates');
  });

  it('omits categories that returned nothing', async () => {
    findUnique.mockResolvedValue(null);
    fetchMock.mockResolvedValue(overpassResponse([node(1, { leisure: 'park', name: 'Only Park' })]));

    const result = await lookupLocalPlaces('456 Fake Ave, Novato, CA');

    expect(result.groups.map((g) => g.key)).toEqual(['parks']);
  });

  // Regression guard: Overpass answers Node's default fetch UA with a 406.
  it('sends the shared User-Agent to Overpass', async () => {
    findUnique.mockResolvedValue(null);
    fetchMock.mockResolvedValue(overpassResponse([node(1, { leisure: 'park', name: 'P' })]));

    await lookupLocalPlaces('456 Fake Ave, Novato, CA');

    expect(fetchMock.mock.calls[0][1].headers['User-Agent']).toBe(OUTBOUND_USER_AGENT);
  });
});

describe('lookupLocalPlaces cache behavior', () => {
  it('serves a fresh cache hit without calling Overpass', async () => {
    findUnique.mockResolvedValue({
      placesJson: { groups: [{ key: 'parks', label: 'Parks & Recreation', places: [] }] },
      fetchedAt: new Date(),
    });

    const result = await lookupLocalPlaces('456 Fake Ave, Novato, CA');

    expect(result.stale).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(resolveApproximateLocation).not.toHaveBeenCalled();
  });

  it('refetches when the cached entry is older than the freshness window', async () => {
    findUnique.mockResolvedValue({
      placesJson: { groups: [] },
      fetchedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // > 7d TTL
    });
    fetchMock.mockResolvedValue(overpassResponse([node(1, { leisure: 'park', name: 'Fresh Park' })]));

    const result = await lookupLocalPlaces('456 Fake Ave, Novato, CA');

    expect(fetchMock).toHaveBeenCalled();
    expect(result.stale).toBe(false);
    expect(groupFor(result, 'parks').places[0].name).toBe('Fresh Park');
  });

  it('writes through to the cache after a successful live fetch', async () => {
    findUnique.mockResolvedValue(null);
    fetchMock.mockResolvedValue(overpassResponse([node(1, { leisure: 'park', name: 'P' })]));

    await lookupLocalPlaces('456 Fake Ave, Novato, CA');

    expect(upsert).toHaveBeenCalledOnce();
  });

  it('falls back to stale cached data when Overpass fails', async () => {
    const staleDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    findUnique.mockResolvedValue({
      placesJson: { groups: [{ key: 'parks', label: 'Parks & Recreation', places: [{ name: 'Cached Park' }] }] },
      fetchedAt: staleDate,
    });
    fetchMock.mockResolvedValue({ ok: false, status: 504, json: async () => ({}) });

    const result = await lookupLocalPlaces('456 Fake Ave, Novato, CA');

    expect(result.stale).toBe(true);
    expect(result.groups[0].places[0].name).toBe('Cached Park');
  });

  it('throws a typed error when the lookup fails with no cache to fall back on', async () => {
    findUnique.mockResolvedValue(null);
    fetchMock.mockResolvedValue({ ok: false, status: 504, json: async () => ({}) });

    await expect(lookupLocalPlaces('456 Fake Ave, Novato, CA')).rejects.toBeInstanceOf(LocalPlacesError);
  });

  it('throws a typed error when the address cannot be located at all', async () => {
    findUnique.mockResolvedValue(null);
    resolveApproximateLocation.mockResolvedValue(null);

    await expect(lookupLocalPlaces('nowhere')).rejects.toBeInstanceOf(LocalPlacesError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
