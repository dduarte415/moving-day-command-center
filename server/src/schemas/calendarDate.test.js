import { describe, it, expect } from 'vitest';
import { calendarDateSchema } from './calendarDate.js';
import { createMoveSchema } from './moveSchemas.js';

// Regression coverage: z.coerce.date() silently rolls impossible dates over
// (new Date('2027-02-30') is March 2nd), so a user could submit a date they
// never picked and have a different one stored with no error.
describe('calendarDateSchema', () => {
  it.each([
    ['2027-02-30', 'Feb 30 does not exist'],
    ['2027-02-29', '2027 is not a leap year'],
    ['2027-04-31', 'April has 30 days'],
    ['2027-13-01', 'month 13'],
    ['2027-00-10', 'month 0'],
    ['2027-01-32', 'day 32'],
    ['not-a-date', 'unparseable'],
    ['', 'empty'],
  ])('rejects %s (%s)', (input) => {
    expect(calendarDateSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    ['2028-02-29', 'real leap day'],
    ['2027-02-28', 'last day of a short month'],
    ['2027-12-31', 'end of year'],
    ['2027-01-01', 'start of year'],
  ])('accepts %s (%s)', (input) => {
    expect(calendarDateSchema.safeParse(input).success).toBe(true);
  });

  it('parses to UTC midnight so the calendar date cannot shift by timezone', () => {
    const parsed = calendarDateSchema.parse('2027-03-19');
    expect(parsed.toISOString()).toBe('2027-03-19T00:00:00.000Z');
  });

  it('preserves the exact day given, never a rolled-over one', () => {
    // The specific failure mode: input day must equal output day.
    for (const day of ['01', '15', '28']) {
      const parsed = calendarDateSchema.parse(`2027-06-${day}`);
      expect(parsed.getUTCDate()).toBe(Number(day));
      expect(parsed.getUTCMonth()).toBe(5); // June
    }
  });

  it('rejects an impossible move date through the full move schema', () => {
    const result = createMoveSchema.safeParse({
      oldAddress: 'A',
      newAddress: 'B',
      moveDate: '2027-02-30',
    });
    expect(result.success).toBe(false);
  });
});
