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

const MAX_HIDDEN_FANNED = 7;

export function OpponentSeat({
  player,
  isCurrent,
  turnEndsAt,
  catchable,
  onCatch,
  side,
}: OpponentSeatProps) {
  const shown = player.visibleBackFaces.length > 0
    ? player.visibleBackFaces.length
    : Math.min(player.handCount, MAX_HIDDEN_FANNED);
  const backs = Array.from({ length: shown });
  const rotationStep = Math.min(6, 30 / Math.max(shown - 1, 1));

  return (
    <motion.div
      layout
      className={`min-w-36 border px-3 py-2 transition-colors ${
        player.eliminated
          ? 'rounded-lg border-white/5 bg-black/15 opacity-40 grayscale'
          : isCurrent
            ? 'rounded-lg border-game-sun/60 bg-game-sun/10 shadow-lg shadow-black/20'
            : 'rounded-lg border-white/10 bg-black/20'
      }`}
    >
      {/* Name + status */}
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-black text-white">
          {player.name.slice(0, 1).toUpperCase()}
        </span>
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
      <div className="relative mt-1 h-12 max-w-64 overflow-x-auto overflow-y-hidden [scrollbar-width:thin]">
        <div className="flex min-w-max items-center justify-center px-2">
          {backs.map((_, i) => (
            <div
              key={i}
              style={{
                marginLeft: i === 0 ? 0 : -22,
                transform: `rotate(${(i - (shown - 1) / 2) * rotationStep}deg)`,
                transformOrigin: 'bottom center',
                zIndex: i,
              }}
            >
              <UnoCard
                face={player.visibleBackFaces[i] ?? null}
                faceDown={!player.visibleBackFaces[i]}
                width={30}
                side={side === 'light' ? 'dark' : 'light'}
              />
            </div>
          ))}
        </div>
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
