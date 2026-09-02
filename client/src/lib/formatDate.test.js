import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatDateShort,
  formatDateLong,
  formatCountdown,
  titleCaseAddress,
} from './formatDate';

describe('formatDateShort / formatDateLong', () => {
  it('renders the calendar date that was entered, not the local-timezone one', () => {
    // Regression: date-only values arrive as UTC midnight. Formatting them in
    // a timezone behind UTC used to roll them back a day (Sep 20 -> Sep 19).
    const iso = '2026-09-20T00:00:00.000Z';
    expect(formatDateShort(iso)).toBe('Sep 20');
    expect(formatDateLong(iso)).toBe('September 20, 2026');
  });

  it('returns an empty string for missing dates rather than "Invalid Date"', () => {
    expect(formatDateShort(null)).toBe('');
    expect(formatDateLong(undefined)).toBe('');
    expect(formatDateShort('')).toBe('');
  });
});

describe('formatCountdown', () => {
  afterEach(() => vi.useRealTimers());

  function freeze(localDate) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(localDate));
  }

  it('counts forward, pluralizing correctly', () => {
    freeze('2026-09-01T12:00:00');
    expect(formatCountdown('2026-09-19T00:00:00.000Z')).toBe('18 days to go');
    expect(formatCountdown('2026-09-02T00:00:00.000Z')).toBe('1 day to go');
  });

  it('calls out moving day itself', () => {
    freeze('2026-09-19T08:00:00');
    expect(formatCountdown('2026-09-19T00:00:00.000Z')).toBe('Moving day!');
  });

  it('counts backward for past moves', () => {
    freeze('2026-09-20T12:00:00');
    expect(formatCountdown('2026-09-19T00:00:00.000Z')).toBe('1 day ago');
    expect(formatCountdown('2026-09-10T00:00:00.000Z')).toBe('10 days ago');
  });

  it('stays on the same calendar day late at night, west of UTC', () => {
    // 11pm local on the 18th is already the 19th in UTC — a naive diff would
    // report "Moving day!" a day early.
    process.env.TZ = 'America/Los_Angeles';
    freeze('2026-09-18T23:00:00');
    expect(formatCountdown('2026-09-19T00:00:00.000Z')).toBe('1 day to go');
  });

  it('returns null when there is no date to count toward', () => {
    expect(formatCountdown(null)).toBeNull();
  });
});

describe('titleCaseAddress', () => {
  it('normalizes casing for display', () => {
    expect(titleCaseAddress('456 oakland ave')).toBe('456 Oakland Ave');
    expect(titleCaseAddress('456 OAKLAND AVE')).toBe('456 Oakland Ave');
  });

  it('keeps state codes and directionals upper-case', () => {
    expect(titleCaseAddress('1600 pennsylvania ave nw, washington, dc 20500')).toBe(
      '1600 Pennsylvania Ave NW, Washington, DC 20500'
    );
    expect(titleCaseAddress('123 main st, austin, tx 73301')).toBe(
      '123 Main St, Austin, TX 73301'
    );
  });

  it('does not upper-case two-letter street suffixes', () => {
    // Regression: an "any 2-letter word" rule fixed "dc" but broke "Rd"/"St".
    expect(titleCaseAddress('6030 sturgeon lake rd')).toBe('6030 Sturgeon Lake Rd');
    expect(titleCaseAddress('12 quiet ln')).toBe('12 Quiet Ln');
    expect(titleCaseAddress('9 court ct')).toBe('9 Court Ct');
  });

  it('disambiguates state codes from identical street suffixes by position', () => {
    // "Ct" the street suffix vs "CT" the state — both appear here.
    expect(titleCaseAddress('12 court ct, hartford, ct 06106')).toBe(
      '12 Court Ct, Hartford, CT 06106'
    );
    // State code as the final token of a comma-separated address (no ZIP).
    expect(titleCaseAddress('austin, tx')).toBe('Austin, TX');
    // Same two letters with no city/state context is a street suffix.
    expect(titleCaseAddress('9 court ct')).toBe('9 Court Ct');
  });

  it('handles empty input', () => {
    expect(titleCaseAddress('')).toBe('');
    expect(titleCaseAddress(null)).toBe('');
  });
});
