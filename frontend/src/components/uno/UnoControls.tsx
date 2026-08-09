'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { UnoPlayerView } from '@/shared';
import { unoStrings as S } from './strings';

interface UnoControlsProps {
  view: UnoPlayerView;
  onDraw: () => void;
  onPass: () => void;
  onTake: () => void;
  onChallenge: () => void;
  onCallUno: () => void;
}

const base =
  'rounded-full px-5 py-2 text-sm font-bold shadow-md transition disabled:opacity-40';

export function UnoControls({
  view,
  onDraw,
  onPass,
  onTake,
  onChallenge,
  onCallUno,
}: UnoControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <AnimatePresence>
        {view.canChallenge && (
          <motion.button
            key="challenge"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            onClick={onChallenge}
            title={S.hud.challengeHint}
            className={`${base} bg-amber-500 text-black hover:bg-amber-400`}
          >
            ⚖ {S.hud.challenge}
          </motion.button>
        )}

        {view.canTake && (
          <motion.button
            key="take"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            onClick={onTake}
            className={`${base} bg-red-500 text-white hover:bg-red-400`}
          >
            {S.hud.takeCards(view.pendingDraw?.count ?? 0)}
          </motion.button>
        )}

        {view.canDraw && (
          <motion.button
            key="draw"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            onClick={onDraw}
            className={`${base} bg-white/10 text-white hover:bg-white/20`}
          >
            🂠 {S.hud.draw}
          </motion.button>
        )}

        {view.canPass && (
          <motion.button
            key="pass"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            onClick={onPass}
            className={`${base} bg-white/10 text-white hover:bg-white/20`}
          >
            {S.hud.pass} ⏭
          </motion.button>
        )}

        {view.canCallUno && (
          <motion.button
            key="uno"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [1, 1.1, 1], opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ scale: { repeat: Infinity, duration: 1 } }}
            onClick={onCallUno}
            className={`${base} bg-yellow-400 text-black hover:bg-yellow-300`}
          >
            {S.hud.unoButton}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
