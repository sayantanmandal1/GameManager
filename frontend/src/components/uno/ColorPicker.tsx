'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { UnoColor, UnoSide } from '@/shared';
import { UNO_LIGHT_COLORS, UNO_DARK_COLORS } from '@/shared';
import { UNO_COLOR_HEX, COLOR_NAME } from './cardStyle';
import { unoStrings as S } from './strings';

interface ColorPickerProps {
  open: boolean;
  side: UnoSide;
  onPick: (color: UnoColor) => void;
  onCancel: () => void;
}

/** Modal shown when a wild needs a colour chosen (palette follows the side). */
export function ColorPicker({ open, side, onPick, onCancel }: ColorPickerProps) {
  const palette: readonly UnoColor[] = side === 'dark' ? UNO_DARK_COLORS : UNO_LIGHT_COLORS;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            className="relative rounded-3xl border border-white/10 bg-[#111] p-6 shadow-2xl"
          >
            <h3 className="mb-4 text-center text-lg font-bold text-white">{S.hud.pickColor}</h3>
            <div className="grid grid-cols-2 gap-3">
              {palette.map((color) => (
                <motion.button
                  key={color}
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onPick(color)}
                  aria-label={COLOR_NAME[color]}
                  className="h-20 w-24 rounded-2xl border-4 border-white/80 shadow-lg"
                  style={{
                    background: UNO_COLOR_HEX[color].bg,
                    boxShadow: `0 6px 20px ${UNO_COLOR_HEX[color].glow}`,
                  }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
