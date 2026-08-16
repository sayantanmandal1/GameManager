'use client';

import type { ChessMove } from '@/shared';
import { chessStrings } from './strings';

export interface ChessHistoryProps {
  moves: ChessMove[];
}

/** Display move list paired per full-move number (SAN). */
export function ChessHistory({ moves }: ChessHistoryProps) {
  if (moves.length === 0) {
    return (
      <div
        className="rounded-lg border border-white/12 bg-[#22241d] p-4"
        aria-label={chessStrings.history.label}
      >
        <h3 className="mb-2 text-sm font-semibold text-game-muted">
          {chessStrings.history.label}
        </h3>
        <p className="text-xs text-white/40">{chessStrings.history.empty}</p>
      </div>
    );
  }

  const pairs: Array<{ num: number; white: ChessMove; black: ChessMove | null }> = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      num: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1] ?? null,
    });
  }

  return (
    <div
      className="max-h-64 overflow-y-auto rounded-lg border border-white/12 bg-[#22241d] p-4"
      aria-label={chessStrings.history.label}
    >
      <h3 className="sticky top-0 mb-3 bg-[#22241d] pb-2 text-sm font-semibold text-game-muted">
        {chessStrings.history.label}
      </h3>
      <ol
        className="grid grid-cols-[auto_1fr_1fr] gap-x-4 gap-y-2 font-mono text-sm"
        data-testid="chess-history-list"
      >
        {pairs.map((pair) => (
          <li
            key={pair.num}
            className="contents"
            data-testid={`chess-history-row-${pair.num}`}
          >
            <span className="text-game-muted">{pair.num}.</span>
            <span className="rounded bg-[#eee8d7]/8 px-2 py-0.5 text-[#eee8d7]">{pair.white.san}</span>
            <span className="rounded bg-black/20 px-2 py-0.5 text-[#c3c8bc]">{pair.black?.san ?? ''}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
