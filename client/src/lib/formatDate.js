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
// mutates what's stored, just how it's shown; keeps common directionals
// (NW/SE/...) upper-case instead of title-casing them into "Nw"/"Se".
const DIRECTIONALS = new Set(['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW']);

export function titleCaseAddress(address) {
  if (!address) return '';
  return address
    .split(' ')
    .map((word) => {
      const bare = word.replace(/[.,]/g, '');
      if (DIRECTIONALS.has(bare.toUpperCase())) return word.toUpperCase();
      if (!word) return word;
      return word[0].toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}
