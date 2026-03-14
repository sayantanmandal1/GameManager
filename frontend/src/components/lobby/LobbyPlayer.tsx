'use client';

import { motion } from 'framer-motion';
import type { LobbyPlayer } from '@/shared';

interface LobbyPlayerProps {
  player: LobbyPlayer;
  isCurrentUser: boolean;
}

export function LobbyPlayerCard({ player, isCurrentUser }: LobbyPlayerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={`flex items-center gap-3 p-3 rounded-xl border
        ${isCurrentUser ? 'border-primary bg-primary/10' : 'border-game-border bg-game-card'}`}
    >
      <span className="text-2xl">{player.avatar}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white truncate">
            {player.username}
          </span>
          {isCurrentUser && (
            <span className="text-xs text-primary">(you)</span>
          )}
          {player.isHost && (
            <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full">
              Host
            </span>
          )}
        </div>
      </div>

      <div
        className={`w-3 h-3 rounded-full ${
          player.isReady || player.isHost
            ? 'bg-green-500 shadow-lg shadow-green-500/50'
            : 'bg-game-muted/30'
        }`}
      />
    </motion.div>
  );
}
