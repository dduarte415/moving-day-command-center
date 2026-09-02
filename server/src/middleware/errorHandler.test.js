import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { errorHandler, ApiError } from './errorHandler.js';

function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = (c) => ((res.statusCode = c), res);
  res.json = (b) => ((res.body = b), res);
  return res;
}

let consoleError;
beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => consoleError.mockRestore());

describe('errorHandler', () => {
  it('passes through an ApiError message and details', () => {
    const res = mockRes();
    errorHandler(new ApiError(400, 'Validation failed', { field: 'x' }), {}, res, () => {});

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Validation failed', details: { field: 'x' } });
  });

  it('collapses an unknown error to a generic 500', () => {
    const res = mockRes();
    errorHandler(new Error('ECONNREFUSED 10.0.0.5:5432'), {}, res, () => {});

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });

  // Prisma names models, fields, and constraints in its messages — that's a
  // schema disclosure in a response body.
  describe('database errors never reach the client', () => {
    const prismaErrors = [
      Object.assign(new Error('Unique constraint failed on the fields: (`address_hash`)'), {
        code: 'P2002',
        clientVersion: '7.9.1',
        meta: { target: ['address_hash'] },
      }),
      Object.assign(new Error('An operation failed because it depends on one or more records'), {
        code: 'P2025',
        clientVersion: '7.9.1',
      }),
      Object.assign(new Error("Invalid `prisma.move.create()` invocation in /app/src/routes/moves.js"), {
        clientVersion: '7.9.1',
      }),
    ];

    it.each(prismaErrors.map((e, i) => [i, e]))('sanitizes prisma error %i', (_, err) => {
      const res = mockRes();
      errorHandler(err, {}, res, () => {});

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
      expect(JSON.stringify(res.body)).not.toMatch(/address_hash|prisma|constraint|P2002/i);
    });

    // Defense in depth: even if a database error were wrapped with a 4xx
    // upstream, its message must not ship.
    it('sanitizes a prisma error even when wrapped in a 4xx ApiError', () => {
      const wrapped = Object.assign(
        new ApiError(400, 'Unique constraint failed on the fields: (`address_hash`)'),
        { code: 'P2002', clientVersion: '7.9.1' }
      );
      const res = mockRes();
      errorHandler(wrapped, {}, res, () => {});

      expect(res.body.error).toBe('Internal server error');
      expect(JSON.stringify(res.body)).not.toContain('address_hash');
    });
  });

  // body-parser marks malformed JSON as an exposed 400. Reporting it as a
  // 500 both misleads the client and fills the log with stack traces that
  // echo the raw request body.
  it('reports malformed JSON as a 400 without logging it as a server fault', () => {
    const parseError = Object.assign(new SyntaxError("Unexpected token 'n'"), {
      expose: true,
      statusCode: 400,
      status: 400,
      type: 'entity.parse.failed',
      body: '{"secret":"do-not-log-me"',
    });
    const res = mockRes();
    errorHandler(parseError, {}, res, () => {});

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Malformed JSON body' });
    expect(JSON.stringify(res.body)).not.toContain('do-not-log-me');
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('logs genuine server faults but not client mistakes', () => {
    errorHandler(new Error('boom'), {}, mockRes(), () => {});
    expect(consoleError).toHaveBeenCalledTimes(1);

    consoleError.mockClear();
    errorHandler(new ApiError(404, 'Move not found'), {}, mockRes(), () => {});
    expect(consoleError).not.toHaveBeenCalled();
  });
});
