import { ApiError } from './errorHandler.js';

// Wraps a Zod schema as Express middleware. Validates + replaces the given
// request property (body/params/query) with the parsed (and thus
// type-coerced/trimmed) value so downstream handlers never touch raw input.
export function validate(schema, property = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[property]);
    if (!result.success) {
      throw new ApiError(400, 'Validation failed', result.error.flatten());
    }
    if (property === 'query') {
      // Express 5's req.query is a getter with no setter — mutate in place
      // instead of reassigning.
      for (const key of Object.keys(req.query)) delete req.query[key];
      Object.assign(req.query, result.data);
    } else {
      req[property] = result.data;
    }
    next();
  };
}
