import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VerifyForm } from './VerifyForm';

describe('VerifyForm', () => {
  it('prefills fields from props without needing a router', () => {
    const serverSeed = 'a'.repeat(64);
    render(
      <VerifyForm
        initialGame="dice"
        initialServerSeed={serverSeed}
        initialClientSeed="my-client-seed"
        initialNonce={12}
        initialParams={{ target: 50, direction: 'over' }}
      />
    );

    expect(screen.getByDisplayValue(serverSeed)).toBeInTheDocument();
    expect(screen.getByDisplayValue('my-client-seed')).toBeInTheDocument();
    expect(screen.getByDisplayValue('12')).toBeInTheDocument();
    expect(screen.getByDisplayValue(/"target": 50/)).toBeInTheDocument();

    const submitButton = screen.getByRole('button', { name: /verify/i });
    expect(submitButton).not.toBeDisabled();
  });
});
