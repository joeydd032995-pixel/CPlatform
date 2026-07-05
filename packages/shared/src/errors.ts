// Shared, typed error hierarchy so route handlers can map errors to HTTP
// status codes without string-matching error messages.

export abstract class AppError extends Error {
  abstract readonly httpStatus: number;
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InsufficientBalanceError extends AppError {
  readonly httpStatus = 400;
  readonly code = 'INSUFFICIENT_BALANCE';

  constructor() {
    super('Insufficient balance');
  }
}

export class InvalidBetAmountError extends AppError {
  readonly httpStatus = 400;
  readonly code = 'INVALID_BET_AMOUNT';

  constructor(betAmount: unknown) {
    super(`Invalid betAmount: ${String(betAmount)}`);
  }
}

export class UnknownGameError extends AppError {
  readonly httpStatus = 404;
  readonly code = 'UNKNOWN_GAME';

  constructor(game: string) {
    super(`Unknown game: ${game}`);
  }
}

export class InvalidBetParamsError extends AppError {
  readonly httpStatus = 400;
  readonly code = 'INVALID_BET_PARAMS';

  constructor(game: string, details: string) {
    super(`Invalid params for ${game}: ${details}`);
  }
}

export class IdempotencyConflictError extends AppError {
  readonly httpStatus = 409;
  readonly code = 'IDEMPOTENCY_CONFLICT';

  constructor() {
    super('A request with this Idempotency-Key is already being processed');
  }
}

export class RoundNotFoundError extends AppError {
  readonly httpStatus = 404;
  readonly code = 'ROUND_NOT_FOUND';

  constructor() {
    super('Round not found');
  }
}

// Thrown when the client's supplied `version` no longer matches the round's
// current version -- either a stale/racing request against the same round,
// or the round already moved on since the client last fetched its state.
export class RoundVersionConflictError extends AppError {
  readonly httpStatus = 409;
  readonly code = 'ROUND_VERSION_CONFLICT';

  constructor() {
    super('Round has been modified since your last read; refetch and retry');
  }
}

// Thrown for any round-state action that's structurally invalid for the
// round's current status/phase (e.g. acting on an already-settled round) --
// distinct from InvalidBetParamsError, which covers bad game-logic
// parameters/decisions within packages/games itself.
export class InvalidRoundStateError extends AppError {
  readonly httpStatus = 409;
  readonly code = 'INVALID_ROUND_STATE';

  constructor(message: string) {
    super(message);
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
