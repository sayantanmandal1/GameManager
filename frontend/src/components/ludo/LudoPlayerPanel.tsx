'use client';

import { motion } from 'framer-motion';
import type { LudoPlayerState } from '@/shared';
import { LudoColor, LUDO_TOKENS_PER_PLAYER } from '@/shared';

const COLOR_MAP: Record<LudoColor, { bg: string; text: string; label: string; dot: string }> = {
  [LudoColor.RED]: { bg: 'bg-red-500/10', text: 'text-red-100', label: 'Red', dot: '#e34242' },
  [LudoColor.GREEN]: { bg: 'bg-green-500/10', text: 'text-green-100', label: 'Green', dot: '#34a853' },
  [LudoColor.YELLOW]: { bg: 'bg-yellow-400/10', text: 'text-yellow-100', label: 'Yellow', dot: '#f6c945' },
  [LudoColor.BLUE]: { bg: 'bg-blue-500/10', text: 'text-blue-100', label: 'Blue', dot: '#3587d4' },
};

const RANK_LABELS = ['🏆 1st', '🥈 2nd', '🥉 3rd', '4th'];

interface LudoPlayerPanelProps {
  players: LudoPlayerState[];
  currentTurn: string;
  rankings: string[];
  myPlayerId?: string;
}

export function LudoPlayerPanel({
  players,
  currentTurn,
  rankings,
  myPlayerId,
}: LudoPlayerPanelProps) {
  return (
    <div className="space-y-2">
      <h3 className="mb-3 text-xs font-bold text-game-muted">
        Players
      </h3>
      {players.map((player) => {
        const color = COLOR_MAP[player.color];
        const isCurrent = player.id === currentTurn;
        const isMe = player.id === myPlayerId;
        const rankIdx = rankings.indexOf(player.id);
        const isFinished = player.finishedCount === LUDO_TOKENS_PER_PLAYER;

        const tokensInBase = player.tokens.filter((token) => token.state === 'base').length;
        const tokensActive = player.tokens.filter((token) => token.state === 'active').length;
        const tokensHome = player.tokens.filter((token) => token.state === 'home').length;

        return (
          <motion.div
            key={player.id}
            className={`flex min-h-16 items-center gap-3 rounded-lg border px-3 py-2 transition-all ${
              isCurrent
                ? `${color.bg} border-white/35 ${color.text} shadow-lg shadow-black/20`
                : isFinished
                ? 'bg-white/[0.01] border-white/[0.03] opacity-70'
                : 'bg-white/[0.02] border-white/[0.05]'
            }`}
            animate={isCurrent ? { scale: [1, 1.02, 1] } : {}}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            {/* Color indicator */}
            <div
              className={`h-5 w-5 shrink-0 rounded-full ring-2 ring-white/30 ${
                isCurrent ? 'animate-pulse' : ''
              }`}
              style={{ backgroundColor: color.dot }}
            />

            {/* Player info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-white truncate">
                  {player.username}
                </span>
                {isMe && (
                  <span className="text-[10px] text-white/30">(you)</span>
                )}
                {player.isBot && (
                  <span className="text-[10px] px-1 py-0.5 bg-white/[0.06] rounded text-white/40">
                    🤖
                  </span>
                )}
              </div>

              {/* Token progress */}
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {tokensInBase > 0 && (
                  <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] text-game-muted">
                    Base {tokensInBase}
                  </span>
                )}
                {tokensActive > 0 && (
                  <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] text-game-muted">
                    Track {tokensActive}
                  </span>
                )}
                {tokensHome > 0 && (
                  <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] text-white">
                    Home {tokensHome}
                  </span>
                )}
              </div>
            </div>

            {/* Turn / Rank indicator */}
            <div className="text-right">
              {rankIdx >= 0 ? (
                <span className="text-xs font-bold">
                  {RANK_LABELS[rankIdx]}
                </span>
              ) : isCurrent ? (
                <span className="animate-pulse text-lg font-bold text-white">
                  ●
                </span>
              ) : null}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
