import { act, fireEvent, render, screen } from '@testing-library/react';
import { RematchButton } from './RematchButton';
import { LOBBY_EVENTS } from '@/shared';
import { useAuthStore } from '@/stores/authStore';

const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
};

jest.mock('@/lib/socket', () => ({
  getSocket: jest.fn(() => mockSocket),
}));

jest.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  },
}));

describe('RematchButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      user: { id: 'p1', username: 'Alice', avatar: 'A' },
      token: 'token',
      isAuthenticated: true,
    });
  });

  it('requests a rematch once', () => {
    render(<RematchButton lobbyCode="123456" />);
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    expect(mockSocket.emit).toHaveBeenCalledWith(LOBBY_EVENTS.REMATCH_REQUEST, {
      lobbyCode: '123456',
    });
  });

  it('shows vote progress and disables duplicate requests', () => {
    render(<RematchButton lobbyCode="123456" />);
    const onState = mockSocket.on.mock.calls.find(
      (call) => call[0] === LOBBY_EVENTS.REMATCH_STATE,
    )![1];
    act(() => onState({ requestedBy: ['p1'], required: 2 }));
    expect(screen.getByRole('button', { name: 'Waiting for players (1/2)' })).toBeDisabled();
  });

  it('allows another player to accept a pending rematch', () => {
    render(<RematchButton lobbyCode="123456" />);
    const onState = mockSocket.on.mock.calls.find(
      (call) => call[0] === LOBBY_EVENTS.REMATCH_STATE,
    )![1];
    act(() => onState({ requestedBy: ['p2'], required: 2 }));
    expect(screen.getByRole('button', { name: 'Accept rematch (1/2)' })).toBeEnabled();
  });
});
