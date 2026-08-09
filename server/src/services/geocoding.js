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
