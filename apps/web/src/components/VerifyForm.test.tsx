import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

    // Radix's TabsTrigger switches the active tab on mousedown, not click --
    // fireEvent.click alone never dispatches the preceding mousedown, so the
    // panel never actually switches. Fire mouseDown to match real click behavior.
    const jsonTab = screen.getByRole('tab', { name: /advanced json/i });
    fireEvent.mouseDown(jsonTab);
    fireEvent.click(jsonTab);
    expect(screen.getByDisplayValue(/"target": 50/)).toBeInTheDocument();

    const submitButton = screen.getByRole('button', { name: /verify/i });
    expect(submitButton).not.toBeDisabled();
  });
});
