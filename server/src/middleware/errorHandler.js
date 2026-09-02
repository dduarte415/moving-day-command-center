// Centralized error handling so every route returns the same JSON error
// shape and no stack traces, SQL, or schema internals leak to the client.

export class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found' });
}

// Prisma's errors are chatty by design — they name models, fields, and
// constraints ("Unique constraint failed on the fields: (`address_hash`)").
// That's useful in a log and a schema disclosure in a response body, so they
// are always collapsed to a generic message regardless of how they surface.
function isPrismaError(err) {
  return (
    typeof err?.clientVersion === 'string' ||
    /^Prisma(Client)?[A-Za-z]*Error$/.test(err?.constructor?.name ?? '') ||
    (typeof err?.code === 'string' && /^P\d{4}$/.test(err.code))
  );
}

// body-parser (and anything else using the http-errors contract) marks
// client-caused failures with a statusCode and `expose: true`. Malformed
// JSON is the user's problem, not a server fault — report it as a 400
// instead of logging a stack trace and calling it a 500.
function isExposedClientError(err) {
  return err?.expose === true && Number.isInteger(err?.statusCode) && err.statusCode < 500;
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let statusCode = 500;
  let message = 'Internal server error';
  let details;

  if (isPrismaError(err)) {
    // Deliberately before the ApiError branch: even if a database error is
    // wrapped and given a 4xx somewhere upstream, its message never ships.
    statusCode = 500;
  } else if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (isExposedClientError(err)) {
    statusCode = err.statusCode;
    message = err.type === 'entity.parse.failed' ? 'Malformed JSON body' : 'Bad request';
  }

  // Full detail to the server log, only for genuine server faults — client
  // mistakes shouldn't fill the log with stack traces (or echo raw request
  // bodies, which is what body-parser errors carry).
  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    error: message,
    ...(details ? { details } : {}),
  });
}
