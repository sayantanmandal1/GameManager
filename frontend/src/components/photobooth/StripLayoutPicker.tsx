'use client';

import { motion } from 'framer-motion';
import type { PhotoboothLayout } from '@/shared';
import { LAYOUT_LIST } from './themes';

interface StripLayoutPickerProps {
  value: PhotoboothLayout;
  onChange: (layout: PhotoboothLayout) => void;
}

/** Miniature preview of a strip layout drawn from empty cells. */
function LayoutGlyph({ rows, cols }: { rows: number; cols: number }) {
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {Array.from({ length: rows * cols }).map((_, i) => (
        <div
          key={i}
          className="flex gap-0.5 rounded-[3px] border-2 border-zinc-800 p-0.5"
        >
          <div className="aspect-square flex-1 rounded-[2px] bg-zinc-200" />
          <div className="aspect-square flex-1 rounded-[2px] bg-zinc-200" />
        </div>
      ))}
    </div>
  );
}

export function StripLayoutPicker({ value, onChange }: StripLayoutPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {LAYOUT_LIST.map((layout) => {
        const selected = value === layout.id;
        return (
          <motion.button
            key={layout.id}
            type="button"
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onChange(layout.id)}
            className={`flex flex-col items-center gap-4 rounded-3xl border-2 bg-white/80 p-6 shadow-sm backdrop-blur transition ${
              selected
                ? 'border-rose-400 shadow-rose-200/60'
                : 'border-transparent hover:border-rose-200'
            }`}
          >
            <div className="flex h-40 items-center">
              <div style={{ width: layout.cols === 1 ? 70 : 132 }}>
                <LayoutGlyph rows={layout.rows} cols={layout.cols} />
              </div>
            </div>
            <span className="font-mono text-lg tracking-widest text-zinc-600">
              {layout.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
