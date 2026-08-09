'use client';

import { useEffect, useState } from 'react';

interface TurnTimerProps {
  turnEndsAt: number;
  durationMs?: number;
  active: boolean;
  size?: number;
}

/** Circular countdown for the active turn (turns red in the final seconds). */
export function TurnTimer({
  turnEndsAt,
  durationMs = 45000,
  active,
  size = 40,
}: TurnTimerProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active]);

  const remaining = Math.max(0, turnEndsAt - now);
  const frac = Math.max(0, Math.min(1, remaining / durationMs));
  const secs = Math.ceil(remaining / 1000);
  const danger = remaining < 10000;
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={4}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={danger ? '#e63946' : '#ffffff'}
          strokeWidth={4}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.25s linear' }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-xs font-bold"
        style={{ color: danger ? '#e63946' : '#fff' }}
      >
        {secs}
      </span>
    </div>
  );
}
