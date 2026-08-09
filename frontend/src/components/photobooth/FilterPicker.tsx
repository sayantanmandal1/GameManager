'use client';

import { motion } from 'framer-motion';
import type { PhotoboothFilter } from '@/shared';
import { FILTER_LIST } from './themes';

interface FilterPickerProps {
  value: PhotoboothFilter;
  onChange: (filter: PhotoboothFilter) => void;
  /** A sample half-photo to preview each filter on. */
  sample: string | null;
}

export function FilterPicker({ value, onChange, sample }: FilterPickerProps) {
  return (
    <div className="flex gap-3 overflow-x-auto px-1 pb-2">
      {FILTER_LIST.map((f) => {
        const selected = value === f.id;
        return (
          <motion.button
            key={f.id}
            type="button"
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onChange(f.id)}
            className="flex shrink-0 flex-col items-center gap-1.5"
          >
            <div
              className={`h-20 w-20 overflow-hidden rounded-2xl shadow-md transition ${
                selected ? 'ring-4 ring-rose-400' : 'ring-1 ring-black/5'
              }`}
            >
              {sample ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={sample}
                  alt={f.name}
                  className="h-full w-full object-cover"
                  style={{ filter: f.css }}
                />
              ) : (
                <div
                  className="h-full w-full"
                  style={{
                    filter: f.css,
                    background:
                      'linear-gradient(135deg, #ffb6cd, #a9d8fb 60%, #ffe89a)',
                  }}
                />
              )}
            </div>
            <span
              className={`text-xs font-semibold ${
                selected ? 'text-rose-500' : 'text-zinc-500'
              }`}
            >
              {f.name}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
