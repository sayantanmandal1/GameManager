'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface NumberDisplayProps {
  chosenNumbers: number[];
  /** Who called each number: number → playerId */
  calledBy: Record<number, string>;
  isMyTurn: boolean;
  /** Only YOUR completed line count */
  myCompletedLines: number;
  userId: string;
  /** playerId → username */
  playerNames: Record<string, string>;
  disabled?: boolean;
}

export function NumberDisplay({
  chosenNumbers,
  calledBy,
  isMyTurn,
  myCompletedLines,
  userId,
  playerNames,
  disabled = false,
}: NumberDisplayProps) {
  const allNumbers = Array.from({ length: 25 }, (_, i) => i + 1);
  const lastCalled = chosenNumbers.length > 0 ? chosenNumbers[chosenNumbers.length - 1] : null;
  const lastCalledBy = lastCalled !== null ? calledBy[lastCalled] : null;
  const lastCalledByName = lastCalledBy
    ? lastCalledBy === userId
      ? 'You'
      : playerNames[lastCalledBy] || 'Opponent'
    : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Last called number with who called it */}
      {lastCalled !== null && (
        <div className="text-center">
          <p className="mb-2 text-xs font-bold uppercase text-game-muted">Last Called</p>
          <motion.div
            key={lastCalled}
            initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            className="inline-flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-game-sun text-5xl font-black text-[#17201a] shadow-xl shadow-game-sun/25"
          >
            {lastCalled}
          </motion.div>
          <p className="mt-2 text-sm font-semibold text-game-muted">
            Called by <span className={lastCalledBy === userId ? 'text-white font-bold' : 'text-red-400 font-bold'}>{lastCalledByName}</span>
          </p>
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
                ? 'bg-white/20 text-white border border-white/50'
                : 'bg-white/[0.03] text-white/40 border border-white/[0.06]'
            }`}
          >
            {isMyTurn ? '🎯 Your Turn — Pick a number!' : "⏳ Opponent's Turn…"}
          </motion.div>
        </AnimatePresence>
      </div>

      {isMyTurn && !disabled && (
        <p className="text-center text-xs text-game-muted">
          Pick a number that completes YOUR lines — it marks both boards.
        </p>
      )}

      {/* MY BINGO progress only */}
      <div className="rounded-lg border border-white/12 bg-[#172c3b] p-4">
        <h3 className="mb-3 text-xs font-bold text-game-muted">
          Your BINGO Progress
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {'BINGO'.split('').map((letter, i) => (
              <span
                key={i}
                className={`flex h-10 w-10 items-center justify-center rounded-md text-sm font-black transition-all ${
                  i < myCompletedLines
                    ? 'bg-game-mint text-[#17201a] shadow-lg shadow-game-mint/20'
                    : 'border border-white/12 bg-black/25 text-white/30'
                }`}
              >
                {letter}
              </span>
            ))}
          </div>
          <span className="text-sm text-white/40 ml-auto font-mono">{myCompletedLines}/5 lines</span>
        </div>
      </div>

      {/* Called numbers history */}
      <div className="rounded-lg border border-white/12 bg-[#172c3b] p-4">
        <h3 className="mb-3 text-xs font-bold text-game-muted">
          Called Numbers ({chosenNumbers.length}/25)
        </h3>
        {chosenNumbers.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {chosenNumbers.map((num) => {
              const callerIsMe = calledBy[num] === userId;
              return (
                <span
                  key={num}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                    callerIsMe
                      ? 'border border-game-blue/50 bg-game-blue/20 text-[#b9d9ff]'
                      : 'border border-game-coral/40 bg-game-coral/15 text-[#ffad9e]'
                  }`}
                  title={`Called by ${callerIsMe ? 'you' : 'opponent'}`}
                >
                  {num}
                </span>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-white/40">No numbers called yet</p>
        )}
      </div>

    </div>
  );
}
