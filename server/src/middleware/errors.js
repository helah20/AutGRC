/** Consistent error handling and request validation helpers. */

import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(status, message, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

export const notFound = (what = 'Resource') => new HttpError(404, `${what} not found`);
export const badRequest = (message, detail) => new HttpError(400, message, detail);

/** Wrap an async route handler so rejections reach the error middleware. */
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** Validate req.body against a zod schema, replacing it with the parsed value. */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      req[source] = schema.parse(req[source]);
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      issues: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message }))
    });
  }
  const status = err.status || 500;
  // An HttpError was thrown deliberately, so its message was written for the
  // caller and is safe to return whatever the status. Anything else reaching
  // a 5xx is unexpected and could carry internals, so it is masked — but still
  // logged in full.
  const deliberate = err instanceof HttpError;
  if (status >= 500) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
  }
  res.status(status).json({
    error: status >= 500 && !deliberate ? 'An unexpected error occurred' : err.message,
    ...(err.detail ? { detail: err.detail } : {})
  });
}
