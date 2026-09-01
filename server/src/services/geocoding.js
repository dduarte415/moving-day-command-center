import { OUTBOUND_USER_AGENT } from '../lib/userAgent.js';

// Address -> coordinates + census block FIPS, via the US Census Bureau's
// free, keyless Geocoder. No API key to manage, and it pairs naturally with
// FCC data (the census block FIPS is exactly what BDC keys availability by).
// Docs: https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.pdf

const CENSUS_GEOCODER_URL =
  'https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress';

export class GeocodingError extends Error {}

export async function geocodeAddress(address, { signal } = {}) {
  const url = new URL(CENSUS_GEOCODER_URL);
  url.searchParams.set('address', address);
  url.searchParams.set('benchmark', 'Public_AR_Current');
  url.searchParams.set('vintage', 'Current_Current');
  url.searchParams.set('layers', 'Census Blocks');
  url.searchParams.set('format', 'json');

  let response;
  try {
    response = await fetch(url, { signal });
  } catch (err) {
    throw new GeocodingError(`Geocoding request failed: ${err.message}`);
  }

  if (!response.ok) {
    throw new GeocodingError(`Geocoding service returned ${response.status}`);
  }

  const data = await response.json();
  const match = data?.result?.addressMatches?.[0];
  if (!match) {
    return null; // No match — a real, expected outcome for a bad/partial address.
  }

  const block = match.geographies?.['2020 Census Blocks']?.[0];

  return {
    matchedAddress: match.matchedAddress,
    lat: match.coordinates?.y ?? null,
    lon: match.coordinates?.x ?? null,
    stateFips: block?.STATE ?? null,
    countyFips: block?.STATE && block?.COUNTY ? `${block.STATE}${block.COUNTY}` : null,
    blockFips: block?.GEOID ?? null,
  };
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

async function geocodeViaNominatim(query) {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'us');

  let response;
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': OUTBOUND_USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;

  const data = await response.json().catch(() => null);
  const hit = Array.isArray(data) ? data[0] : null;
  if (!hit) return null;

  return {
    matchedAddress: hit.display_name,
    lat: Number(hit.lat),
    lon: Number(hit.lon),
  };
}

// Best-effort location for "what's near here" style features, where an
// approximate answer beats no answer. Exact street-level geocoding fails
// constantly for legitimate reasons (new construction, rural routes, unit
// numbers, plain typos), and refusing to show anything in those cases makes
// the feature feel broken. So: try precise first, then progressively broader
// (full string -> ZIP -> "City, ST"), reporting which precision was actually
// achieved so the UI can be honest about it.
export async function resolveApproximateLocation(address) {
  const census = await geocodeAddress(address).catch(() => null);
  if (census?.lat != null && census?.lon != null) {
    return { ...census, precision: 'address' };
  }

  const exact = await geocodeViaNominatim(address);
  if (exact) return { ...exact, precision: 'address' };

  const zip = address.match(/\b\d{5}\b/)?.[0];
  if (zip) {
    const byZip = await geocodeViaNominatim(zip);
    if (byZip) return { ...byZip, precision: 'area' };
  }

  // "123 Fake St, Novato, CA 94945" -> "Novato, CA 94945"
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    const byCity = await geocodeViaNominatim(parts.slice(1).join(', '));
    if (byCity) return { ...byCity, precision: 'area' };
  }

  return null;
}
