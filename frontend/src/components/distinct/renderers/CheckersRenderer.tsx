'use client';

import { useEffect, useState } from 'react';
import type { CheckersAction, CheckersPlayerView } from '@/shared';

interface CheckersRendererProps {
  view: CheckersPlayerView;
  disabled: boolean;
  onMove: (action: CheckersAction) => void;
}

export function CheckersRenderer({ view, disabled, onMove }: CheckersRendererProps) {
  const [selected, setSelected] = useState<number | null>(view.mustContinueFrom);

  useEffect(() => {
    setSelected(view.mustContinueFrom);
  }, [view.board, view.mustContinueFrom]);

  const movable = new Set(view.legalMoves.map((move) => move.from));
  const destinations = new Set(
    view.legalMoves.filter((move) => move.from === selected).map((move) => move.to),
  );

  const choose = (cell: number) => {
    if (disabled || !view.canAct) return;
    if (selected !== null && destinations.has(cell)) {
      onMove({ from: selected, to: cell });
      return;
    }
    if (movable.has(cell)) setSelected(cell);
  };

  return (
    <div className="w-full max-w-[38rem]">
      <div className="mb-3 flex h-6 items-center justify-center text-sm font-bold text-game-coral">
        {view.mandatoryCapture ? 'Capture required' : 'Diagonal move'}
      </div>
      <div className="grid aspect-square grid-cols-8 overflow-hidden rounded-lg border-4 border-[#261715] bg-[#ead8bb] shadow-2xl shadow-black/30">
        {view.board.map((piece, cell) => {
          const row = Math.floor(cell / 8);
          const column = cell % 8;
          const dark = (row + column) % 2 === 1;
          const isSelected = selected === cell;
          const destination = destinations.has(cell);
          const canSelect = view.canAct && movable.has(cell) && !disabled;
          return (
            <button
              key={cell}
              type="button"
              disabled={!dark || (!canSelect && !destination)}
              onClick={() => choose(cell)}
              aria-label={`Checkers square ${row + 1}, ${column + 1}${piece?.king ? ', king' : ''}`}
              className={`relative flex aspect-square items-center justify-center disabled:cursor-default ${dark ? 'bg-[#6d3f35]' : 'bg-[#ead8bb]'} ${isSelected ? 'outline outline-4 outline-inset outline-game-sun' : ''}`}
            >
              {destination && <span className="absolute h-4 w-4 rounded-full bg-game-mint/75" />}
              {piece && (
                <span className={`relative flex h-[70%] w-[70%] items-center justify-center rounded-full border-4 shadow-lg ${piece.playerId === view.players[0].id ? 'border-[#ff9488] bg-[#c43f36]' : 'border-[#6d7380] bg-[#17191d]'}`}>
                  {piece.king && <span className="text-sm font-black text-game-sun sm:text-xl">K</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}