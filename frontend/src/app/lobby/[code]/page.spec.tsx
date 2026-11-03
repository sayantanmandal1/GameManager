import { render, screen } from '@testing-library/react';
import LobbyPage from './page';

jest.mock('next/navigation', () => ({
  useParams: () => ({ code: '123456' }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock('@/hooks/useSocket', () => ({
  useSocket: () => ({ isConnected: true, isConnecting: false }),
}));
jest.mock('@/lib/socket', () => ({ getSocket: () => null }));
jest.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ isAuthenticated: true, hasHydrated: true, user: { id: 'guest' } }),
}));
jest.mock('@/stores/lobbyStore', () => {
  const store = {
    lobby: null,
    error: 'Lobby not found',
    removedFromLobby: null,
    joinLobby: jest.fn(),
    initListeners: () => () => undefined,
  };
  return { useLobbyStore: () => store };
});
jest.mock('@/stores/gameStore', () => ({
  useGameStore: () => ({ initListeners: () => () => undefined, reset: jest.fn() }),
}));
jest.mock('@/stores/ludoStore', () => ({
  useLudoStore: () => ({ initListeners: () => () => undefined, reset: jest.fn() }),
}));

describe('Lobby connection recovery', () => {
  it('surfaces an expired room instead of leaving guests in a connecting spinner', () => {
    render(<LobbyPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('Lobby not found');
    expect(screen.getByRole('button', { name: 'Retry connection' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to games' })).toHaveAttribute('href', '/games');
  });
});
