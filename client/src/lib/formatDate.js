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
// mutates what's stored, just how it's shown.
//
// Casing two-letter tokens is genuinely ambiguous: "CT" is Connecticut but
// "Ct" is Court, and the same collision hits LA/Ln, IN, OR, ME. Position
// disambiguates them — a state code sits at the end of the address, either
// right before the ZIP ("Austin, TX 73301") or as the final token of a
// comma-separated address ("Austin, TX"). A two-letter street suffix never
// does. Directionals are safe to upper-case anywhere.
const DIRECTIONALS = new Set(['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW']);

const STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID',
  'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS',
  'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK',
  'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV',
  'WI', 'WY', 'DC', 'PR',
]);

const stripPunctuation = (word) => word.replace(/[.,]/g, '');
const isZip = (word) => /^\d{5}(-\d{4})?$/.test(stripPunctuation(word ?? ''));

export function titleCaseAddress(address) {
  if (!address) return '';
  const words = address.split(' ');
  const hasComma = address.includes(',');

  return words
    .map((word, i) => {
      if (!word) return word;
      const bare = stripPunctuation(word).toUpperCase();

      if (DIRECTIONALS.has(bare)) return word.toUpperCase();

      if (STATE_CODES.has(bare)) {
        const isBeforeZip = isZip(words[i + 1]);
        const isFinalTokenOfCommaAddress = hasComma && i === words.length - 1;
        if (isBeforeZip || isFinalTokenOfCommaAddress) return word.toUpperCase();
      }

      return word[0].toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}
