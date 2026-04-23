'use client';

import { useEffect, useRef, useState } from 'react';
import { chessStrings } from './strings';

export interface ChessClockProps {
  label: 'white' | 'black';
  /** Authoritative remaining ms at `lastTickAt`. */
  remainingMs: number;
  /** Epoch ms the server settled this snapshot. */
  lastTickAt: number;
  /** True if this side is on move; the clock interpolates down. */
  active: boolean;
  /** Untimed mode → show ∞, never tick. */
  untimed?: boolean;
}

function formatMs(ms: number): string {
  const safe = Math.max(0, ms);
  const totalSeconds = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${String(mins).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Displays a single side's clock. Server emits authoritative snapshots
 * (`chess:clock_tick` and on each `chess:move_applied`). When the side is
 * active, we interpolate locally via `requestAnimationFrame`, clamped at 0.
 * SECURITY_NOTE: no timing is ever sent to the server — display-only.
 */
export function ChessClock({
  label,
  remainingMs,
  lastTickAt,
  active,
  untimed = false,
}: ChessClockProps) {
  const [display, setDisplay] = useState<number>(remainingMs);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setDisplay(Math.max(0, remainingMs));
  }, [remainingMs, lastTickAt]);

  useEffect(() => {
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null;
    const caf = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : null;
    if (untimed || !active || !raf) {
      if (rafRef.current !== null && caf) {
        caf(rafRef.current);
      }
      rafRef.current = null;
      setDisplay(Math.max(0, remainingMs));
      return;
    }
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const elapsed = Date.now() - lastTickAt;
      const next = Math.max(0, remainingMs - elapsed);
      setDisplay(next);
      if (next > 0 && raf) {
        rafRef.current = raf(tick);
      }
    };
    rafRef.current = raf(tick);
    return () => {
      cancelled = true;
      if (rafRef.current !== null && caf) caf(rafRef.current);
      rafRef.current = null;
    };
  }, [active, lastTickAt, remainingMs, untimed]);

  const flagged = !untimed && display <= 0;
  const srLabel =
    label === 'white' ? chessStrings.clock.white : chessStrings.clock.black;

  return (
    <div
      data-testid={`chess-clock-${label}`}
      className={`font-mono text-2xl px-4 py-2 rounded-lg border ${
        active ? 'bg-white/10 border-white/30' : 'bg-white/[0.03] border-white/[0.06]'
      } ${flagged ? 'text-red-400' : 'text-white'}`}
      aria-label={srLabel}
      role="timer"
    >
      <span className="sr-only">{srLabel}: </span>
      {untimed
        ? chessStrings.clock.untimed
        : flagged
        ? chessStrings.clock.flagged
        : formatMs(display)}
    </div>
  );
}
