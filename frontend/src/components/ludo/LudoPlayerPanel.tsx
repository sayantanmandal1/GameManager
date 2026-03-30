'use client';

import { motion } from 'framer-motion';
import type { LudoPlayerState } from '@/shared';
import { LudoColor, LUDO_TOKENS_PER_PLAYER } from '@/shared';

const COLOR_MAP: Record<LudoColor, { bg: string; text: string; label: string; dot: string }> = {
  [LudoColor.RED]: { bg: 'bg-white/[0.06]', text: 'text-white/80', label: 'Red', dot: '#FF4C4C' },
  [LudoColor.GREEN]: { bg: 'bg-white/[0.06]', text: 'text-white/80', label: 'Green', dot: '#4CAF50' },
  [LudoColor.YELLOW]: { bg: 'bg-white/[0.06]', text: 'text-white/80', label: 'Yellow', dot: '#FFC107' },
  [LudoColor.BLUE]: { bg: 'bg-white/[0.06]', text: 'text-white/80', label: 'Blue', dot: '#2196F3' },
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
      <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
        Players
      </h3>
      {players.map((player) => {
        const color = COLOR_MAP[player.color];
        const isCurrent = player.id === currentTurn;
        const isMe = player.id === myPlayerId;
        const rankIdx = rankings.indexOf(player.id);
        const isFinished = player.finishedCount === LUDO_TOKENS_PER_PLAYER;

        const tokensInBase = player.tokens.filter((t) => t.stepsFromStart === 0).length;
        const tokensActive = player.tokens.filter(
          (t) => t.stepsFromStart > 0 && t.stepsFromStart < 59,
        ).length;
        const tokensHome = player.finishedCount;

        return (
          <motion.div
            key={player.id}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-all ${
              isCurrent
                ? `${color.bg} border-white/20 ${color.text} backdrop-blur-md`
                : isFinished
                ? 'bg-white/[0.01] border-white/[0.03] opacity-70'
                : 'bg-white/[0.02] border-white/[0.05]'
            }`}
            animate={isCurrent ? { scale: [1, 1.02, 1] } : {}}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            {/* Color indicator */}
            <div
              className={`w-3 h-3 rounded-full ${
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
              <div className="flex items-center gap-2 mt-0.5">
                {tokensInBase > 0 && (
                  <span className="text-[10px] text-white/30">
                    🏠{tokensInBase}
                  </span>
                )}
                {tokensActive > 0 && (
                  <span className="text-[10px] text-white/30">
                    🏃{tokensActive}
                  </span>
                )}
                {tokensHome > 0 && (
                  <span className="text-[10px] text-white/60">
                    ✅{tokensHome}
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
                <span className="text-xs font-bold text-white">
                  ▶
                </span>
              ) : null}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
