import type { Request, Response, NextFunction } from 'express';
import { isAppError, logger } from '@cplatform/shared';

// Duck-types a ZodError without importing `zod` here — routes already
// import zod directly to build/parse their own schemas; this middleware
// only needs to recognize the shape of the error zod throws.
function isZodLikeError(err: unknown): err is { issues: Array<{ path: (string | number)[]; message: string }> } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'issues' in err &&
    Array.isArray((err as { issues?: unknown }).issues)
  );
}

// express.json() throws a SyntaxError (via body-parser) for malformed JSON
// bodies, tagged with `status`/`statusCode` 400 and `type ===
// 'entity.parse.failed'`. Without this check that error falls through to
// the generic 500 branch below, which is wrong (it's a client input error,
// not a server fault) and would also log the raw request body via `err`.
function isJsonParseError(err: unknown): err is { status?: number; statusCode?: number; type?: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { type?: unknown }).type === 'entity.parse.failed' &&
    ((err as { status?: unknown }).status === 400 || (err as { statusCode?: unknown }).statusCode === 400)
  );
}

// Express recognizes this as error-handling middleware purely by arity
// (4 params) — do not remove any of the four, even the unused ones.
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  if (isAppError(err)) {
    logger.warn({ code: err.code, path: req.path }, 'Request failed with a known AppError');
    res.status(err.httpStatus).json({ code: err.code, error: err.message });
    return;
  }

  if (isZodLikeError(err)) {
    const issues = err.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
    logger.warn({ issues, path: req.path }, 'Request failed validation');
    res.status(400).json({ code: 'VALIDATION_ERROR', error: 'Invalid request', issues });
    return;
  }

  if (isJsonParseError(err)) {
    logger.warn({ path: req.path }, 'Request failed: malformed JSON body');
    res.status(400).json({ code: 'INVALID_JSON', error: 'Malformed JSON body' });
    return;
  }

  // Never echo err.message here — an unanticipated error could carry a raw
  // seed value or other sensitive internal state in its message. Only the
  // structured logger (which redacts by key name) sees the real error.
  logger.error({ err, path: req.path }, 'Unhandled error');
  res.status(500).json({ code: 'INTERNAL', error: 'Internal server error' });
}
