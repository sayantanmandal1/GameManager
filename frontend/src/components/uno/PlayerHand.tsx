'use client';

import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { UnoCard as UnoCardT, UnoSide } from '@/shared';
import { UnoCard } from './UnoCard';
import { faceOf } from './cardStyle';

interface PlayerHandProps {
  hand: UnoCardT[];
  side: UnoSide;
  legalCardIds: string[];
  jumpInIds: string[];
  isMyTurn: boolean;
  playableDrawnCardId: string | null;
  onSelect: (card: UnoCardT) => void;
  onJumpIn: (card: UnoCardT) => void;
}

const COLOR_ORDER: Record<string, number> = {
  red: 0,
  yellow: 1,
  green: 2,
  blue: 3,
  teal: 0,
  orange: 1,
  pink: 2,
  purple: 3,
};
const KIND_ORDER: Record<string, number> = {
  number: 0,
  skip: 1,
  skipAll: 1,
  reverse: 2,
  flip: 2,
  discardAll: 3,
  draw1: 3,
  draw2: 3,
  draw5: 3,
  draw6: 3,
};

export function PlayerHand({
  hand,
  side,
  legalCardIds,
  jumpInIds,
  isMyTurn,
  playableDrawnCardId,
  onSelect,
  onJumpIn,
}: PlayerHandProps) {
  const sorted = useMemo(() => {
    return [...hand].sort((a, b) => {
      const fa = faceOf(a, side);
      const fb = faceOf(b, side);
      const ca = fa.color ? COLOR_ORDER[fa.color] : 4;
      const cb = fb.color ? COLOR_ORDER[fb.color] : 4;
      if (ca !== cb) return ca - cb;
      if (fa.kind !== fb.kind) return (KIND_ORDER[fa.kind] ?? 9) - (KIND_ORDER[fb.kind] ?? 9);
      return (fa.value ?? 0) - (fb.value ?? 0);
    });
  }, [hand, side]);

  const legal = useMemo(() => new Set(legalCardIds), [legalCardIds]);
  const jumps = useMemo(() => new Set(jumpInIds), [jumpInIds]);
  const count = sorted.length;
  const overlap = count > 10 ? -34 : count > 7 ? -26 : -14;
  const width = count > 12 ? 62 : 72;

  return (
    <div className="flex items-end justify-center overflow-x-auto px-4 pb-1">
      <AnimatePresence initial={false}>
        {sorted.map((card, i) => {
          const isLegal = isMyTurn && legal.has(card.id);
          const isJump = !isMyTurn && jumps.has(card.id);
          const actionable = isLegal || isJump;
          const isDrawn = card.id === playableDrawnCardId;
          const rot = (i - (count - 1) / 2) * 2.2;
          const onClick = () => {
            if (isLegal) onSelect(card);
            else if (isJump) onJumpIn(card);
          };
          return (
            <motion.div
              key={card.id}
              layout
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: actionable ? -10 : 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              style={{
                marginLeft: i === 0 ? 0 : overlap,
                transform: `rotate(${rot}deg)`,
                transformOrigin: 'bottom center',
                zIndex: actionable ? 100 + i : i,
              }}
              className={`rounded-[14%] ${
                isDrawn ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent' : ''
              } ${isJump ? 'ring-2 ring-amber-400' : ''}`}
            >
              <UnoCard
                card={card}
                side={side}
                width={width}
                playable={actionable}
                disabled={!actionable}
                onClick={onClick}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
