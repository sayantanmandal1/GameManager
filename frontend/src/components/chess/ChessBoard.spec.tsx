/**
 * Tests for components/chess/ChessBoard.tsx
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChessBoard } from './ChessBoard';

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => {
    const Stub = (props: Record<string, unknown>) => (
      <div data-testid="mock-chessboard" data-props={JSON.stringify(Object.keys(props))} />
    );
    Stub.displayName = 'DynamicStub';
    return Stub;
  },
}));

describe('ChessBoard', () => {
  const defaultProps = {
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    orientation: 'white' as const,
    myTurn: true,
    pendingMove: null,
    lastMove: null,
    onMoveAttempt: jest.fn(),
    disabled: false,
    testMode: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing (no SSR path)', () => {
    const { container } = render(<ChessBoard {...defaultProps} />);
    expect(container.querySelector('[data-testid="chess-board-wrapper"]')).toBeInTheDocument();
  });

  it('renders 64 keyboard grid cells with ARIA labels', () => {
    render(<ChessBoard {...defaultProps} />);
    const cells = screen.getAllByRole('gridcell');
    expect(cells).toHaveLength(64);
    // Sanity: e2 should carry "white pawn"
    const e2 = cells.find((c) => c.getAttribute('data-square') === 'e2');
    expect(e2?.getAttribute('aria-label')).toContain('white pawn');
    const e4 = cells.find((c) => c.getAttribute('data-square') === 'e4');
    expect(e4?.getAttribute('aria-label')).toContain('empty');
  });

  it('fires onMoveAttempt when clicking source then target', () => {
    const onMoveAttempt = jest.fn();
    render(<ChessBoard {...defaultProps} onMoveAttempt={onMoveAttempt} />);
    const cells = screen.getAllByRole('gridcell');
    const e2 = cells.find((c) => c.getAttribute('data-square') === 'e2')!;
    const e4 = cells.find((c) => c.getAttribute('data-square') === 'e4')!;
    fireEvent.click(e2);
    fireEvent.click(e4);
    expect(onMoveAttempt).toHaveBeenCalledWith('e2', 'e4');
  });

  it('does not fire onMoveAttempt when not your turn', () => {
    const onMoveAttempt = jest.fn();
    render(<ChessBoard {...defaultProps} myTurn={false} onMoveAttempt={onMoveAttempt} />);
    const cells = screen.getAllByRole('gridcell');
    const e2 = cells.find((c) => c.getAttribute('data-square') === 'e2')!;
    const e4 = cells.find((c) => c.getAttribute('data-square') === 'e4')!;
    fireEvent.click(e2);
    fireEvent.click(e4);
    expect(onMoveAttempt).not.toHaveBeenCalled();
  });

  it('does not fire onMoveAttempt when disabled', () => {
    const onMoveAttempt = jest.fn();
    render(
      <ChessBoard {...defaultProps} disabled onMoveAttempt={onMoveAttempt} />,
    );
    const cells = screen.getAllByRole('gridcell');
    const e2 = cells.find((c) => c.getAttribute('data-square') === 'e2')!;
    const e4 = cells.find((c) => c.getAttribute('data-square') === 'e4')!;
    fireEvent.click(e2);
    fireEvent.click(e4);
    expect(onMoveAttempt).not.toHaveBeenCalled();
  });

  it('auto-promotes to queen on pawn reaching last rank', () => {
    const onMoveAttempt = jest.fn();
    // White pawn on a7 about to promote on a8
    const fen = '8/P7/8/8/8/8/8/k6K w - - 0 1';
    render(
      <ChessBoard
        {...defaultProps}
        fen={fen}
        onMoveAttempt={onMoveAttempt}
      />,
    );
    const cells = screen.getAllByRole('gridcell');
    const a7 = cells.find((c) => c.getAttribute('data-square') === 'a7')!;
    const a8 = cells.find((c) => c.getAttribute('data-square') === 'a8')!;
    fireEvent.click(a7);
    fireEvent.click(a8);
    expect(onMoveAttempt).toHaveBeenCalledWith('a7', 'a8', 'q');
  });
});
