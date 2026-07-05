import { describe, expect, it } from 'vitest';
import * as real from '@cplatform/games';
import { getPlinkoMultipliersTable } from './plinko-multipliers';

describe('plinko multipliers parity', () => {
  const risks = ['low', 'medium', 'high'] as const;

  for (const rows of [8, 10, 12, 14, 16]) {
    for (const risk of risks) {
      it(`rows=${rows} risk=${risk}`, () => {
        const local = getPlinkoMultipliersTable({ risk, rows });
        const remote = real.getPlinkoMultipliersTable({
          risk: real.toPlinkoRisk(risk),
          rows,
        });
        expect([...local]).toEqual([...remote]);
      });
    }
  }
});