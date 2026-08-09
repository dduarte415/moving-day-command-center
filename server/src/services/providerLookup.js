import { createHash } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { geocodeAddress, GeocodingError } from './geocoding.js';
import { getProviderDataSource, ProviderUnavailableError } from './providerDataSource.js';

// How long a cached result is considered fresh before we prefer a live
// refetch. A stale cache entry is still served (with `stale: true`) if the
// live refetch fails — that's the whole point of caching an upstream that
// "they've had versioned endpoints" / can go down.
const CACHE_FRESH_MS = 24 * 60 * 60 * 1000;

export class ProviderLookupFailedError extends Error {}

export function normalizeQuery({ address, zip }) {
  if (address && address.trim()) return { type: 'address', value: address.trim() };
  if (zip && zip.trim()) return { type: 'zip', value: zip.trim() };
  return null;
}

export function hashQuery(query) {
  return createHash('sha256').update(`${query.type}:${query.value.toLowerCase()}`).digest('hex');
}

async function resolveLocation(query) {
  if (query.type === 'zip') {
    return { zip: query.value, matchedAddress: null, blockFips: null };
  }

  let geo;
  try {
    geo = await geocodeAddress(query.value);
  } catch (err) {
    if (err instanceof GeocodingError) {
      throw new ProviderLookupFailedError(`Could not geocode address: ${err.message}`);
    }
    throw err;
  }

  if (!geo) {
    throw new ProviderLookupFailedError('Address not found — check spelling or try a ZIP code');
  }

  return {
    zip: null,
    matchedAddress: geo.matchedAddress,
    blockFips: geo.blockFips,
    lat: geo.lat,
    lon: geo.lon,
  };
}

// Cache-read-through with graceful degradation:
//   1. Fresh cache hit -> return it, no network call.
//   2. Otherwise geocode (if needed) + call the live data source.
//   3. Live call fails -> fall back to *any* cached row (even stale) rather
//      than showing a broken page.
//   4. Nothing live, nothing cached -> throw; the route turns this into the
//      UI's explicit "couldn't retrieve live data" state, per the brief.
export async function lookupProviders({ address, zip }) {
  const query = normalizeQuery({ address, zip });
  if (!query) {
    throw new ProviderLookupFailedError('An address or ZIP code is required');
  }

  const hash = hashQuery(query);
  const cached = await prisma.providerLookup.findUnique({ where: { zipOrAddrHash: hash } });
  const isFresh = cached && Date.now() - cached.fetchedAt.getTime() < CACHE_FRESH_MS;

  if (isFresh) {
    return { ...cached.providersJson, stale: false, fetchedAt: cached.fetchedAt };
  }

  try {
    const location = await resolveLocation(query);
    const dataSource = getProviderDataSource();
    const providers = await dataSource.fetchProviders({
      blockFips: location.blockFips,
      zip: query.type === 'zip' ? query.value : null,
      address: query.type === 'address' ? query.value : null,
    });

    const result = {
      providers,
      source: dataSource.name,
      matchedAddress: location.matchedAddress,
    };

    await prisma.providerLookup.upsert({
      where: { zipOrAddrHash: hash },
      create: { zipOrAddrHash: hash, query: query.value, providersJson: result },
      update: { providersJson: result, fetchedAt: new Date() },
    });

    return { ...result, stale: false, fetchedAt: new Date() };
  } catch (err) {
    if (cached) {
      // Upstream (or geocoding) failed, but we have something to show.
      return { ...cached.providersJson, stale: true, fetchedAt: cached.fetchedAt };
    }
    if (err instanceof ProviderLookupFailedError || err instanceof ProviderUnavailableError) {
      throw new ProviderLookupFailedError(err.message);
    }
    throw err;
  }
}
