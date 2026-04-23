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
        className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl"
        aria-label={chessStrings.history.label}
      >
        <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-2">
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
      className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl max-h-60 overflow-y-auto"
      aria-label={chessStrings.history.label}
    >
      <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-2">
        {chessStrings.history.label}
      </h3>
      <ol
        className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1 text-sm font-mono"
        data-testid="chess-history-list"
      >
        {pairs.map((pair) => (
          <li
            key={pair.num}
            className="contents"
            data-testid={`chess-history-row-${pair.num}`}
          >
            <span className="text-white/40">{pair.num}.</span>
            <span className="text-white">{pair.white.san}</span>
            <span className="text-white">{pair.black?.san ?? ''}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
