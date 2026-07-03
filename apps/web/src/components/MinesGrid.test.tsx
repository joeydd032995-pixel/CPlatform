import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MinesGrid } from './viz/MinesGrid';

describe('MinesGrid', () => {
  it('renders 25 tiles with correct mine/pick/hit classes', () => {
    const outcome = {
      minePositions: [0, 5, 10],
      revealOrder: [1, 5],
      hitMine: true,
    };

    render(<MinesGrid outcome={outcome} />);

    const tiles = screen.getAllByTestId(/^mines-tile-/);
    expect(tiles).toHaveLength(25);

    const hitTile = screen.getByTestId('mines-tile-5');
    expect(hitTile.getAttribute('data-hit')).toBe('true');
    expect(hitTile.getAttribute('data-mine')).toBe('true');

    const safePick = screen.getByTestId('mines-tile-1');
    expect(safePick.getAttribute('data-pick')).toBe('true');
    expect(safePick.getAttribute('data-hit')).toBe('false');

    const untouchedMine = screen.getByTestId('mines-tile-10');
    expect(untouchedMine.getAttribute('data-mine')).toBe('true');
    expect(untouchedMine.getAttribute('data-pick')).toBe('false');

    const emptyTile = screen.getByTestId('mines-tile-2');
    expect(emptyTile.getAttribute('data-mine')).toBe('false');
    expect(emptyTile.getAttribute('data-pick')).toBe('false');
  });
});
