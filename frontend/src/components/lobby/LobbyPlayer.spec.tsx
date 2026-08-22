/**
 * Tests for components/lobby/LobbyPlayer.tsx
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { LobbyPlayerCard } from './LobbyPlayer';
import type { LobbyPlayer } from '@/shared';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: any, ref: any) => (
      <div ref={ref} {...props}>{children}</div>
    )),
  },
}));

describe('LobbyPlayerCard Component', () => {
  const basePlayer: LobbyPlayer = {
    id: 'u1',
    username: 'Alice',
    avatar: '🦊',
    isReady: false,
    isHost: false,
    joinedAt: new Date(),
  };

  it('should display the player username', () => {
    render(<LobbyPlayerCard player={basePlayer} isCurrentUser={false} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('should display the player avatar', () => {
    render(<LobbyPlayerCard player={basePlayer} isCurrentUser={false} />);
    expect(screen.getByText('🦊')).toBeInTheDocument();
  });

  it('should show "(you)" for the current user', () => {
    render(<LobbyPlayerCard player={basePlayer} isCurrentUser={true} />);
    expect(screen.getByText('(you)')).toBeInTheDocument();
  });

  it('should not show "(you)" for other players', () => {
    render(<LobbyPlayerCard player={basePlayer} isCurrentUser={false} />);
    expect(screen.queryByText('(you)')).not.toBeInTheDocument();
  });

  it('should show "Host" badge for the host', () => {
    const host = { ...basePlayer, isHost: true };
    render(<LobbyPlayerCard player={host} isCurrentUser={false} />);
    expect(screen.getByText('Host')).toBeInTheDocument();
  });

  it('should not show "Host" badge for non-host', () => {
    render(<LobbyPlayerCard player={basePlayer} isCurrentUser={false} />);
    expect(screen.queryByText('Host')).not.toBeInTheDocument();
  });

  it('shows the server-selected partnership team', () => {
    render(<LobbyPlayerCard player={{ ...basePlayer, team: 1 }} isCurrentUser />);
    expect(screen.getByText('Team 2')).toBeInTheDocument();
  });

  it('offers removal only when the host-facing caller enables it', () => {
    const onRemove = jest.fn();
    const { rerender } = render(
      <LobbyPlayerCard player={basePlayer} isCurrentUser={false} />,
    );
    expect(screen.queryByRole('button', { name: 'Remove Alice' })).not.toBeInTheDocument();

    rerender(
      <LobbyPlayerCard
        player={basePlayer}
        isCurrentUser={false}
        canRemove
        onRemove={onRemove}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove Alice' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
