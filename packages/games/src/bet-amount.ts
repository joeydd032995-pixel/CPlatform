import { InvalidBetParamsError } from '@cplatform/shared';

// Shared boundary guard for every game's resolve(): betAmount arrives as a
// plain number from the caller (gameService, in Milestone 4), not through a
// Zod-validated params object, so each resolve() must check it directly
// rather than assuming an upstream validator already did.
export function validateBetAmount(game: string, betAmount: number): void {
  if (!Number.isFinite(betAmount) || betAmount <= 0) {
    throw new InvalidBetParamsError(game, 'betAmount must be a positive finite number');
  }
}
