// moveDate/dueDate are date-only values (Prisma @db.Date) serialized as
// UTC-midnight ISO strings. Formatting them with the browser's local
// timezone can roll them back a day for anyone west of UTC — always render
// using UTC fields so the calendar date shown matches what was entered.
export function formatDate(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString(undefined, { timeZone: 'UTC' });
}
