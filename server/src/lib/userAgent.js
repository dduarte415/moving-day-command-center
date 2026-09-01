// Shared outbound User-Agent. Not cosmetic: OpenStreetMap-family services
// (Nominatim, Overpass) reject requests carrying a generic runtime default —
// Overpass answers Node's built-in fetch UA with a 406 — and their usage
// policies ask for a descriptive, identifiable agent string.
export const OUTBOUND_USER_AGENT =
  'moving-day-command-center (portfolio project; contact via GitHub)';
