import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { prisma } from './prisma.js';
import { createIdempotently, duplicateWindowStart } from './idempotency.js';

// Integration test against the local dev Postgres — the whole point of this
// module is the advisory lock, which only exists in the database, so mocking
// Prisma here would test nothing. Requires DATABASE_URL to be reachable.
describe('createIdempotently', () => {
  let moveId;

  beforeAll(async () => {
    const move = await prisma.move.create({
      data: {
        oldAddress: 'idempotency-test old',
        newAddress: 'idempotency-test new',
        moveDate: new Date('2027-06-01'),
      },
    });
    moveId = move.id;
  });

  afterEach(async () => {
    await prisma.task.deleteMany({ where: { moveId } });
  });

  afterAll(async () => {
    if (moveId) await prisma.move.delete({ where: { id: moveId } }).catch(() => {});
    await prisma.$disconnect();
  });

  // `readDelayMs` widens the gap between the duplicate check and the insert.
  // Without it, Promise.all in a single process doesn't actually reproduce
  // the race — Prisma's connection pool serializes the calls enough to hide
  // it, so the test would pass even with the lock removed (verified by
  // mutation). Real concurrency arrives as separate HTTP requests with real
  // latency between the read and the write; this simulates that window so
  // the test genuinely distinguishes locked from unlocked.
  function addTask(title, { readDelayMs = 0 } = {}) {
    return createIdempotently({
      dedupeKey: `task:${moveId}|${title.toLowerCase()}|BEFORE_MOVE`,
      findExisting: async (tx) => {
        const found = await tx.task.findFirst({
          where: { moveId, title, category: 'BEFORE_MOVE', createdAt: { gte: duplicateWindowStart() } },
        });
        if (readDelayMs) await new Promise((r) => setTimeout(r, readDelayMs));
        return found;
      },
      create: (tx) => tx.task.create({ data: { moveId, title, category: 'BEFORE_MOVE' } }),
    });
  }

  it('creates the row on first call', async () => {
    const { record, deduped } = await addTask('First call');
    expect(deduped).toBe(false);
    expect(record.title).toBe('First call');
  });

  it('returns the existing row on a sequential repeat', async () => {
    const first = await addTask('Sequential repeat');
    const second = await addTask('Sequential repeat');

    expect(second.deduped).toBe(true);
    expect(second.record.id).toBe(first.record.id);
    await expect(prisma.task.count({ where: { moveId, title: 'Sequential repeat' } })).resolves.toBe(1);
  });

  // The reason this module exists. A plain read-then-write check passes the
  // sequential test above but loses this one: concurrent callers all read
  // "no duplicate" before any of them inserts.
  it('creates exactly one row under concurrent identical calls', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => addTask('Concurrent burst', { readDelayMs: 60 }))
    );

    const count = await prisma.task.count({ where: { moveId, title: 'Concurrent burst' } });
    expect(count).toBe(1);
    expect(results.filter((r) => !r.deduped)).toHaveLength(1);
    expect(results.filter((r) => r.deduped)).toHaveLength(4);
    // Every caller gets the same row back, so no client sees a "lost" write.
    expect(new Set(results.map((r) => r.record.id)).size).toBe(1);
  });

  it('does not dedupe rows with different content', async () => {
    await Promise.all([addTask('Distinct A'), addTask('Distinct B'), addTask('Distinct C')]);

    const count = await prisma.task.count({ where: { moveId, title: { startsWith: 'Distinct ' } } });
    expect(count).toBe(3);
  });

  it('does not deadlock when different keys are created concurrently', async () => {
    const many = Array.from({ length: 10 }, (_, i) => addTask(`Parallel ${i}`));
    await expect(Promise.all(many)).resolves.toHaveLength(10);
  });
});
