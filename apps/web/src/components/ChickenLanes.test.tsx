import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChickenLanes } from './viz/ChickenLanes';

describe('ChickenLanes', () => {
  it('renders 20 lanes with the death point marked', () => {
    const outcome = { deathPoint: 7, win: false };
    const params = { difficulty: 'easy' as const, lanes: 5 };

    render(<ChickenLanes outcome={outcome} params={params} />);

    const lanes = screen.getAllByTestId(/^chicken-lane-/);
    expect(lanes).toHaveLength(20);

    const deathLane = screen.getByTestId('chicken-lane-7');
    expect(deathLane.getAttribute('data-death-point')).toBe('true');

    const otherLane = screen.getByTestId('chicken-lane-1');
    expect(otherLane.getAttribute('data-death-point')).toBe('false');
  });
});
