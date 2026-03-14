'use client';

import { motion } from 'framer-motion';
import type { BingoBoard as BingoBoardType } from '@multiplayer-games/shared';

interface BingoBoardProps {
  board: BingoBoardType;
  /** Setup phase: called when player clicks an empty cell */
  onCellClick?: (row: number, col: number) => void;
  /** Play phase: the number being placed next (shown as hint) */
  nextPlaceNumber?: number;
  /** Whether interaction is disabled */
  disabled?: boolean;
  /** Label shown above the board */
  label?: string;
  /** If true, render smaller (used for opponent board) */
  compact?: boolean;
}

export function BingoBoard({
  board,
  onCellClick,
  nextPlaceNumber,
  disabled = false,
  label,
  compact = false,
}: BingoBoardProps) {
  const cellSize = compact
    ? 'w-10 h-10 text-sm'
    : 'w-14 h-14 sm:w-16 sm:h-16 text-lg';

  return (
    <div className={compact ? 'w-full max-w-xs mx-auto' : 'w-full max-w-sm mx-auto'}>
      {label && (
        <p className="text-center text-sm text-game-muted uppercase tracking-wider mb-2 font-semibold">
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
            const canClick = !disabled && onCellClick && isEmpty;

            return (
              <motion.button
                key={`${rowIdx}-${colIdx}`}
                whileTap={canClick ? { scale: 0.9 } : undefined}
                animate={
                  isMarked
                    ? { scale: [1, 1.1, 1], transition: { duration: 0.25 } }
                    : undefined
                }
                onClick={() => {
                  if (canClick) onCellClick(rowIdx, colIdx);
                }}
                disabled={!canClick}
                className={`${cellSize} rounded-lg font-bold flex items-center justify-center
                  transition-all duration-150 select-none
                  ${
                    isEmpty
                      ? canClick
                        ? 'bg-game-card border-2 border-dashed border-primary/40 text-primary/60 hover:border-primary hover:bg-primary/10 cursor-pointer'
                        : 'bg-game-card border border-game-border text-game-muted/30'
                      : isMarked
                        ? 'bg-primary/30 border-2 border-primary text-white line-through decoration-2'
                        : 'bg-game-card border border-game-border text-white'
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
