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
          <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Last Called</p>
          <motion.div
            key={lastCalled}
            initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-yellow-500/20 border-2 border-yellow-400 text-yellow-300 text-3xl font-black"
          >
            {lastCalled}
          </motion.div>
          <p className="text-xs text-white/40 mt-1">
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

      {/* Strategy hint */}
      {isMyTurn && !disabled && (
        <p className="text-xs text-white/40 text-center italic">
          Pick a number that completes YOUR lines — but remember, it marks on both boards!
        </p>
      )}

      {/* MY BINGO progress only */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
        <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">
          Your BINGO Progress
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {'BINGO'.split('').map((letter, i) => (
              <span
                key={i}
                className={`w-8 h-8 rounded flex items-center justify-center text-sm font-black transition-all ${
                  i < myCompletedLines
                    ? 'bg-white text-black shadow-lg shadow-white/30'
                    : 'bg-black text-white/30 border border-white/[0.06]'
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
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
        <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">
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
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
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
