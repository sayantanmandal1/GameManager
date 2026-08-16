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

    expect(container.querySelectorAll('[data-ludo-token]')).toHaveLength(8);
  });

  it('positions tokens in the yard, track, home lane, and finish using native SVG transforms', () => {
    const players = [
      makePlayer('p1', LudoColor.RED, [0, 1, 53, 59]),
    ];

    const { container } = render(
      <LudoBoard {...defaultProps} players={players} />,
    );

    expect(container.querySelector('[data-ludo-token="red-0"]')).toHaveAttribute(
      'transform',
      'translate(88 88)',
    );
    expect(container.querySelector('[data-ludo-token="red-1"]')).toHaveAttribute(
      'transform',
      'translate(66 286)',
    );
    expect(container.querySelector('[data-ludo-token="red-2"]')).toHaveAttribute(
      'transform',
      'translate(66 330)',
    );
    expect(container.querySelector('[data-ludo-token="red-3"]')).toHaveAttribute(
      'transform',
      'translate(321.2 321.2)',
    );
  });

  it('aligns each center triangle with its matching home lane', () => {
    const { container } = render(
      <LudoBoard {...defaultProps} players={[makePlayer('p1', LudoColor.RED, [0, 0, 0, 0])]} />,
    );

    expect(container.querySelector('[data-home-triangle="red"]')).toHaveAttribute(
      'points',
      '264,264 330,330 264,396',
    );
    expect(container.querySelector('[data-home-triangle="green"]')).toHaveAttribute(
      'points',
      '264,264 396,264 330,330',
    );
    expect(container.querySelector('[data-home-triangle="yellow"]')).toHaveAttribute(
      'points',
      '396,264 396,396 330,330',
    );
    expect(container.querySelector('[data-home-triangle="blue"]')).toHaveAttribute(
      'points',
      '264,396 330,330 396,396',
    );
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
