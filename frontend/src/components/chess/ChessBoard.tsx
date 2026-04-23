'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { chessStrings } from './strings';
import { fenToAriaLabels } from './fenToAriaLabels';

// react-chessboard is a client-only library. Always import via `dynamic` with
// `ssr:false` to avoid Next.js App Router hydration mismatches.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Chessboard = dynamic<any>(
  () =>
    import('react-chessboard').then(
      (mod) => (mod as { Chessboard: React.ComponentType<unknown> }).Chessboard,
    ),
  { ssr: false, loading: () => <div data-testid="chessboard-loading" /> },
);

export interface ChessBoardProps {
  fen: string;
  orientation: 'white' | 'black';
  myTurn: boolean;
  pendingMove?: { from: string; to: string } | null;
  lastMove?: { from: string; to: string } | null;
  inCheckSquare?: string | null;
  onMoveAttempt: (
    from: string,
    to: string,
    promotion?: 'q' | 'r' | 'b' | 'n',
  ) => void;
  disabled?: boolean;
  /** Test hook: when true, skips the dynamic board and renders a stub. */
  testMode?: boolean;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

function algebraic(fileIdx: number, rankIdx: number): string {
  return `${FILES[fileIdx]}${RANKS[rankIdx]}`;
}

/**
 * react-chessboard wrapper with an accessible keyboard grid overlay.
 * Drag/drop and click moves are delegated to the library; keyboard users can
 * also traverse squares with arrow keys and confirm with Enter/Space.
 */
export function ChessBoard({
  fen,
  orientation,
  myTurn,
  pendingMove = null,
  lastMove = null,
  inCheckSquare = null,
  onMoveAttempt,
  disabled = false,
  testMode = false,
}: ChessBoardProps) {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [focusedSquare, setFocusedSquare] = useState<string>('e2');
  const gridRef = useRef<HTMLDivElement | null>(null);

  const labels = useMemo(() => fenToAriaLabels(fen), [fen]);

  const canInteract = myTurn && !disabled;

  const attemptMove = useCallback(
    (from: string, to: string) => {
      if (!canInteract) return false;
      if (from === to) return false;
      // Detect pawn promotion: a pawn moving to the last rank.
      const isPawn = labels[from]?.includes('pawn');
      const toRank = to[1];
      const isLastRank = toRank === '8' || toRank === '1';
      if (isPawn && isLastRank) {
        onMoveAttempt(from, to, 'q');
      } else {
        onMoveAttempt(from, to);
      }
      return true;
    },
    [canInteract, labels, onMoveAttempt],
  );

  // Handler for react-chessboard drag/drop.
  const handlePieceDrop = useCallback(
    (sourceSquare: string, targetSquare: string): boolean => {
      return attemptMove(sourceSquare, targetSquare);
    },
    [attemptMove],
  );

  const handleSquareClick = useCallback(
    (square: string) => {
      if (!canInteract) return;
      if (!selectedSource) {
        setSelectedSource(square);
        return;
      }
      if (attemptMove(selectedSource, square)) {
        setSelectedSource(null);
      } else {
        setSelectedSource(square);
      }
    },
    [attemptMove, canInteract, selectedSource],
  );

  const moveFocus = useCallback(
    (df: number, dr: number) => {
      const f = FILES.indexOf(focusedSquare[0] as typeof FILES[number]);
      const r = RANKS.indexOf(focusedSquare[1] as typeof RANKS[number]);
      if (f < 0 || r < 0) return;
      const dir = orientation === 'white' ? 1 : -1;
      const nf = Math.max(0, Math.min(7, f + df * dir));
      const nr = Math.max(0, Math.min(7, r + dr * dir));
      setFocusedSquare(algebraic(nf, nr));
    },
    [focusedSquare, orientation],
  );

  const handleGridKey = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          moveFocus(0, 1);
          return;
        case 'ArrowDown':
          e.preventDefault();
          moveFocus(0, -1);
          return;
        case 'ArrowRight':
          e.preventDefault();
          moveFocus(1, 0);
          return;
        case 'ArrowLeft':
          e.preventDefault();
          moveFocus(-1, 0);
          return;
        case 'Enter':
        case ' ':
          e.preventDefault();
          handleSquareClick(focusedSquare);
          return;
        case 'Escape':
          e.preventDefault();
          setSelectedSource(null);
          return;
        default:
          return;
      }
    },
    [focusedSquare, handleSquareClick, moveFocus],
  );

  // Build the 8×8 grid. Rows are displayed top-to-bottom per orientation.
  const displayedRanks =
    orientation === 'white' ? [...RANKS].reverse() : [...RANKS];
  const displayedFiles =
    orientation === 'white' ? [...FILES] : [...FILES].reverse();

  useEffect(() => {
    // If focus was on a square that no longer exists (shouldn't happen), reset.
    if (!labels[focusedSquare]) setFocusedSquare('e2');
  }, [labels, focusedSquare]);

  return (
    <div
      className="relative w-full aspect-square max-w-[min(90vh,640px)] mx-auto"
      data-testid="chess-board-wrapper"
    >
      {testMode ? (
        <div
          data-testid="chessboard-stub"
          role="img"
          aria-label={`Chess position ${fen}`}
          className="absolute inset-0 bg-stone-200"
        />
      ) : (
        <Chessboard
          id="chess-board"
          position={fen}
          boardOrientation={orientation}
          onPieceDrop={handlePieceDrop}
          onSquareClick={handleSquareClick}
          arePiecesDraggable={canInteract}
          customBoardStyle={{ borderRadius: '8px' }}
        />
      )}

      {/* Keyboard grid overlay — pointer events none by default (pass-through to board) */}
      <div
        ref={gridRef}
        role="grid"
        aria-label={chessStrings.board.label}
        className="absolute inset-0 grid grid-cols-8 grid-rows-8 pointer-events-none focus-within:pointer-events-auto"
        onKeyDown={handleGridKey}
      >
        {displayedRanks.map((rank) => (
          <div role="row" key={rank} className="contents">
            {displayedFiles.map((file) => {
              const sq = `${file}${rank}`;
              const focused = sq === focusedSquare;
              const selected = sq === selectedSource;
              const isPending = pendingMove?.from === sq || pendingMove?.to === sq;
              const isLast = lastMove?.from === sq || lastMove?.to === sq;
              const inCheck = inCheckSquare === sq;
              let extra = '';
              if (selected) extra += ' ring-2 ring-amber-500';
              if (isPending) extra += ' outline-dashed outline-2 outline-sky-500';
              if (isLast) extra += ' bg-amber-300/30';
              if (inCheck) extra += ' bg-red-400/40';
              return (
                <button
                  key={sq}
                  type="button"
                  role="gridcell"
                  tabIndex={focused ? 0 : -1}
                  aria-selected={selected}
                  aria-label={labels[sq] ?? `${chessStrings.square} ${sq}`}
                  data-square={sq}
                  onClick={() => handleSquareClick(sq)}
                  onFocus={() => setFocusedSquare(sq)}
                  disabled={!canInteract}
                  className={`bg-transparent border-0 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-0${extra}`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
