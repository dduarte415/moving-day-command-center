// moveDate/dueDate are date-only values (Prisma @db.Date) serialized as
// UTC-midnight ISO strings. Formatting them with the browser's local
// timezone can roll them back a day for anyone west of UTC — always render
// using UTC fields so the calendar date shown matches what was entered.

// Compact, contextual dates — task rows, moves list. "Mar 10".
export function formatDateShort(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString(undefined, {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  });
}

// The one hero date on the page — move header. "March 19, 2026".
export function formatDateLong(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString(undefined, {
    timeZone: 'UTC',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// "18 days to go" / "Moving day!" / "12 days ago" — context, not a raw field.
export function formatCountdown(isoString) {
  if (!isoString) return null;
  const today = new Date();
  const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const moveDate = new Date(isoString);
  const moveUTC = Date.UTC(moveDate.getUTCFullYear(), moveDate.getUTCMonth(), moveDate.getUTCDate());
  const days = Math.round((moveUTC - todayUTC) / 86_400_000);

  if (days === 0) return 'Moving day!';
  if (days > 0) return `${days} day${days === 1 ? '' : 's'} to go`;
  return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
}

// Display-only normalization — "456 oakland ave" -> "456 Oakland Ave". Never
// mutates what's stored, just how it's shown. An explicit allow-list (not
// "any 2-letter word") stays upper-cased — directionals and US state codes
// read wrong as "Nw"/"Dc", but plenty of legitimate street suffixes are
// also exactly two letters (Rd, St, Ln, Ct) and must NOT be forced upper.
const KEEP_UPPERCASE = new Set([
  'N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW',
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID',
  'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS',
  'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK',
  'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV',
  'WI', 'WY', 'DC', 'PR',
]);

export function titleCaseAddress(address) {
  if (!address) return '';
  return address
    .split(' ')
    .map((word) => {
      if (!word) return word;
      const bare = word.replace(/[.,]/g, '');
      if (KEEP_UPPERCASE.has(bare.toUpperCase())) return word.toUpperCase();
      return word[0].toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}
