'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface NumberDisplayProps {
  /** Numbers 1-25 that have been called so far */
  chosenNumbers: number[];
  /** Is it this player's turn? */
  isMyTurn: boolean;
  /** Callback when a number is chosen */
  onChooseNumber: (num: number) => void;
  /** Completed line counts */
  completedLines: Record<string, number>;
  /** Current user ID */
  userId: string;
  /** All player IDs */
  players: string[];
  disabled?: boolean;
}

export function NumberDisplay({
  chosenNumbers,
  isMyTurn,
  onChooseNumber,
  completedLines,
  userId,
  players,
  disabled = false,
}: NumberDisplayProps) {
  const allNumbers = Array.from({ length: 25 }, (_, i) => i + 1);
  const lastCalled = chosenNumbers.length > 0 ? chosenNumbers[chosenNumbers.length - 1] : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Last called number */}
      {lastCalled !== null && (
        <div className="text-center">
          <p className="text-xs text-game-muted uppercase tracking-wider mb-1">Last Called</p>
          <motion.div
            key={lastCalled}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-yellow-500/20 border-2 border-yellow-400 text-yellow-300 text-3xl font-black"
          >
            {lastCalled}
          </motion.div>
        </div>
      )}

      {/* Turn indicator */}
      <div className="text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={isMyTurn ? 'your-turn' : 'opponent-turn'}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={`inline-block px-4 py-2 rounded-full text-sm font-bold ${
              isMyTurn
                ? 'bg-primary/20 text-primary border border-primary/50'
                : 'bg-game-card text-game-muted border border-game-border'
            }`}
          >
            {isMyTurn ? '🎯 Your Turn — Pick a number!' : "⏳ Opponent's Turn…"}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Strategy hint */}
      {isMyTurn && !disabled && (
        <p className="text-xs text-game-muted text-center italic">
          Pick a number that completes YOUR lines — but remember, it marks on both boards!
        </p>
      )}

      {/* BINGO progress */}
      <div className="bg-game-card border border-game-border rounded-xl p-4">
        <h3 className="text-xs text-game-muted uppercase tracking-wider mb-3">
          BINGO Progress
        </h3>
        {players.map((pid) => {
          const lines = completedLines[pid] || 0;
          const letters = 'BINGO';
          const isMe = pid === userId;
          return (
            <div key={pid} className="flex items-center gap-2 mb-2 last:mb-0">
              <span className={`text-xs min-w-[60px] ${isMe ? 'text-primary font-bold' : 'text-game-muted'}`}>
                {isMe ? 'You' : 'Opponent'}
              </span>
              <div className="flex gap-1">
                {letters.split('').map((letter, i) => (
                  <span
                    key={i}
                    className={`w-7 h-7 rounded flex items-center justify-center text-sm font-black ${
                      i < lines
                        ? 'bg-primary text-white'
                        : 'bg-game-bg text-game-muted/40 border border-game-border'
                    }`}
                  >
                    {letter}
                  </span>
                ))}
              </div>
              <span className="text-xs text-game-muted ml-auto">{lines}/5</span>
            </div>
          );
        })}
      </div>

      {/* Number picker grid */}
      <div className="bg-game-card border border-game-border rounded-xl p-4">
        <h3 className="text-xs text-game-muted uppercase tracking-wider mb-3">
          Choose a Number ({chosenNumbers.length}/25 used)
        </h3>
        <div className="grid grid-cols-5 gap-2">
          {allNumbers.map((num) => {
            const isChosen = chosenNumbers.includes(num);
            const canPick = isMyTurn && !isChosen && !disabled;
            return (
              <motion.button
                key={num}
                whileTap={canPick ? { scale: 0.85 } : undefined}
                onClick={() => canPick && onChooseNumber(num)}
                disabled={!canPick}
                className={`w-full aspect-square rounded-lg text-sm font-bold transition-all ${
                  isChosen
                    ? 'bg-game-bg text-game-muted/30 line-through cursor-default'
                    : canPick
                      ? 'bg-primary/20 text-primary border border-primary/50 hover:bg-primary/40 cursor-pointer'
                      : 'bg-game-bg text-game-muted/60 border border-game-border cursor-not-allowed'
                }`}
              >
                {num}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
