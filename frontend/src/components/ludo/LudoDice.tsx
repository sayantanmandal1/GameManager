'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';

// ─── Dice Face Dot Patterns (classic die layout) ───
const DOT_PATTERNS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.25, 0.25], [0.75, 0.75]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]],
  5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
  6: [[0.25, 0.2], [0.75, 0.2], [0.25, 0.5], [0.75, 0.5], [0.25, 0.8], [0.75, 0.8]],
};

interface DieFaceProps {
  value: number;
  isRolling: boolean;
  isSix: boolean;
}

function DieFace({ value, isRolling, isSix }: DieFaceProps) {
  const dots = DOT_PATTERNS[value] || DOT_PATTERNS[1];
  const size = 80;

  return (
    <motion.div
      className={`relative rounded-2xl shadow-xl border border-white/10 ${
        isSix
          ? 'bg-gradient-to-br from-yellow-400/90 to-amber-500/90 ring-2 ring-yellow-300 shadow-yellow-400/40'
          : 'bg-gradient-to-br from-white/95 to-gray-100/95'
      }`}
      style={{ width: size, height: size, backdropFilter: 'blur(8px)' }}
      animate={
        isRolling
          ? {
              rotate: [0, 90, 180, 270, 360],
              scale: [1, 0.85, 1.15, 0.9, 1],
            }
          : { rotate: 0, scale: 1 }
      }
      transition={
        isRolling
          ? { duration: 0.5, repeat: Infinity, ease: 'easeInOut' }
          : { type: 'spring', stiffness: 300, damping: 20 }
      }
    >
      <svg viewBox="0 0 1 1" width={size} height={size}>
        {dots.map(([cx, cy], i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={0.1}
            fill={isSix ? '#1a1a2e' : '#1a1a2e'}
          />
        ))}
      </svg>
    </motion.div>
  );
}

// ─── Main Dice Component ───

interface LudoDiceProps {
  dice: number | null;
  isRolling: boolean;
  onRoll: () => void;
  disabled: boolean;
  isMyTurn: boolean;
  showRollButton: boolean;
}

export function LudoDice({
  dice,
  isRolling,
  onRoll,
  disabled,
  isMyTurn,
  showRollButton,
}: LudoDiceProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Dice display */}
      <div className="flex gap-3 items-center">
        {dice != null ? (
          <DieFace value={dice} isRolling={isRolling} isSix={dice === 6} />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-white/5 backdrop-blur-md border-2 border-dashed border-white/20 flex items-center justify-center text-white/30 text-2xl">
            ?
          </div>
        )}
      </div>

      {/* Result display */}
      {dice != null && !isRolling && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-white/50"
        >
          Rolled: <span className="text-white font-bold text-base">{dice}</span>
          {dice === 6 && (
            <span className="ml-2 text-yellow-400 font-bold animate-pulse">Six!</span>
          )}
        </motion.div>
      )}

      {/* Roll button */}
      {showRollButton && (
        <Button
          onClick={onRoll}
          disabled={disabled || !isMyTurn || isRolling}
          className={`${isMyTurn && !disabled ? 'animate-pulse-glow' : ''} px-6 py-3 text-base`}
        >
          {isRolling ? '🎲 Rolling…' : '🎲 Roll Dice'}
        </Button>
      )}
    </div>
  );
}
