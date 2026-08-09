'use client';

import { motion } from 'framer-motion';
import type { UnoPlayerPublic, UnoSide } from '@/shared';
import { UnoCard } from './UnoCard';
import { TurnTimer } from './TurnTimer';
import { unoStrings as S } from './strings';

interface OpponentSeatProps {
  player: UnoPlayerPublic;
  side: UnoSide;
  isCurrent: boolean;
  turnEndsAt: number;
  catchable: boolean;
  onCatch: () => void;
  orientation?: 'top' | 'left' | 'right';
}

const MAX_FANNED = 7;

export function OpponentSeat({
  player,
  isCurrent,
  turnEndsAt,
  catchable,
  onCatch,
  side,
}: OpponentSeatProps) {
  const shown = Math.min(player.handCount, MAX_FANNED);
  const backs = Array.from({ length: shown });

  return (
    <motion.div
      layout
      className={`flex flex-col items-center gap-1 rounded-2xl px-3 py-2 transition-colors ${
        player.eliminated
          ? 'opacity-40 grayscale'
          : isCurrent
            ? 'bg-white/[0.08] ring-1 ring-white/30'
            : 'bg-white/[0.02]'
      }`}
    >
      {/* Name + status */}
      <div className="flex items-center gap-2">
        {isCurrent && (
          <TurnTimer turnEndsAt={turnEndsAt} active size={26} />
        )}
        <span
          className={`max-w-[9rem] truncate text-sm font-semibold ${
            player.isConnected ? 'text-white' : 'text-white/40'
          }`}
        >
          {player.name}
        </span>
        {!player.isConnected && (
          <span className="text-[10px] text-amber-400">{S.hud.reconnecting}</span>
        )}
        {player.eliminated && (
          <span className="text-[10px] font-semibold text-red-400">OUT</span>
        )}
      </div>

      {/* Fanned card backs */}
      <div className="relative flex h-12 items-center justify-center">
        {backs.map((_, i) => (
          <div
            key={i}
            style={{
              marginLeft: i === 0 ? 0 : -22,
              transform: `rotate(${(i - (shown - 1) / 2) * 6}deg)`,
              transformOrigin: 'bottom center',
              zIndex: i,
            }}
          >
            <UnoCard faceDown width={30} side={side} />
          </div>
        ))}
        <span className="absolute -right-2 -top-1 rounded-full bg-black/70 px-1.5 text-[10px] font-bold text-white ring-1 ring-white/20">
          {player.handCount}
        </span>
      </div>

      {/* UNO badge / catch */}
      <div className="h-6">
        {player.handCount === 1 && player.calledUno && (
          <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-black text-black">
            UNO
          </span>
        )}
        {catchable && (
          <motion.button
            initial={{ scale: 0.8 }}
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
            onClick={onCatch}
            className="rounded-full bg-red-500 px-3 py-0.5 text-[11px] font-black text-white shadow"
          >
            {S.hud.catch}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
