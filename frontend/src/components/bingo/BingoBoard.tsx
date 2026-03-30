'use client';

import { motion } from 'framer-motion';
import type { BingoBoard as BingoBoardType } from '@/shared';

interface BingoBoardProps {
  board: BingoBoardType;
  /** Setup phase: called when player clicks an empty cell */
  onCellClick?: (row: number, col: number) => void;
  /** Play phase: called when player clicks an unchosen number on board */
  onNumberChoose?: (num: number) => void;
  /** Numbers already chosen (for play phase - greys out chosen ones) */
  chosenNumbers?: number[];
  /** Whether it's the player's turn (to enable play-phase clicking) */
  isMyTurn?: boolean;
  /** Play phase: the number being placed next (shown as hint) */
  nextPlaceNumber?: number;
  /** Whether interaction is disabled */
  disabled?: boolean;
  /** Label shown above the board */
  label?: string;
  /** If true, render smaller (used for opponent board) */
  compact?: boolean;
  /** The last called number to highlight */
  lastCalledNumber?: number;
}

export function BingoBoard({
  board,
  onCellClick,
  onNumberChoose,
  chosenNumbers = [],
  isMyTurn = false,
  nextPlaceNumber,
  disabled = false,
  label,
  compact = false,
  lastCalledNumber,
}: BingoBoardProps) {
  const cellSize = compact
    ? 'w-10 h-10 text-sm'
    : 'w-14 h-14 sm:w-16 sm:h-16 text-lg';

  return (
    <div className={compact ? 'w-full max-w-xs mx-auto' : 'w-full max-w-sm mx-auto'}>
      {label && (
        <p className="text-center text-sm text-white/40 uppercase tracking-wider mb-2 font-semibold">
          {label}
        </p>
      )}

      {/* B I N G O header */}
      <div className="grid grid-cols-5 gap-1.5 mb-1.5">
        {['B', 'I', 'N', 'G', 'O'].map((letter, i) => (
          <div
            key={letter}
            className={`text-center font-black ${compact ? 'text-base' : 'text-xl'} ${
              ['text-blue-400', 'text-red-400', 'text-green-400', 'text-yellow-400', 'text-purple-400'][i]
            }`}
          >
            {letter}
          </div>
        ))}
      </div>

      {/* Board cells */}
      <div className="grid grid-cols-5 gap-1.5">
        {board.map((row, rowIdx) =>
          row.map((cell, colIdx) => {
            const isEmpty = cell.value === 0;
            const isMarked = cell.marked;
            const isLastCalled = lastCalledNumber !== undefined && cell.value === lastCalledNumber && isMarked;
            const canClickSetup = !disabled && onCellClick && isEmpty;
            const canClickPlay = !disabled && onNumberChoose && isMyTurn && !isEmpty && !isMarked && !chosenNumbers.includes(cell.value);
            const canClick = canClickSetup || canClickPlay;

            return (
              <motion.button
                key={`${rowIdx}-${colIdx}`}
                whileTap={canClick ? { scale: 0.9 } : undefined}
                animate={
                  isLastCalled
                    ? { scale: [1, 1.2, 1], transition: { duration: 0.4 } }
                    : isMarked
                      ? { scale: [1, 1.1, 1], transition: { duration: 0.25 } }
                      : undefined
                }
                onClick={() => {
                  if (canClickSetup && onCellClick) onCellClick(rowIdx, colIdx);
                  if (canClickPlay && onNumberChoose) onNumberChoose(cell.value);
                }}
                disabled={!canClick}
                className={`${cellSize} rounded-lg font-bold flex items-center justify-center
                  transition-all duration-150 select-none
                  ${
                    isEmpty
                      ? canClickSetup
                        ? 'bg-white/[0.03] border-2 border-dashed border-white/40 text-white/60 hover:border-white/30 hover:bg-white/10 cursor-pointer'
                        : 'bg-white/[0.03] border border-white/[0.06] text-white/40/30'
                      : isLastCalled
                        ? 'bg-yellow-500/40 border-2 border-yellow-400 text-white ring-2 ring-yellow-400/50'
                        : isMarked
                          ? 'bg-white/30 border-2 border-white/30 text-white line-through decoration-2'
                          : canClickPlay
                            ? 'bg-white/[0.03] border-2 border-green-400/50 text-white hover:bg-green-500/20 hover:border-green-400 cursor-pointer'
                            : 'bg-white/[0.03] border border-white/[0.06] text-white'
                  }`}
              >
                {isEmpty
                  ? canClick
                    ? nextPlaceNumber || ''
                    : ''
                  : cell.value}
              </motion.button>
            );
          }),
        )}
      </div>
    </div>
  );
}
