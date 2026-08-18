/**
 * Tests for components/ludo/LudoBoard.tsx
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { LudoBoard } from './LudoBoard';
import { LudoColor, LudoPlayerState, LUDO_FINISHED_STEPS } from '@/shared';

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
      state: s === 0 ? ('base' as const) : s >= LUDO_FINISHED_STEPS ? ('home' as const) : ('active' as const),
      stepsFromStart: s,
    })),
    finishedCount: tokenSteps.filter((s) => s >= LUDO_FINISHED_STEPS).length,
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
      makePlayer('p1', LudoColor.RED, [0, 1, 52, 57]),
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
      'translate(306 340)',
    );
  });

  it('separates tokens sharing a safe square and gives the movable token its own hitbox', () => {
    const players = [
      makePlayer('p1', LudoColor.RED, [14, 0, 0, 0]),
      makePlayer('p2', LudoColor.GREEN, [1, 0, 0, 0]),
    ];

    const { container } = render(
      <LudoBoard
        {...defaultProps}
        players={players}
        availableMoves={[[{ tokenId: 0, steps: 2 }]]}
      />,
    );

    const redToken = container.querySelector('[data-ludo-token="red-0"]');
    const greenToken = container.querySelector('[data-ludo-token="green-0"]');
    expect(redToken).toHaveAttribute('data-stack-count', '2');
    expect(greenToken).toHaveAttribute('data-stack-count', '2');
    expect(redToken?.getAttribute('transform')).not.toBe(greenToken?.getAttribute('transform'));
    expect(container.querySelector('[data-ludo-hitbox="red-0"]')).toHaveAttribute(
      'pointer-events',
      'all',
    );
    expect(container.querySelector('[data-ludo-hitbox="green-0"]')).toHaveAttribute(
      'pointer-events',
      'none',
    );
  });

  it('assigns every finished pawn a unique slot inside its color home', () => {
    const players = [
      makePlayer('p1', LudoColor.RED, [57, 57, 57, 57]),
      makePlayer('p2', LudoColor.GREEN, [57, 57, 57, 57]),
      makePlayer('p3', LudoColor.YELLOW, [57, 57, 57, 57]),
      makePlayer('p4', LudoColor.BLUE, [57, 57, 57, 57]),
    ];

    const { container } = render(
      <LudoBoard {...defaultProps} players={players} />,
    );

    const transforms = Array.from(container.querySelectorAll('[data-ludo-token]'))
      .map((token) => token.getAttribute('transform'));
    expect(new Set(transforms).size).toBe(16);
    expect(container.querySelector('[data-ludo-token="red-0"]')).toHaveAttribute(
      'transform',
      'translate(282 304)',
    );
    expect(container.querySelector('[data-ludo-token="green-0"]')).toHaveAttribute(
      'transform',
      'translate(356 282)',
    );
    expect(container.querySelector('[data-ludo-token="yellow-0"]')).toHaveAttribute(
      'transform',
      'translate(378 356)',
    );
    expect(container.querySelector('[data-ludo-token="blue-0"]')).toHaveAttribute(
      'transform',
      'translate(304 378)',
    );
  });

  it('gives all sixteen pawns non-overlapping full-slot hitboxes on one safe square', () => {
    const players = [
      makePlayer('p1', LudoColor.RED, [14, 14, 14, 14]),
      makePlayer('p2', LudoColor.GREEN, [1, 1, 1, 1]),
      makePlayer('p3', LudoColor.YELLOW, [40, 40, 40, 40]),
      makePlayer('p4', LudoColor.BLUE, [27, 27, 27, 27]),
    ];

    const { container } = render(
      <LudoBoard
        {...defaultProps}
        players={players}
        availableMoves={[[{ tokenId: 0, steps: 2 }]]}
      />,
    );

    const tokens = Array.from(container.querySelectorAll('[data-ludo-token]'));
    expect(tokens.every((token) => token.getAttribute('data-stack-count') === '16')).toBe(true);
    expect(new Set(tokens.map((token) => token.getAttribute('transform'))).size).toBe(16);
    const hitbox = container.querySelector('[data-ludo-hitbox="red-0"]');
    expect(Number(hitbox?.getAttribute('width'))).toBeGreaterThan(10);
    expect(Number(hitbox?.getAttribute('height'))).toBeGreaterThan(10);
    expect(hitbox).toHaveAttribute('pointer-events', 'all');
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
