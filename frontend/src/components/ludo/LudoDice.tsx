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
  const size = 64;

  return (
    <motion.div
      className={`relative rounded-xl bg-white shadow-lg ${
        isSix ? 'ring-2 ring-yellow-400 shadow-yellow-400/30' : ''
      }`}
      style={{ width: size, height: size }}
      animate={
        isRolling
          ? {
              rotate: [0, 90, 180, 270, 360],
              scale: [1, 0.9, 1.1, 0.95, 1],
            }
          : { rotate: 0, scale: 1 }
      }
      transition={
        isRolling
          ? { duration: 0.6, repeat: Infinity, ease: 'easeInOut' }
          : { type: 'spring', stiffness: 300, damping: 20 }
      }
    >
      <svg viewBox="0 0 1 1" width={size} height={size}>
        {dots.map(([cx, cy], i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={0.09}
            fill={isSix ? '#F59E0B' : '#1a1a2e'}
          />
        ))}
      </svg>
    </motion.div>
  );
}

// ─── Main Dice Component ───

interface LudoDiceProps {
  dice: [number, number] | null;
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
        {dice ? (
          <>
            <DieFace value={dice[0]} isRolling={isRolling} isSix={dice[0] === 6} />
            <DieFace value={dice[1]} isRolling={isRolling} isSix={dice[1] === 6} />
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-xl bg-game-card border-2 border-dashed border-game-border flex items-center justify-center text-game-muted">
              ?
            </div>
            <div className="w-16 h-16 rounded-xl bg-game-card border-2 border-dashed border-game-border flex items-center justify-center text-game-muted">
              ?
            </div>
          </>
        )}
      </div>

      {/* Sum display */}
      {dice && !isRolling && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-game-muted"
        >
          Total: <span className="text-white font-bold">{dice[0] + dice[1]}</span>
          {(dice[0] === 6 || dice[1] === 6) && (
            <span className="ml-2 text-yellow-400 font-bold">🎉 Six!</span>
          )}
        </motion.div>
      )}

      {/* Roll button */}
      {showRollButton && (
        <Button
          onClick={onRoll}
          disabled={disabled || !isMyTurn || isRolling}
          className={isMyTurn && !disabled ? 'animate-pulse-glow' : ''}
        >
          {isRolling ? '🎲 Rolling…' : '🎲 Roll Dice'}
        </Button>
      )}
    </div>
  );
}
