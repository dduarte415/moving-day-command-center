// "What's around my new place?" — gyms, studios, food, shops, and parks near
// the destination address. Backed by OpenStreetMap's Overpass API: free,
// keyless, and the same OSM ecosystem already used for address autocomplete.
//
// Overpass is genuinely slow (multi-second) and rate-limited, so results are
// cached in Postgres rather than in memory — the cache survives the free-tier
// dyno spin-downs that would otherwise make every first visit slow, and it
// doubles as the fallback when Overpass is unreachable (same read-through +
// stale-fallback contract as services/providerLookup.js).

import { createHash } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { resolveApproximateLocation } from './geocoding.js';
import { OUTBOUND_USER_AGENT } from '../lib/userAgent.js';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const SEARCH_RADIUS_M = 8000; // ~5 miles
const CACHE_FRESH_MS = 7 * 24 * 60 * 60 * 1000; // POIs change slowly
const MAX_PER_CATEGORY = 8;

export class LocalPlacesError extends Error {}

// Each category declares the OSM tag filters that feed it. Order matters:
// categorize() takes the first match, so more specific categories (a pilates
// studio) must precede broader ones (a generic gym).
const CATEGORIES = [
  {
    key: 'fitness',
    label: 'Fitness & Classes',
    filters: [
      'nwr["leisure"="fitness_centre"]',
      'nwr["leisure"="dance"]',
      'nwr["amenity"="dancing_school"]',
      'nwr["leisure"="sports_centre"]',
      'nwr["sport"~"yoga|pilates|dance|climbing|martial_arts"]',
    ],
    matches: (t) =>
      t.leisure === 'fitness_centre' ||
      t.leisure === 'dance' ||
      t.leisure === 'sports_centre' ||
      t.amenity === 'dancing_school' ||
      Boolean(t.sport),
  },
  {
    key: 'food',
    label: 'Restaurants & Cafés',
    filters: ['nwr["amenity"~"^(restaurant|cafe)$"]'],
    matches: (t) => t.amenity === 'restaurant' || t.amenity === 'cafe',
  },
  {
    key: 'shopping',
    label: 'Shopping & Groceries',
    filters: ['nwr["shop"~"^(supermarket|mall|department_store|convenience|bakery|greengrocer)$"]'],
    matches: (t) => Boolean(t.shop),
  },
  {
    key: 'parks',
    label: 'Parks & Recreation',
    filters: ['nwr["leisure"~"^(park|playground|garden)$"]'],
    matches: (t) => ['park', 'playground', 'garden'].includes(t.leisure),
  },
];

function buildQuery(lat, lon) {
  const filters = CATEGORIES.flatMap((c) => c.filters)
    .map((f) => `  ${f}(around:${SEARCH_RADIUS_M},${lat},${lon});`)
    .join('\n');
  // `out center` gives ways/relations a coordinate; nodes already have one.
  return `[out:json][timeout:25];\n(\n${filters}\n);\nout center 400;`;
}

// Straight-line distance in miles. Deliberately not driving distance — that
// needs a routing service; "0.8 mi away" is honest enough for orientation.
function distanceMiles(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function categorize(tags) {
  return CATEGORIES.find((c) => c.matches(tags))?.key ?? null;
}

// Turn a raw OSM element into the shape the UI renders, or null to drop it.
function toPlace(element, originLat, originLon) {
  const tags = element.tags ?? {};
  if (!tags.name) return null; // unnamed POIs are noise in a "what's nearby" list

  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (lat == null || lon == null) return null;

  const category = categorize(tags);
  if (!category) return null;

  // A short descriptor: cuisine for food, sport for studios, shop type otherwise.
  const detail = tags.cuisine ?? tags.sport ?? tags.shop ?? tags.leisure ?? tags.amenity ?? null;

  return {
    id: `${element.type}/${element.id}`,
    name: tags.name,
    category,
    detail: detail ? String(detail).replace(/[_;]/g, ' ').trim() : null,
    distanceMi: Number(distanceMiles(originLat, originLon, lat, lon).toFixed(1)),
    website: tags.website ?? tags['contact:website'] ?? null,
    openingHours: tags.opening_hours ?? null,
  };
}

async function fetchFromOverpass(lat, lon) {
  let response;
  try {
    response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', 'User-Agent': OUTBOUND_USER_AGENT },
      body: buildQuery(lat, lon),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    throw new LocalPlacesError(`Places lookup failed: ${err.message}`);
  }

  if (!response.ok) {
    throw new LocalPlacesError(`Places service returned ${response.status}`);
  }

  const data = await response.json().catch(() => null);
  const elements = Array.isArray(data?.elements) ? data.elements : [];

  const places = elements
    .map((el) => toPlace(el, lat, lon))
    .filter(Boolean)
    .sort((a, b) => a.distanceMi - b.distanceMi);

  // Group into the declared categories, nearest first, capped so one dense
  // category (restaurants, always) can't bury the others.
  return CATEGORIES.map(({ key, label }) => ({
    key,
    label,
    places: places.filter((p) => p.category === key).slice(0, MAX_PER_CATEGORY),
  })).filter((group) => group.places.length > 0);
}

export async function lookupLocalPlaces(address) {
  const query = address?.trim();
  if (!query) throw new LocalPlacesError('An address is required');

  const hash = createHash('sha256').update(query.toLowerCase()).digest('hex');
  const cached = await prisma.placeLookup.findUnique({ where: { addressHash: hash } });
  const isFresh = cached && Date.now() - cached.fetchedAt.getTime() < CACHE_FRESH_MS;

  if (isFresh) {
    return { ...cached.placesJson, stale: false, fetchedAt: cached.fetchedAt };
  }

  try {
    const geo = await resolveApproximateLocation(query);
    if (!geo) {
      throw new LocalPlacesError('Could not locate that address — try a nearby ZIP or a simpler address');
    }

    const groups = await fetchFromOverpass(geo.lat, geo.lon);
    const result = { groups, matchedAddress: geo.matchedAddress, precision: geo.precision };

    await prisma.placeLookup.upsert({
      where: { addressHash: hash },
      create: { addressHash: hash, query, placesJson: result },
      update: { placesJson: result, fetchedAt: new Date() },
    });

    return { ...result, stale: false, fetchedAt: new Date() };
  } catch (err) {
    // Same graceful-degradation contract as the provider lookup: a stale
    // cached answer beats an error page.
    if (cached) {
      return { ...cached.placesJson, stale: true, fetchedAt: cached.fetchedAt };
    }
    throw err instanceof LocalPlacesError ? err : new LocalPlacesError(err.message);
  }
}
