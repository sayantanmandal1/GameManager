'use client';

import { forwardRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import type {
  PhotoboothSlot,
  PhotoboothLayout,
  PhotoboothThemeId,
  PhotoboothFilter,
} from '@/shared';
import { THEME_STYLES, FILTER_STYLES, LAYOUT_META } from './themes';

interface PhotoStripProps {
  slots: PhotoboothSlot[];
  layout: PhotoboothLayout;
  theme: PhotoboothThemeId;
  filter: PhotoboothFilter;
  hostName?: string;
  guestName?: string;
  /** Show name badges on each half. */
  showLabels?: boolean;
  /** Fill empty halves with soft placeholders (for the setup preview). */
  placeholder?: boolean;
  /** Gently pulse the row currently being captured. */
  highlightRound?: number | null;
  /** Animate the most recently completed row's reveal. */
  revealRound?: number | null;
  maxWidth?: number;
  className?: string;
}

function formatToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

/**
 * Renders the themed photo strip. Purely presentational — used for the setup
 * preview, the live "strip so far", and the final keepsake. The download image
 * is composed separately on a canvas (see stripDownload.ts) for fidelity.
 */
export const PhotoStrip = forwardRef<HTMLDivElement, PhotoStripProps>(
  function PhotoStrip(
    {
      slots,
      layout,
      theme,
      filter,
      hostName,
      guestName,
      showLabels = false,
      placeholder = false,
      highlightRound = null,
      revealRound = null,
      maxWidth = 300,
      className = '',
    },
    ref,
  ) {
    const t = THEME_STYLES[theme];
    const meta = LAYOUT_META[layout];
    const filterCss = FILTER_STYLES[filter].css;
    const today = useMemo(() => formatToday(), []);
    const watermark =
      hostName && guestName ? `${hostName} & ${guestName}` : 'together ♡';

    const half = (
      src: string | null,
      side: 'left' | 'right',
      rowIdx: number,
    ) => {
      const label = side === 'left' ? hostName : guestName;
      const badgeColor =
        side === 'left' ? 'bg-rose-400/90' : 'bg-sky-400/90';
      return (
        <div className="relative flex-1 aspect-square overflow-hidden rounded-[3px] bg-black/5">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={`${label ?? side} photo ${rowIdx + 1}`}
              className="h-full w-full object-cover"
              style={{ filter: filterCss }}
              draggable={false}
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{
                background:
                  side === 'left'
                    ? 'linear-gradient(135deg, rgba(255,182,205,0.55), rgba(255,255,255,0.25))'
                    : 'linear-gradient(135deg, rgba(169,216,251,0.55), rgba(255,255,255,0.25))',
              }}
            >
              <span className="text-white/70 text-lg">
                {placeholder ? '♡' : ''}
              </span>
            </div>
          )}
          {showLabels && label && src && (
            <span
              className={`absolute bottom-1 left-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow ${badgeColor}`}
            >
              {label}
            </span>
          )}
        </div>
      );
    };

    return (
      <div ref={ref} className={className} style={{ width: '100%', maxWidth }}>
        <div
          className="rounded-2xl p-3 shadow-2xl"
          style={{ background: t.frame }}
        >
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${meta.cols}, minmax(0, 1fr))` }}
          >
            {slots.map((slot, i) => {
              const isHighlight = highlightRound === i;
              const isReveal = revealRound === i;
              return (
                <motion.div
                  key={i}
                  initial={isReveal ? { scale: 0.9, opacity: 0 } : false}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  className={`flex gap-1 rounded-[4px] p-0.5 ${
                    isHighlight
                      ? 'ring-2 ring-white/80 ring-offset-1 ring-offset-transparent'
                      : ''
                  }`}
                  style={
                    isHighlight
                      ? { animation: 'pb-pulse 1.6s ease-in-out infinite' }
                      : undefined
                  }
                >
                  {half(slot.left, 'left', i)}
                  {half(slot.right, 'right', i)}
                </motion.div>
              );
            })}
          </div>

          {/* Date stamp + watermark */}
          <div
            className="mt-3 text-center font-mono"
            style={{ color: t.ink }}
          >
            <div className="text-sm font-semibold tracking-widest">{today}</div>
            <div className="text-[11px] tracking-wide opacity-80">
              {watermark}
            </div>
          </div>
        </div>
      </div>
    );
  },
);
