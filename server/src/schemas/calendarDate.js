import { z } from 'zod';

// Move dates and task due dates are calendar dates, not instants — "the 19th"
// means the 19th everywhere, so they're stored as Postgres DATE and always
// built at UTC midnight.
//
// z.coerce.date() alone is not safe here: JavaScript silently rolls
// impossible dates over instead of rejecting them. new Date('2027-02-30')
// yields March 2nd, and '2027-02-29' (not a leap year) yields March 1st — so
// a user could submit a date they never picked and get a different one
// stored, with no error anywhere. This validates that the parsed date still
// has the same year/month/day it was given.

function parseCalendarDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== 'string') return null;

  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);

  const date = new Date(Date.UTC(year, month - 1, day));
  // The round-trip check: a rolled-over date won't match what was asked for.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export const calendarDateSchema = z
  .union([z.string(), z.date()])
  .transform((value, ctx) => {
    const parsed = parseCalendarDate(value);
    if (!parsed) {
      ctx.addIssue({
        code: 'custom',
        message: 'Must be a real calendar date (YYYY-MM-DD)',
      });
      return z.NEVER;
    }
    return parsed;
  });
