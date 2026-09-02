import { createHash } from 'node:crypto';
import { prisma } from './prisma.js';

// Idempotent creates (security req #9: a double-click or a retried request
// must not create duplicate rows).
//
// A plain "look for a recent identical row, then insert if none" check is
// enough for a sequential double-click, but it's a read-then-write race:
// two requests arriving together both read "no duplicate" and both insert.
// That's not hypothetical — firing five identical creates concurrently
// reliably produced three rows before this existed.
//
// So the check and the insert run inside one transaction guarded by a
// Postgres advisory lock keyed to the request's content. Concurrent requests
// with the same key serialize behind the lock; the first inserts, the rest
// see its row and return it. The lock is transaction-scoped, so it releases
// on commit or rollback with nothing to clean up. Different keys don't
// contend, so this doesn't serialize unrelated traffic.

// Postgres advisory locks take a bigint; hash the key into that range.
function lockKeyFor(dedupeKey) {
  const digest = createHash('sha256').update(dedupeKey).digest();
  // Signed 64-bit to stay inside Postgres's bigint range.
  return digest.readBigInt64BE(0);
}

/**
 * Run `findExisting` then, only if it returns nothing, `create` — atomically
 * with respect to other callers using the same dedupeKey.
 *
 * @returns {{ record: any, deduped: boolean }}
 */
export async function createIdempotently({ dedupeKey, findExisting, create }) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKeyFor(dedupeKey)}::bigint)`;

    const existing = await findExisting(tx);
    if (existing) return { record: existing, deduped: true };

    return { record: await create(tx), deduped: false };
  });
}

// How recently an identical submission counts as a duplicate rather than a
// deliberate re-entry. Long enough to cover a double-click or a retry after a
// slow response; short enough that legitimately re-adding the same item later
// still works.
export const DUPLICATE_WINDOW_MS = 10_000;

export function duplicateWindowStart() {
  return new Date(Date.now() - DUPLICATE_WINDOW_MS);
}
