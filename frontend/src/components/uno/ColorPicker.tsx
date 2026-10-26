'use client';

import { motion } from 'framer-motion';
import { Modal } from '@/components/ui/Modal';
import type { UnoColor, UnoSide } from '@/shared';
import { UNO_LIGHT_COLORS, UNO_DARK_COLORS } from '@/shared';
import { UNO_COLOR_HEX, COLOR_NAME } from './cardStyle';
import { unoStrings as S } from './strings';

interface ColorPickerProps {
  open: boolean;
  side: UnoSide;
  onPick: (color: UnoColor) => void;
  onCancel: () => void;
  title?: string;
  canCancel?: boolean;
  onSurrender?: () => void;
}

/** Modal shown when a wild needs a colour chosen (palette follows the side). */
export function ColorPicker({
  open,
  side,
  onPick,
  onCancel,
  title = S.hud.pickColor,
  canCancel = true,
  onSurrender,
}: ColorPickerProps) {
  const palette: readonly UnoColor[] = side === 'dark' ? UNO_DARK_COLORS : UNO_LIGHT_COLORS;
  return (
    <Modal isOpen={open} onClose={onCancel} title={title} dismissible={canCancel}>
            <div className="mx-auto grid max-w-64 grid-cols-2 gap-3">
              {palette.map((color) => (
                <motion.button
                  key={color}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onPick(color)}
                  aria-label={COLOR_NAME[color]}
                  className="h-20 w-full rounded-2xl border-2 border-white/70 shadow-lg"
                  style={{
                    background: UNO_COLOR_HEX[color].bg,
                    boxShadow: `0 6px 20px ${UNO_COLOR_HEX[color].glow}`,
                  }}
                />
              ))}
            </div>
            {onSurrender && (
              <button
                type="button"
                onClick={onSurrender}
                className="mx-auto mt-5 block rounded-full border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/10"
              >
                Surrender match
              </button>
            )}
    </Modal>
  );
}
