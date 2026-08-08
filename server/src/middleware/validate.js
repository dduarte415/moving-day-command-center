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
    req[property] = result.data;
    next();
  };
}
