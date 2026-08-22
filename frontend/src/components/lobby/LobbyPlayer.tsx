'use client';

import { motion } from 'framer-motion';
import type { LobbyPlayer } from '@/shared';

interface LobbyPlayerProps {
  readonly player: LobbyPlayer;
  readonly isCurrentUser: boolean;
  readonly canRemove?: boolean;
  readonly onRemove?: () => void;
}

export function LobbyPlayerCard({
  player,
  isCurrentUser,
  canRemove = false,
  onRemove,
}: LobbyPlayerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={`flex min-h-16 items-center gap-3 rounded-lg border p-3
        ${isCurrentUser ? 'border-game-mint/50 bg-game-mint/10' : 'border-white/10 bg-black/15'}`}
    >
      <span className="text-2xl">{player.avatar}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white truncate">
            {player.username}
          </span>
          {isCurrentUser && (
            <span className="text-xs text-game-mint">(you)</span>
          )}
          {player.isHost && (
            <span className="rounded-full bg-game-sun/15 px-2 py-0.5 text-xs text-game-sun">
              Host
            </span>
          )}
          {player.team !== null && player.team !== undefined && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${player.team === 0 ? 'bg-[#e5c66d]/15 text-[#f1d77f]' : 'bg-[#74b7df]/15 text-[#8bcaf0]'}`}>
              Team {player.team + 1}
            </span>
          )}
        </div>
      </div>

      <div
        className={`w-3 h-3 rounded-full ${
          player.isReady || player.isHost
            ? 'bg-game-mint shadow-lg shadow-game-mint/30'
            : 'bg-game-muted/30'
        }`}
      />

      {canRemove && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="min-h-9 rounded-lg border border-red-400/25 px-2.5 text-xs font-bold text-red-200 transition hover:bg-red-400/10"
          aria-label={`Remove ${player.username}`}
        >
          Remove
        </button>
      )}
    </motion.div>
  );
}
