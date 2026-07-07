import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BackendStatusBanner } from './BackendStatusBanner';

const useUserMock = vi.fn();

vi.mock('@/lib/user-context', () => ({
  useUser: () => useUserMock(),
}));

describe('BackendStatusBanner', () => {
  it('renders nothing while the backend is connected', () => {
    useUserMock.mockReturnValue({ backendConnected: true });
    const { container } = render(<BackendStatusBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a "backend not connected" alert once a request has failed', () => {
    useUserMock.mockReturnValue({ backendConnected: false });
    render(<BackendStatusBanner />);
    expect(screen.getByRole('alert')).toHaveTextContent(/backend not connected/i);
  });
});
