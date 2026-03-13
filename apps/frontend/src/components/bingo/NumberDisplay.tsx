'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { BINGO_COLUMNS, BINGO_COLUMN_RANGES } from '@multiplayer-games/shared';

function getColumnLetter(num: number): string {
  for (let i = 0; i < BINGO_COLUMNS.length; i++) {
    const col = BINGO_COLUMNS[i];
    const [min, max] = BINGO_COLUMN_RANGES[col];
    if (num >= min && num <= max) return col;
  }
  return '';
}

const LETTER_COLORS: Record<string, string> = {
  B: 'from-blue-500 to-blue-700',
  I: 'from-red-500 to-red-700',
  N: 'from-green-500 to-green-700',
  G: 'from-yellow-500 to-yellow-700',
  O: 'from-purple-500 to-purple-700',
};

interface NumberDisplayProps {
  currentNumber: number | null;
  calledNumbers: number[];
}

export function NumberDisplay({
  currentNumber,
  calledNumbers,
}: NumberDisplayProps) {
  const letter = currentNumber ? getColumnLetter(currentNumber) : '';
  const gradient = letter ? LETTER_COLORS[letter] : 'from-gray-500 to-gray-700';

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Current number */}
      <div className="text-center">
        <p className="text-sm text-game-muted mb-2 uppercase tracking-wider">
          Current Number
        </p>
        <AnimatePresence mode="wait">
          {currentNumber ? (
            <motion.div
              key={currentNumber}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              className={`w-24 h-24 rounded-full bg-gradient-to-br ${gradient}
                flex flex-col items-center justify-center shadow-2xl`}
            >
              <span className="text-sm font-bold text-white/80">{letter}</span>
              <span className="text-3xl font-black text-white">
                {currentNumber}
              </span>
            </motion.div>
          ) : (
            <div className="w-24 h-24 rounded-full bg-game-card border border-game-border flex items-center justify-center">
              <span className="text-game-muted">—</span>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Called numbers history */}
      <div className="w-full">
        <p className="text-xs text-game-muted mb-2 uppercase tracking-wider">
          Called ({calledNumbers.length}/75)
        </p>
        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
          {[...calledNumbers].reverse().map((num) => {
            const l = getColumnLetter(num);
            return (
              <span
                key={num}
                className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold
                  bg-gradient-to-br ${LETTER_COLORS[l] || 'from-gray-500 to-gray-700'} text-white/90`}
              >
                {num}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
