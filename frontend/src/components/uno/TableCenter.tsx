'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { UnoPlayerView } from '@/shared';
import { UnoCard } from './UnoCard';
import { UNO_COLOR_HEX, COLOR_NAME } from './cardStyle';
import { unoStrings as S } from './strings';

interface TableCenterProps {
  view: UnoPlayerView;
  onDrawPile: () => void;
}

export function TableCenter({ view, onDrawPile }: TableCenterProps) {
  const color = UNO_COLOR_HEX[view.activeColor];
  const canDraw = view.canDraw;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Round + direction + stacking */}
      <div className="flex items-center gap-3 text-xs font-semibold text-white/50">
        <span>{S.hud.round(view.roundNumber)}</span>
        <motion.span
          key={view.direction}
          initial={{ rotate: -40, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          className="text-lg text-white/70"
          title={view.direction === 1 ? 'Clockwise' : 'Counter-clockwise'}
        >
          {view.direction === 1 ? '↻' : '↺'}
        </motion.span>
        {view.stacking && (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide">
            {S.hud.stackingBadge}
          </span>
        )}
        {view.mode === 'flip' && (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide">
            {view.side === 'dark' ? '\uD83C\uDF19 Dark' : '\u2600 Light'}
          </span>
        )}
        {view.mercyLimit && (
          <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-red-300">
            No Mercy
          </span>
        )}
      </div>

      <div className="flex items-center gap-8">
        {/* Draw pile */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={onDrawPile}
            disabled={!canDraw}
            className={`relative transition ${canDraw ? 'cursor-pointer' : 'cursor-default'}`}
            style={{ filter: canDraw ? 'drop-shadow(0 0 12px rgba(255,255,255,0.5))' : undefined }}
            aria-label={S.hud.drawPile}
          >
            <div className="absolute left-1 top-1 opacity-60">
              <UnoCard faceDown width={72} side={view.side} />
            </div>
            <div className="absolute left-0.5 top-0.5 opacity-80">
              <UnoCard faceDown width={72} side={view.side} />
            </div>
            <UnoCard faceDown width={72} side={view.side} />
            <span className="absolute -bottom-1 -right-1 rounded-full bg-black/80 px-1.5 text-[11px] font-bold text-white ring-1 ring-white/20">
              {view.drawPileCount}
            </span>
          </button>
          {canDraw && (
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 1.4 }}
              className="text-[11px] font-semibold text-white/70"
            >
              {S.hud.draw}
            </motion.span>
          )}
        </div>

        {/* Discard pile */}
        <div className="relative">
          <div
            className="absolute -inset-3 rounded-3xl blur-xl"
            style={{ background: color.glow, opacity: 0.5 }}
          />
          <AnimatePresence mode="popLayout">
            {view.topCard && (
              <motion.div
                key={view.topCard.id}
                initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="relative"
              >
                <UnoCard card={view.topCard} width={82} side={view.side} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pending draw badge */}
          <AnimatePresence>
            {view.pendingDraw && (
              <motion.div
                initial={{ scale: 0, y: -10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0 }}
                className="absolute -right-4 -top-4 rounded-full bg-red-500 px-2.5 py-1 text-sm font-black text-white shadow-lg ring-2 ring-white"
              >
                +{view.pendingDraw.count}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Active colour chip */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-wider text-white/40">Colour</span>
        <span
          className="h-5 w-5 rounded-full ring-2 ring-white/60"
          style={{ background: color.bg }}
          title={COLOR_NAME[view.activeColor]}
        />
      </div>
    </div>
  );
}
