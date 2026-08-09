'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { PhotoboothThemeId } from '@/shared';
import { SIMPLE_THEMES, PATTERN_THEMES, type ThemeStyle } from './themes';
import { photoboothStrings as S } from './strings';

interface ThemePickerProps {
  value: PhotoboothThemeId;
  onChange: (theme: PhotoboothThemeId) => void;
}

/** A small strip swatch that shows the theme's frame with a few placeholders. */
function ThemeSwatch({ theme, selected }: { theme: ThemeStyle; selected: boolean }) {
  return (
    <div
      className={`rounded-2xl p-1.5 shadow-md transition ${
        selected ? 'ring-4 ring-rose-400' : 'ring-1 ring-black/5'
      }`}
      style={{ background: theme.frame }}
    >
      <div className="flex flex-col gap-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-1">
            <div className="h-6 w-6 rounded-[2px] bg-white/45" />
            <div className="h-6 w-6 rounded-[2px] bg-white/30" />
          </div>
        ))}
      </div>
      <div
        className="mt-1 text-center font-mono text-[7px] tracking-wider"
        style={{ color: theme.ink }}
      >
        ♡
      </div>
    </div>
  );
}

export function ThemePicker({ value, onChange }: ThemePickerProps) {
  const [pack, setPack] = useState<'simple' | 'pattern'>(() => {
    const inPattern = PATTERN_THEMES.some((t) => t.id === value);
    return inPattern ? 'pattern' : 'simple';
  });
  const themes = pack === 'simple' ? SIMPLE_THEMES : PATTERN_THEMES;

  return (
    <div className="flex flex-col gap-4">
      {/* Pack tabs */}
      <div className="mx-auto flex rounded-full bg-white/70 p-1 shadow-sm backdrop-blur">
        {(['simple', 'pattern'] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPack(p)}
            className={`rounded-full px-5 py-1.5 text-sm font-semibold transition ${
              pack === p
                ? 'bg-gradient-to-r from-rose-400 to-pink-400 text-white shadow'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {p === 'simple' ? S.setup.packsSimple : S.setup.packsPattern}
          </button>
        ))}
      </div>

      {/* Theme carousel */}
      <div className="flex gap-3 overflow-x-auto px-1 pb-2">
        {themes.map((theme) => {
          const selected = value === theme.id;
          return (
            <motion.button
              key={theme.id}
              type="button"
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onChange(theme.id)}
              className="flex shrink-0 flex-col items-center gap-2"
            >
              <ThemeSwatch theme={theme} selected={selected} />
              <span
                className={`font-mono text-xs tracking-wide ${
                  selected ? 'text-rose-500' : 'text-zinc-500'
                }`}
              >
                {theme.name}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
