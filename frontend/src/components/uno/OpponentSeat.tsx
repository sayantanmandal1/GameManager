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
  /** Phone layout: small tile so several opponents fit in one row. */
  readonly compact?: boolean;
}

const MAX_HIDDEN_FANNED = 7;
const MAX_HIDDEN_FANNED_COMPACT = 5;

export function OpponentSeat({
  player,
  isCurrent,
  turnEndsAt,
  catchable,
  unoCallGraceMs = 0,
  onCatch,
  side,
  expanded = false,
  compact = false,
}: OpponentSeatProps) {
  const showsInactiveFaces = player.visibleBackFaces.length > 0;
  const shown = showsInactiveFaces
    ? player.visibleBackFaces.length
    : Math.min(player.handCount, compact ? MAX_HIDDEN_FANNED_COMPACT : MAX_HIDDEN_FANNED);
  const backs = Array.from({ length: shown });
  let cardWidth = expanded ? 42 : 34;
  let exposedWidth = 17;
  if (showsInactiveFaces) {
    cardWidth = expanded ? 50 : 42;
    exposedWidth = expanded ? 24 : 19;
  }
  if (compact) {
    cardWidth = showsInactiveFaces ? 34 : 24;
    exposedWidth = showsInactiveFaces ? 17 : 9;
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
      className={`${compact ? 'w-full min-w-0 px-1.5 py-1.5' : `${expanded ? 'w-full max-w-sm' : 'min-w-40 max-w-72'} px-3 py-2`} border transition-colors ${seatClass}`}
    >
      {/* Name + status */}
      <div className={`flex min-w-0 items-center ${compact ? 'gap-1.5' : 'gap-2'}`}>
        <span className={`flex shrink-0 items-center justify-center rounded-full bg-white/10 font-black text-white ${compact ? 'h-6 w-6 text-[11px]' : 'h-7 w-7 text-xs'}`}>
          {player.name.slice(0, 1).toUpperCase()}
        </span>
        {isCurrent && (
          <TurnTimer turnEndsAt={turnEndsAt} active size={compact ? 20 : 26} />
        )}
        <span
          className={`min-w-0 truncate font-semibold ${compact ? 'text-xs' : 'max-w-[9rem] text-sm'} ${
            player.isConnected ? 'text-white' : 'text-white/60'
          }`}
          title={player.name}
        >
          {player.name}
        </span>
        {!player.isConnected && (
          <span className="shrink-0 text-[11px] text-amber-300">{compact ? '⟳' : S.hud.reconnecting}</span>
        )}
        {player.eliminated && (
          <span className="shrink-0 text-[11px] font-semibold text-red-300">OUT</span>
        )}
      </div>

      {/* Fanned card backs */}
      <div
        className="relative mt-1 w-full overflow-x-auto overflow-y-hidden [scrollbar-width:thin]"
        style={{ height: cardWidth * 1.5 + 12 }}
      >
        <div className={`mx-auto flex w-max min-w-full items-start justify-center pt-1 ${compact ? 'px-3' : 'px-5'}`}>
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
        <span className="absolute right-0.5 top-0.5 z-20 rounded-full bg-black/85 px-1.5 text-[11px] font-bold text-white ring-1 ring-white/30" aria-label={`${player.handCount} cards`}>
          {player.handCount}
        </span>
      </div>

      {/* UNO badge / catch */}
      <div className={`flex items-center justify-center ${compact ? 'min-h-5' : 'min-h-7'}`}>
        {player.handCount === 1 && player.calledUno && (
          <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-[11px] font-black text-black">
            UNO
          </span>
        )}
        {!player.calledUno && unoCallGraceMs > 0 && (
          <span className="rounded-full border border-yellow-300/30 bg-yellow-300/10 px-2 py-0.5 text-[11px] font-bold text-yellow-100">
            UNO call…
          </span>
        )}
        {catchable && (
          <motion.button
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            onClick={onCatch}
            className="min-h-11 rounded-full bg-red-500 px-4 py-1 text-xs font-semibold text-white shadow"
          >
            {S.hud.catch}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
