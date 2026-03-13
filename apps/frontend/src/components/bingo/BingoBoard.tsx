'use client';

import { motion } from 'framer-motion';
import type { BingoBoard as BingoBoardType } from '@multiplayer-games/shared';
import { BINGO_COLUMNS } from '@multiplayer-games/shared';

const COLUMN_COLORS = [
  'text-blue-400',   // B
  'text-red-400',    // I
  'text-green-400',  // N
  'text-yellow-400', // G
  'text-purple-400', // O
];

interface BingoBoardProps {
  board: BingoBoardType;
  currentNumber: number | null;
  onMarkNumber: (number: number) => void;
  disabled?: boolean;
}

export function BingoBoard({
  board,
  currentNumber,
  onMarkNumber,
  disabled = false,
}: BingoBoardProps) {
  return (
    <div className="w-full max-w-md mx-auto">
      {/* Header row: B I N G O */}
      <div className="grid grid-cols-5 gap-2 mb-2">
        {BINGO_COLUMNS.map((letter, i) => (
          <div
            key={letter}
            className={`text-center text-2xl font-black ${COLUMN_COLORS[i]}`}
          >
            {letter}
          </div>
        ))}
      </div>

      {/* Board cells */}
      <div className="grid grid-cols-5 gap-2">
        {board.map((row, rowIdx) =>
          row.map((cell, colIdx) => {
            const isFree = cell.value === 'FREE';
            const isCalled =
              !isFree && cell.value === currentNumber && !cell.marked;
            const canMark = isCalled && !disabled;

            return (
              <motion.button
                key={`${rowIdx}-${colIdx}`}
                whileTap={canMark ? { scale: 0.9 } : undefined}
                animate={
                  cell.marked && !isFree
                    ? { scale: [1, 1.15, 1], transition: { duration: 0.3 } }
                    : undefined
                }
                onClick={() => {
                  if (canMark && typeof cell.value === 'number') {
                    onMarkNumber(cell.value);
                  }
                }}
                disabled={!canMark}
                className={`bingo-cell ${
                  isFree
                    ? 'free'
                    : cell.marked
                      ? 'marked'
                      : isCalled
                        ? 'called unmarked'
                        : 'unmarked'
                }`}
              >
                {isFree ? '★' : cell.value}
              </motion.button>
            );
          }),
        )}
      </div>
    </div>
  );
}
