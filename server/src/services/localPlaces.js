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

// Overpass is a volunteer-run service and the main endpoint refuses traffic
// from some datacenter ranges — it worked from a laptop but failed with a
// network-level error from the deployed host. Mirrors are tried in order so
// one instance blocking or rate-limiting cloud IPs doesn't take the feature
// down. Order is deliberate: main first (fastest, most current), then
// community mirrors.
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
// 3 miles. Wider was measurably slower (the query is the expensive part, and
// it ran right up against the request timeout) without being more useful —
// "what's near my new place" means walkable-to-a-short-drive, not an hour out.
const SEARCH_RADIUS_M = 5000;
// Overpass needs generous headroom: this query legitimately takes ~20s
// against a busy public instance. The client timeout has to exceed the
// server-side one in the query header, or a query that would have succeeded
// gets aborted just before it returns.
const OVERPASS_SERVER_TIMEOUT_S = 40;
const OVERPASS_CLIENT_TIMEOUT_MS = 50_000;
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
    // Explicit rather than `Boolean(t.shop)`: a catch-all here would swallow
    // hardware and laundry before the errands category could claim them.
    matches: (t) =>
      ['supermarket', 'mall', 'department_store', 'convenience', 'bakery', 'greengrocer'].includes(
        t.shop
      ),
  },
  {
    key: 'health',
    label: 'Health & Pharmacy',
    filters: ['nwr["amenity"~"^(pharmacy|doctors|hospital|dentist|clinic|veterinary)$"]'],
    matches: (t) =>
      ['pharmacy', 'doctors', 'hospital', 'dentist', 'clinic', 'veterinary'].includes(t.amenity),
  },
  {
    key: 'errands',
    label: 'Everyday Errands',
    filters: [
      'nwr["amenity"~"^(post_office|bank|library|fuel)$"]',
      'nwr["shop"~"^(hardware|doityourself|laundry|dry_cleaning)$"]',
    ],
    matches: (t) =>
      ['post_office', 'bank', 'library', 'fuel'].includes(t.amenity) ||
      ['hardware', 'doityourself', 'laundry', 'dry_cleaning'].includes(t.shop),
  },
  {
    key: 'transit',
    label: 'Getting Around',
    // Stations and transit hubs only — individual bus stops are far too dense
    // to be useful here and would swamp the query.
    filters: [
      'nwr["railway"="station"]',
      'nwr["amenity"="bus_station"]',
      'nwr["public_transport"="station"]',
    ],
    matches: (t) =>
      t.railway === 'station' || t.amenity === 'bus_station' || t.public_transport === 'station',
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
  return `[out:json][timeout:${OVERPASS_SERVER_TIMEOUT_S}];\n(\n${filters}\n);\nout center 400;`;
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

// Try each mirror in turn. A refusal, timeout, or 5xx from one instance is
// routine for a volunteer-run service, so it moves to the next rather than
// failing the request. Only when every mirror is exhausted does this throw —
// and even then the caller still has the stale-cache fallback.
async function fetchOverpassElements(query) {
  const failures = [];

  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const response = await fetch(mirror, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain', 'User-Agent': OUTBOUND_USER_AGENT },
        body: query,
        signal: AbortSignal.timeout(OVERPASS_CLIENT_TIMEOUT_MS),
      });

      if (response.ok) {
        const data = await response.json().catch(() => null);
        const elements = Array.isArray(data?.elements) ? data.elements : null;

        // A 200 carrying no elements is not a usable answer. Some hosts on
        // the mirror list answer instantly with an empty result set, and
        // accepting that as success is worse than an outright error: the
        // page renders "nothing nearby" for an address that in fact has
        // plenty, and the empty result gets cached. Treat it as a failure
        // and move to the next mirror.
        if (elements?.length) return elements;
        failures.push(`${new URL(mirror).host}: 200 but no elements`);
        continue;
      }

      failures.push(`${new URL(mirror).host}: HTTP ${response.status}`);
    } catch (err) {
      failures.push(`${new URL(mirror).host}: ${err.message}`);
    }
  }

  throw new LocalPlacesError(`All places providers unavailable (${failures.join('; ')})`);
}

async function fetchFromOverpass(lat, lon) {
  const elements = await fetchOverpassElements(buildQuery(lat, lon));

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
