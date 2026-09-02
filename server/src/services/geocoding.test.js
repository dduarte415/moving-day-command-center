import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveApproximateLocation } from './geocoding.js';
import { OUTBOUND_USER_AGENT } from '../lib/userAgent.js';

// All outbound HTTP is mocked — these tests must never touch live
// Census/Nominatim (slow, rate-limited, and would make the suite flaky).

const censusHit = {
  result: {
    addressMatches: [
      {
        matchedAddress: '1600 PENNSYLVANIA AVE NW, WASHINGTON, DC, 20500',
        coordinates: { x: -77.0353, y: 38.8987 },
        geographies: {
          '2020 Census Blocks': [{ GEOID: '110019800001034', STATE: '11', COUNTY: '001' }],
        },
      },
    ],
  },
};
const censusMiss = { result: { addressMatches: [] } };

const nominatimHit = (name) => [{ display_name: name, lat: '38.1062', lon: '-122.5681' }];

function jsonResponse(body, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body };
}

function isCensus(url) {
  return String(url).includes('geocoding.geo.census.gov');
}

let fetchMock;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveApproximateLocation', () => {
  it('returns address precision (with census block) when Census matches', async () => {
    fetchMock.mockResolvedValue(jsonResponse(censusHit));

    const result = await resolveApproximateLocation('1600 Pennsylvania Ave NW, Washington, DC 20500');

    expect(result.precision).toBe('address');
    expect(result.lat).toBeCloseTo(38.8987, 3);
    // blockFips is what the live FCC provider lookup keys on — it must
    // survive this path, or the real provider integration silently breaks.
    expect(result.blockFips).toBe('110019800001034');
    expect(fetchMock).toHaveBeenCalledTimes(1); // no fallback attempted
  });

  it('falls through to Nominatim (still address precision) when Census finds nothing', async () => {
    fetchMock.mockImplementation(async (url) =>
      isCensus(url) ? jsonResponse(censusMiss) : jsonResponse(nominatimHit('123 Somewhere St, Novato, CA'))
    );

    const result = await resolveApproximateLocation('123 Somewhere St, Novato, CA 94945');

    expect(result.precision).toBe('address');
    expect(result.matchedAddress).toContain('Somewhere');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to ZIP with area precision when both address-level lookups miss', async () => {
    let nominatimCalls = 0;
    fetchMock.mockImplementation(async (url) => {
      if (isCensus(url)) return jsonResponse(censusMiss);
      nominatimCalls += 1;
      // First Nominatim call = full address (miss), second = ZIP (hit).
      return jsonResponse(nominatimCalls === 1 ? [] : nominatimHit('94945, Novato, Marin County, California'));
    });

    const result = await resolveApproximateLocation('456 Fake Ave, Novato, CA 94945');

    expect(result.precision).toBe('area');
    expect(result.matchedAddress).toContain('94945');
  });

  it('falls back to City/ST with area precision when there is no ZIP to try', async () => {
    let nominatimCalls = 0;
    fetchMock.mockImplementation(async (url) => {
      if (isCensus(url)) return jsonResponse(censusMiss);
      nominatimCalls += 1;
      return jsonResponse(nominatimCalls === 1 ? [] : nominatimHit('Novato, Marin County, California'));
    });

    const result = await resolveApproximateLocation('456 Fake Ave, Novato, CA');

    expect(result.precision).toBe('area');
    expect(result.matchedAddress).toContain('Novato');
  });

  it('returns null rather than throwing when every tier fails', async () => {
    fetchMock.mockImplementation(async (url) =>
      isCensus(url) ? jsonResponse(censusMiss) : jsonResponse([])
    );

    await expect(resolveApproximateLocation('nowhere at all')).resolves.toBeNull();
  });

  it('survives a network error from the Census tier and still falls back', async () => {
    fetchMock.mockImplementation(async (url) => {
      if (isCensus(url)) throw new Error('ECONNRESET');
      return jsonResponse(nominatimHit('Novato, California'));
    });

    const result = await resolveApproximateLocation('456 Fake Ave, Novato, CA 94945');
    expect(result.precision).toBe('address');
  });

  // Regression guard: Overpass rejects Node's default fetch User-Agent with a
  // 406, and OSM usage policy asks for an identifiable agent. Easy to drop
  // by accident when refactoring outbound calls.
  it('sends the shared User-Agent on Nominatim requests', async () => {
    fetchMock.mockImplementation(async (url) =>
      isCensus(url) ? jsonResponse(censusMiss) : jsonResponse(nominatimHit('Novato, California'))
    );

    await resolveApproximateLocation('456 Fake Ave, Novato, CA');

    const nominatimCall = fetchMock.mock.calls.find(([url]) => !isCensus(url));
    expect(nominatimCall[1].headers['User-Agent']).toBe(OUTBOUND_USER_AGENT);
  });
});
