'use client';

import { motion } from 'framer-motion';
import type { LudoPlayerState } from '@/shared';
import { LudoColor, LUDO_TOKENS_PER_PLAYER } from '@/shared';

const COLOR_MAP: Record<LudoColor, { bg: string; text: string; label: string }> = {
  [LudoColor.RED]: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Red' },
  [LudoColor.GREEN]: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Green' },
  [LudoColor.YELLOW]: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Yellow' },
  [LudoColor.BLUE]: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Blue' },
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
      <h3 className="text-xs font-semibold text-game-muted uppercase tracking-wider mb-3">
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
            className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-all ${
              isCurrent
                ? `${color.bg} border-current ${color.text}`
                : isFinished
                ? 'bg-game-card/50 border-game-border/50 opacity-70'
                : 'bg-game-card border-game-border'
            }`}
            animate={isCurrent ? { scale: [1, 1.02, 1] } : {}}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            {/* Color indicator */}
            <div
              className={`w-3 h-3 rounded-full ${
                isCurrent ? 'animate-pulse' : ''
              }`}
              style={{
                backgroundColor:
                  player.color === LudoColor.RED
                    ? '#FF4C4C'
                    : player.color === LudoColor.GREEN
                    ? '#4CAF50'
                    : player.color === LudoColor.YELLOW
                    ? '#FFC107'
                    : '#2196F3',
              }}
            />

            {/* Player info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-white truncate">
                  {player.username}
                </span>
                {isMe && (
                  <span className="text-[10px] text-game-muted">(you)</span>
                )}
                {player.isBot && (
                  <span className="text-[10px] px-1 py-0.5 bg-game-border rounded text-game-muted">
                    🤖
                  </span>
                )}
              </div>

              {/* Token progress */}
              <div className="flex items-center gap-2 mt-0.5">
                {tokensInBase > 0 && (
                  <span className="text-[10px] text-game-muted">
                    🏠{tokensInBase}
                  </span>
                )}
                {tokensActive > 0 && (
                  <span className="text-[10px] text-game-muted">
                    🏃{tokensActive}
                  </span>
                )}
                {tokensHome > 0 && (
                  <span className="text-[10px] text-green-400">
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
                <span className={`text-xs font-bold ${color.text}`}>
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
