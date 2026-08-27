'use client';

import { motion } from 'framer-motion';
import type { UnoPlayerPublic, UnoSide } from '@/shared';
import { UnoCard } from './UnoCard';
import { TurnTimer } from './TurnTimer';
import { unoStrings as S } from './strings';

interface OpponentSeatProps {
  readonly player: UnoPlayerPublic;
  readonly side: UnoSide;
  readonly isCurrent: boolean;
  readonly turnEndsAt: number;
  readonly catchable: boolean;
  readonly unoCallGraceMs?: number;
  readonly onCatch: () => void;
  readonly expanded?: boolean;
}

const MAX_HIDDEN_FANNED = 7;

export function OpponentSeat({
  player,
  isCurrent,
  turnEndsAt,
  catchable,
  unoCallGraceMs = 0,
  onCatch,
  side,
  expanded = false,
}: OpponentSeatProps) {
  const showsInactiveFaces = player.visibleBackFaces.length > 0;
  const shown = showsInactiveFaces
    ? player.visibleBackFaces.length
    : Math.min(player.handCount, MAX_HIDDEN_FANNED);
  const backs = Array.from({ length: shown });
  let cardWidth = expanded ? 42 : 34;
  let exposedWidth = 17;
  if (showsInactiveFaces) {
    cardWidth = expanded ? 50 : 42;
    exposedWidth = expanded ? 24 : 19;
  }
  const overlap = cardWidth - exposedWidth;
  const rotationStep = Math.min(4, 20 / Math.max(shown - 1, 1));
  let cardSide: UnoSide = 'light';
  if (showsInactiveFaces) cardSide = side === 'light' ? 'dark' : 'light';
  let seatClass = 'rounded-lg border-white/10 bg-black/20';
  if (player.eliminated) {
    seatClass = 'rounded-lg border-white/5 bg-black/15 opacity-40 grayscale';
  } else if (isCurrent) {
    seatClass = 'rounded-lg border-game-sun/60 bg-game-sun/10 shadow-lg shadow-black/20';
  }

  return (
    <motion.div
      layout
      className={`${expanded ? 'w-full max-w-sm' : 'min-w-40 max-w-72'} border px-3 py-2 transition-colors ${seatClass}`}
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
      <div
        className="relative mt-1 w-full overflow-x-auto overflow-y-hidden [scrollbar-width:thin]"
        style={{ height: cardWidth * 1.5 + 12 }}
      >
        <div className="mx-auto flex w-max min-w-full items-start justify-center px-5 pt-1">
          {backs.map((_, i) => (
            <div
              key={i}
              style={{
                marginLeft: i === 0 ? 0 : -overlap,
                transform: `rotate(${(i - (shown - 1) / 2) * rotationStep}deg)`,
                transformOrigin: 'bottom center',
                zIndex: i,
              }}
            >
              <UnoCard
                face={player.visibleBackFaces[i] ?? null}
                faceDown={!showsInactiveFaces}
                width={cardWidth}
                side={cardSide}
              />
            </div>
          ))}
        </div>
        <span className="absolute right-1 top-1 rounded-full bg-black/75 px-1.5 text-[10px] font-bold text-white ring-1 ring-white/20">
          {player.handCount}
        </span>
      </div>

      {/* UNO badge / catch */}
      <div className="flex min-h-7 items-center justify-center">
        {player.handCount === 1 && player.calledUno && (
          <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-black text-black">
            UNO
          </span>
        )}
        {!player.calledUno && unoCallGraceMs > 0 && (
          <span className="rounded-full border border-yellow-300/30 bg-yellow-300/10 px-2 py-0.5 text-[10px] font-bold text-yellow-100">
            UNO call…
          </span>
        )}
        {catchable && (
          <motion.button
            initial={{ scale: 0.8 }}
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
            onClick={onCatch}
            className="min-h-9 rounded-full bg-red-500 px-4 py-1 text-xs font-black text-white shadow"
          >
            {S.hud.catch}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
