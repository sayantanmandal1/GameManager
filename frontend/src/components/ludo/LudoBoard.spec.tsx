/**
 * Tests for components/ludo/LudoBoard.tsx
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { LudoBoard } from './LudoBoard';
import { LudoColor, LudoPlayerState, LUDO_TOKENS_PER_PLAYER } from '@/shared';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: any, ref: any) => (
      <div ref={ref} {...props}>{children}</div>
    )),
    circle: React.forwardRef((props: any, ref: any) => <circle ref={ref} {...props} />),
    g: React.forwardRef(({ children, ...props }: any, ref: any) => (
      <g ref={ref} {...props}>{children}</g>
    )),
    rect: React.forwardRef((props: any, ref: any) => <rect ref={ref} {...props} />),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

function makePlayer(
  id: string,
  color: LudoColor,
  tokenSteps: number[],
): LudoPlayerState {
  return {
    id,
    username: id,
    color,
    tokens: tokenSteps.map((s, i) => ({
      id: i,
      state: s === 0 ? ('base' as const) : s >= 59 ? ('home' as const) : ('active' as const),
      stepsFromStart: s,
    })),
    finishedCount: tokenSteps.filter((s) => s >= 59).length,
    isBot: false,
  };
}

const defaultProps = {
  myColor: LudoColor.RED,
  currentTurn: 'p1',
  availableMoves: null,
  onMoveSelect: jest.fn(),
  disabled: false,
  selectedTokenId: null,
  onTokenSelect: jest.fn(),
};

describe('LudoBoard Component', () => {
  it('should render the SVG board', () => {
    const players = [
      makePlayer('p1', LudoColor.RED, [0, 0, 0, 0]),
      makePlayer('p2', LudoColor.GREEN, [0, 0, 0, 0]),
    ];

    const { container } = render(
      <LudoBoard {...defaultProps} players={players} />,
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should render tokens for all players', () => {
    const players = [
      makePlayer('p1', LudoColor.RED, [0, 10, 0, 0]),
      makePlayer('p2', LudoColor.GREEN, [0, 0, 5, 0]),
    ];

    const { container } = render(
      <LudoBoard {...defaultProps} players={players} />,
    );

    // Should have circles for tokens (8 total tokens for 2 players)
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThanOrEqual(8);
  });

  it('should render safe square markers', () => {
    const players = [
      makePlayer('p1', LudoColor.RED, [0, 0, 0, 0]),
    ];

    const { container } = render(
      <LudoBoard {...defaultProps} players={players} />,
    );

    // Should contain star polygons for safe squares
    const polygons = container.querySelectorAll('polygon');
    expect(polygons.length).toBeGreaterThanOrEqual(1);
  });

  it('should render base areas with coloured backgrounds', () => {
    const players = [
      makePlayer('p1', LudoColor.RED, [0, 0, 0, 0]),
      makePlayer('p2', LudoColor.GREEN, [0, 0, 0, 0]),
    ];

    const { container } = render(
      <LudoBoard {...defaultProps} players={players} />,
    );

    // Base area rects should exist
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBeGreaterThan(0);
  });
});
