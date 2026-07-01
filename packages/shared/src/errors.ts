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

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
