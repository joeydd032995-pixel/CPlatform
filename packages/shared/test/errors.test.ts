import { describe, expect, it } from 'vitest';
import {
  InsufficientBalanceError,
  InvalidBetAmountError,
  UnknownGameError,
  InvalidBetParamsError,
  IdempotencyConflictError,
  isAppError,
} from '../src/errors.js';

describe('error hierarchy', () => {
  it('InsufficientBalanceError maps to 400', () => {
    const err = new InsufficientBalanceError();
    expect(err.httpStatus).toBe(400);
    expect(err.code).toBe('INSUFFICIENT_BALANCE');
    expect(isAppError(err)).toBe(true);
  });

  it('InvalidBetAmountError includes the offending value', () => {
    const err = new InvalidBetAmountError(-5);
    expect(err.message).toContain('-5');
    expect(err.httpStatus).toBe(400);
  });

  it('UnknownGameError maps to 404', () => {
    const err = new UnknownGameError('roulette2');
    expect(err.httpStatus).toBe(404);
    expect(err.message).toContain('roulette2');
  });

  it('InvalidBetParamsError includes game and details', () => {
    const err = new InvalidBetParamsError('dice', 'target out of range');
    expect(err.message).toContain('dice');
    expect(err.message).toContain('target out of range');
  });

  it('IdempotencyConflictError maps to 409', () => {
    const err = new IdempotencyConflictError();
    expect(err.httpStatus).toBe(409);
  });

  it('isAppError returns false for a plain Error', () => {
    expect(isAppError(new Error('plain'))).toBe(false);
  });
});
