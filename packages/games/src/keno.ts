// Generator ported from
// .claude/skills/game-logic-engineer/references/games/keno.ts verbatim
// (partial Fisher-Yates via splice over a shrinking [1..40] positions
// array, 10 unique winning positions, sorted ascending) — only the RNG
// import/naming has been fixed to match the real @cplatform/core-rng
// package.
//
// The paytable itself is NOT in the reference (its comment says so
// explicitly) — it's derived programmatically here per-risk so that
// Sigma(P(k) * m_k) == 0.99 exactly for every (risk, picksCount). The
// house edge is therefore baked into the table; resolveKeno must NOT run
// the looked-up multiplier through applyHouseEdge again (same convention
// as Plinko's shipped tables).

import { z } from 'zod';
import { createFloatGenerator, type GeneratorOptions } from '@cplatform/core-rng';
import { InvalidBetParamsError } from '@cplatform/shared';
import { nCr } from './combinatorics.js';
import { validateBetAmount } from './bet-amount.js';

export const KENO_GAME_TILES_COUNT = 40;
export const KENO_GAME_TILES_HIT_COUNT = 10;

export const calculateKenoHitPositions = ({
  ...rngOptions
}: GeneratorOptions): number[] => {
  const floatsRng = createFloatGenerator({ ...rngOptions });

  const remainingPositions = Array(KENO_GAME_TILES_COUNT)
    .fill(0)
    .map((_, index) => index + 1);

  return Array(KENO_GAME_TILES_HIT_COUNT)
    .fill(0)
    .map((_, index) => {
      const float = floatsRng.next().value;
      const relativeMinePosition = Math.floor(
        float * (KENO_GAME_TILES_COUNT - index)
      );
      const [absoluteMinePosition] = remainingPositions.splice(
        relativeMinePosition,
        1
      );
      return absoluteMinePosition as number;
    })
    .sort((left, right) => left - right);
};

// --- Paytable (not part of the reference; derived programmatically) ------

export type KenoRisk = 'classic' | 'low' | 'medium' | 'high';

type KenoRiskProfile = { alpha: number; kminFrac: number };

const KENO_RISK_PROFILES: Record<KenoRisk, KenoRiskProfile> = {
  low: { alpha: 0.6, kminFrac: 0.4 },
  classic: { alpha: 0.85, kminFrac: 0.5 },
  medium: { alpha: 1.0, kminFrac: 0.6 },
  high: { alpha: 1.25, kminFrac: 0.7 },
};

const KENO_TARGET_EV = 0.99;

// P(hitting exactly k of N picks) = C(N,k) * C(40-N, 10-k) / C(40,10).
function kenoHitProbability(picksCount: number, k: number): number {
  return (
    (nCr(picksCount, k) *
      nCr(KENO_GAME_TILES_COUNT - picksCount, KENO_GAME_TILES_HIT_COUNT - k)) /
    nCr(KENO_GAME_TILES_COUNT, KENO_GAME_TILES_HIT_COUNT)
  );
}

// Cached per (risk, picksCount) at module scope — the table is fixed data
// derived purely from combinatorics, not something to rebuild on every
// resolveKeno() call.
const kenoTableCache = new Map<string, readonly number[]>();

// Returns m_k for k = 0..picksCount (index by hit count).
export function kenoMultiplierTable(
  risk: KenoRisk,
  picksCount: number
): readonly number[] {
  const cacheKey = `${risk}:${picksCount}`;
  const cached = kenoTableCache.get(cacheKey);
  if (cached) return cached;

  const { alpha, kminFrac } = KENO_RISK_PROFILES[risk];
  const kmin = Math.max(1, Math.ceil(picksCount * kminFrac));

  const probs: number[] = [];
  for (let k = 0; k <= picksCount; k++) {
    probs.push(kenoHitProbability(picksCount, k));
  }

  const weights = probs.map((p, k) => (k >= kmin ? Math.pow(1 / p, alpha) : 0));
  const denom = probs.reduce((sum, p, k) => sum + p * weights[k]!, 0);

  const table = weights.map((w) =>
    denom > 0 ? (KENO_TARGET_EV * w) / denom : 0
  );

  kenoTableCache.set(cacheKey, table);
  return table;
}

export function kenoMultiplier(
  risk: KenoRisk,
  picksCount: number,
  hits: number
): number {
  const table = kenoMultiplierTable(risk, picksCount);
  const multiplier = table[hits];
  if (multiplier == null) {
    throw new Error(
      `Could not compute Keno multiplier for risk(${risk}), picksCount(${picksCount}) & hits(${hits})!`
    );
  }
  return multiplier;
}

// --- Params / resolve ------------------------------------------------------

export const KenoParamsSchema = z.object({
  risk: z.enum(['classic', 'low', 'medium', 'high']),
  picks: z
    .array(z.number().int().min(1).max(KENO_GAME_TILES_COUNT))
    .min(1)
    .max(KENO_GAME_TILES_HIT_COUNT)
    .refine((picks) => new Set(picks).size === picks.length, {
      message: 'picks must be unique',
    }),
});

export type KenoParams = z.infer<typeof KenoParamsSchema>;

export type KenoOutcome = {
  drawn: number[];
  hits: number[];
  hitCount: number;
};

export function resolveKeno(
  generatorOpts: GeneratorOptions,
  params: unknown,
  betAmount: number
): { outcome: KenoOutcome; multiplier: number; payout: number } {
  const parsed = validateKenoParams(params);
  validateBetAmount('keno', betAmount);

  const drawn = calculateKenoHitPositions(generatorOpts);
  const drawnSet = new Set(drawn);
  const hits = parsed.picks.filter((pick) => drawnSet.has(pick)).sort((a, b) => a - b);
  const hitCount = hits.length;

  const multiplier = kenoMultiplier(parsed.risk, parsed.picks.length, hitCount);
  const payout = betAmount * multiplier;

  return {
    outcome: { drawn, hits, hitCount },
    multiplier,
    payout,
  };
}

function validateKenoParams(params: unknown): KenoParams {
  const result = KenoParamsSchema.safeParse(params);
  if (!result.success) {
    throw new InvalidBetParamsError('keno', result.error.message);
  }
  return result.data;
}
