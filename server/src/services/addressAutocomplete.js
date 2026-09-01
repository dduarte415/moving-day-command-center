// Address-suggestion source for the "as you type" autocomplete, backed by
// OpenStreetMap's Nominatim — free and keyless, same philosophy as the
// Census Geocoder used for the provider lookup feature (see
// services/geocoding.js). Nominatim's usage policy for the free public
// instance caps at ~1 req/sec and asks for a descriptive User-Agent plus
// caching of results — both handled here, on top of this route's own
// rate limiter (see routes/addressAutocomplete.js).

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'moving-day-command-center (portfolio project; contact via GitHub)';

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map(); // normalized query -> { suggestions, expiresAt }

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.suggestions;
}

function setCached(key, suggestions) {
  cache.set(key, { suggestions, expiresAt: Date.now() + CACHE_TTL_MS });
  // Bound memory use — this is a convenience cache, not the durable one.
  if (cache.size > 500) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
}

export async function suggestAddresses(query) {
  const key = query.trim().toLowerCase();
  const cached = getCached(key);
  if (cached) return cached;

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '5');
  url.searchParams.set('countrycodes', 'us');
  url.searchParams.set('q', key);

  let response;
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return []; // Autocomplete is a convenience — fail quiet, never block typing.
  }

  if (!response.ok) return [];

  const data = await response.json().catch(() => []);
  const suggestions = Array.isArray(data)
    ? data.map((row) => ({ id: row.place_id, label: formatAddress(row) })).filter((s) => s.label)
    : [];

  setCached(key, suggestions);
  return suggestions;
}

// Nominatim's `display_name` is a full administrative hierarchy (house,
// road, neighbourhood, city, county, state, zip, country) — accurate but
// far noisier than the "123 Main St, City, State 12345" shape this app's
// forms actually want. Rebuild a normal-looking address from the
// structured `address` fields instead, falling back to `display_name`
// only if a result doesn't have enough structure to work with.
const STATE_ABBREVIATIONS = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA',
  Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA',
  Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA',
  Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD',
  Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS', Missouri: 'MO',
  Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH',
  Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT',
  Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY',
  'District of Columbia': 'DC',
};

function formatAddress(row) {
  const a = row.address ?? {};
  const street = [a.house_number, a.road].filter(Boolean).join(' ');
  const city = a.city ?? a.town ?? a.village ?? a.hamlet;
  const state = STATE_ABBREVIATIONS[a.state] ?? a.state;
  const zip = a.postcode;

  const line = [street, city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return line || row.display_name || '';
}
