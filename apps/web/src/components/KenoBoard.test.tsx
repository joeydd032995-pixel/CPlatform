import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KenoBoard } from './viz/KenoBoard';

describe('KenoBoard', () => {
  it('renders 40 tiles with correct pick/drawn/hit classes', () => {
    const outcome = {
      drawn: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      hits: [4, 10],
      hitCount: 2,
    };
    const params = { risk: 'classic' as const, picks: [4, 10, 17, 23, 31] };

    render(<KenoBoard outcome={outcome} params={params} />);

    const tiles = screen.getAllByTestId(/^keno-tile-/);
    expect(tiles).toHaveLength(40);

    const hitTile = screen.getByTestId('keno-tile-4');
    expect(hitTile.getAttribute('data-hit')).toBe('true');
    expect(hitTile.getAttribute('data-pick')).toBe('true');
    expect(hitTile.getAttribute('data-drawn')).toBe('true');

    const drawnOnlyTile = screen.getByTestId('keno-tile-1');
    expect(drawnOnlyTile.getAttribute('data-drawn')).toBe('true');
    expect(drawnOnlyTile.getAttribute('data-hit')).toBe('false');
    expect(drawnOnlyTile.getAttribute('data-pick')).toBe('false');

    const pickOnlyTile = screen.getByTestId('keno-tile-17');
    expect(pickOnlyTile.getAttribute('data-pick')).toBe('true');
    expect(pickOnlyTile.getAttribute('data-drawn')).toBe('false');
    expect(pickOnlyTile.getAttribute('data-hit')).toBe('false');

    const untouchedTile = screen.getByTestId('keno-tile-40');
    expect(untouchedTile.getAttribute('data-pick')).toBe('false');
    expect(untouchedTile.getAttribute('data-drawn')).toBe('false');
    expect(untouchedTile.getAttribute('data-hit')).toBe('false');
  });
});
