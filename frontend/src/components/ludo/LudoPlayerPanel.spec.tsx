/**
 * Tests for components/ludo/LudoPlayerPanel.tsx
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { LudoPlayerPanel } from './LudoPlayerPanel';
import { LudoColor, LudoPlayerState } from '@/shared';

jest.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: any, ref: any) => (
      <div ref={ref} {...props}>{children}</div>
    )),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

function makePlayer(
  id: string,
  color: LudoColor,
  name: string,
  isBot = false,
): LudoPlayerState {
  return {
    id,
    username: name,
    color,
    tokens: [
      { id: 0, state: 'base', stepsFromStart: 0 },
      { id: 1, state: 'active', stepsFromStart: 10 },
      { id: 2, state: 'home', stepsFromStart: 59 },
      { id: 3, state: 'base', stepsFromStart: 0 },
    ],
    finishedCount: 1,
    isBot,
  };
}

describe('LudoPlayerPanel Component', () => {
  it('should render all player names', () => {
    const players = [
      makePlayer('p1', LudoColor.RED, 'Alice'),
      makePlayer('p2', LudoColor.GREEN, 'Bob'),
    ];

    render(
      <LudoPlayerPanel
        players={players}
        currentTurn="p1"
        rankings={[]}
        myPlayerId="p1"
      />,
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('should show bot badge for bot players', () => {
    const players = [
      makePlayer('p1', LudoColor.RED, 'Human'),
      makePlayer('bot1', LudoColor.GREEN, 'Bot Alpha', true),
    ];

    render(
      <LudoPlayerPanel
        players={players}
        currentTurn="p1"
        rankings={[]}
        myPlayerId="p1"
      />,
    );

    expect(screen.getByText('🤖')).toBeInTheDocument();
  });

  it('should display token counts', () => {
    const players = [
      makePlayer('p1', LudoColor.RED, 'Alice'),
    ];

    const { container } = render(
      <LudoPlayerPanel
        players={players}
        currentTurn="p1"
        rankings={[]}
        myPlayerId="p1"
      />,
    );

    // Player has tokens in different states — the panel should show some indicators
    expect(container.textContent).toContain('2'); // 2 at base
    expect(container.textContent).toContain('1'); // 1 active and 1 home
  });

  it('should show rankings when provided', () => {
    const players = [
      makePlayer('p1', LudoColor.RED, 'Alice'),
      makePlayer('p2', LudoColor.GREEN, 'Bob'),
    ];

    render(
      <LudoPlayerPanel
        players={players}
        currentTurn="p1"
        rankings={['p1']}
        myPlayerId="p1"
      />,
    );

    // Should show rank indicator (text includes "🏆 1st")
    expect(screen.getByText(/🏆/)).toBeInTheDocument();
  });
});
