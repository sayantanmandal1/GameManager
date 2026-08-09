'use client';

import { motion } from 'framer-motion';
import type { UnoPlayerPublic, UnoRoundResult } from '@/shared';
import { unoStrings as S } from './strings';

interface ScoreboardProps {
  result: UnoRoundResult;
  players: UnoPlayerPublic[];
  isMatch: boolean;
  onBackToLobby: () => void;
  onPlayAgain?: () => void;
}

export function Scoreboard({
  result,
  players,
  isMatch,
  onBackToLobby,
  onPlayAgain,
}: ScoreboardProps) {
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? 'Player';
  const rows = [...players].sort(
    (a, b) => (result.scores[b.id] ?? 0) - (result.scores[a.id] ?? 0),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <motion.div
        initial={{ scale: 0.9, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#121212] p-6 text-center shadow-2xl"
      >
        <div className="mb-1 text-5xl">{isMatch ? '🏆' : '🎉'}</div>
        <h2 className="text-xl font-black text-white">
          {isMatch ? S.over.matchTitle : S.over.roundTitle}
        </h2>
        <p className="mt-1 text-sm text-white/60">
          {isMatch
            ? result.reason === 'lastStanding'
              ? S.over.lastStanding(nameOf(result.roundWinnerId))
              : S.over.wonMatch(nameOf(result.roundWinnerId))
            : `${S.over.wonRound(nameOf(result.roundWinnerId))} · ${S.over.points(result.points)}`}
        </p>

        <div className="mt-5 space-y-1.5">
          {rows.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
                p.id === result.roundWinnerId
                  ? 'bg-yellow-400/15 text-yellow-200'
                  : 'bg-white/[0.04] text-white/80'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="w-4 text-white/40">{i + 1}</span>
                {p.name}
              </span>
              <span className="font-bold">{result.scores[p.id] ?? 0}</span>
            </div>
          ))}
        </div>

        {isMatch ? (
          <div className="mt-6 flex justify-center gap-3">
            {onPlayAgain && (
              <button
                onClick={onPlayAgain}
                className="rounded-full bg-white px-5 py-2 text-sm font-bold text-black hover:bg-white/90"
              >
                {S.over.playAgain}
              </button>
            )}
            <button
              onClick={onBackToLobby}
              className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-white hover:bg-white/5"
            >
              {S.over.backToLobby}
            </button>
          </div>
        ) : (
          <p className="mt-6 animate-pulse text-xs font-semibold uppercase tracking-widest text-white/40">
            {S.over.nextRound}
          </p>
        )}
      </motion.div>
    </div>
  );
}
