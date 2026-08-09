import { describe, it, expect } from 'vitest';
import { buildDefaultTasksForMove, DEFAULT_TASKS } from './defaultTasks.js';

describe('buildDefaultTasksForMove', () => {
  it('produces one task per default with dueDate offset from the move date', () => {
    const moveDate = new Date('2026-09-15T00:00:00.000Z');
    const tasks = buildDefaultTasksForMove(moveDate);

    expect(tasks).toHaveLength(DEFAULT_TASKS.length);

    const movingDayTask = tasks.find((t) => t.category === 'MOVING_DAY');
    expect(movingDayTask.dueDate.toISOString().slice(0, 10)).toBe('2026-09-15');

    const scheduleMovers = tasks.find((t) => t.title === 'Schedule movers or rent a truck');
    expect(scheduleMovers.dueDate.toISOString().slice(0, 10)).toBe('2026-08-25'); // -21 days

    const dmv = tasks.find((t) => t.title === 'Update your address with the DMV');
    expect(dmv.dueDate.toISOString().slice(0, 10)).toBe('2026-09-29'); // +14 days
  });

  it('covers all three categories', () => {
    const tasks = buildDefaultTasksForMove(new Date('2026-01-01T00:00:00.000Z'));
    const categories = new Set(tasks.map((t) => t.category));
    expect(categories).toEqual(new Set(['BEFORE_MOVE', 'MOVING_DAY', 'AFTER_MOVE']));
  });
});
