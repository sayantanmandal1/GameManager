'use client';

import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { LudoPlayerState, LudoMoveAction, LudoMoveRecord } from '@/shared';
import { LudoColor, LUDO_START_POSITIONS, LUDO_SAFE_SQUARES, LUDO_BOARD_SIZE } from '@/shared';

// --- Board geometry (SVG internal units) ---
const CELL = 44;
const CELLS = 15;
const VP = CELL * CELLS;

const ALL_COLORS: LudoColor[] = [LudoColor.RED, LudoColor.GREEN, LudoColor.YELLOW, LudoColor.BLUE];

// Tokens keep their classic colors for identification on the dark board
const COLORS: Record<LudoColor, { bg: string; light: string; token: string }> = {
  [LudoColor.RED]:    { bg: '#FF4C4C', light: '#2a1515', token: '#cc3333' },
  [LudoColor.GREEN]:  { bg: '#4CAF50', light: '#152a15', token: '#338a33' },
  [LudoColor.YELLOW]: { bg: '#FFC107', light: '#2a2515', token: '#cc9900' },
  [LudoColor.BLUE]:   { bg: '#2196F3', light: '#151f2a', token: '#1a6fcc' },
};

// --- Track coordinates ---
const TRACK: [number, number][] = (() => {
  const c: [number, number][] = [];
  c.push([1,6],[2,6],[3,6],[4,6],[5,6]);
  c.push([6,5],[6,4],[6,3],[6,2],[6,1],[6,0]);
  c.push([7,0],[8,0]);
  c.push([8,1],[8,2],[8,3],[8,4],[8,5]);
  c.push([9,6],[10,6],[11,6],[12,6],[13,6],[14,6]);
  c.push([14,7],[14,8]);
  c.push([13,8],[12,8],[11,8],[10,8],[9,8]);
  c.push([8,9],[8,10],[8,11],[8,12],[8,13],[8,14]);
  c.push([7,14],[6,14]);
  c.push([6,13],[6,12],[6,11],[6,10],[6,9]);
  c.push([5,8],[4,8],[3,8],[2,8],[1,8],[0,8]);
  c.push([0,7],[0,6]);
  return c;
})();

const HOME_COLS: Record<LudoColor, [number, number][]> = {
  [LudoColor.RED]:    [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  [LudoColor.GREEN]:  [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
  [LudoColor.YELLOW]: [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],
  [LudoColor.BLUE]:   [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
};

const BASE_POS: Record<LudoColor, [number, number][]> = {
  [LudoColor.RED]:    [[1.5,1.5],[4.5,1.5],[1.5,4.5],[4.5,4.5]],
  [LudoColor.GREEN]:  [[10.5,1.5],[13.5,1.5],[10.5,4.5],[13.5,4.5]],
  [LudoColor.YELLOW]: [[10.5,10.5],[13.5,10.5],[10.5,13.5],[13.5,13.5]],
  [LudoColor.BLUE]:   [[1.5,10.5],[4.5,10.5],[1.5,13.5],[4.5,13.5]],
};

const BASE_RECTS: Record<LudoColor, { x: number; y: number; w: number; h: number }> = {
  [LudoColor.RED]:    { x: 0, y: 0, w: 6, h: 6 },
  [LudoColor.GREEN]:  { x: 9, y: 0, w: 6, h: 6 },
  [LudoColor.YELLOW]: { x: 9, y: 9, w: 6, h: 6 },
  [LudoColor.BLUE]:   { x: 0, y: 9, w: 6, h: 6 },
};

function getAbsPos(color: LudoColor, steps: number): number {
  if (steps <= 0 || steps > LUDO_BOARD_SIZE) return -1;
  return (LUDO_START_POSITIONS[color] + steps - 1) % LUDO_BOARD_SIZE;
}

function pxForStep(step: number, color: LudoColor, tid: number): [number, number] {
  if (step === 0) {
    const b = BASE_POS[color][tid];
    return [b[0] * CELL, b[1] * CELL];
  }
  if (step >= LUDO_BOARD_SIZE + 7) {
    const off = [[-0.3,-0.3],[0.3,-0.3],[-0.3,0.3],[0.3,0.3]];
    const o = off[tid];
    return [(7 + o[0]) * CELL, (7 + o[1]) * CELL];
  }
  if (step > LUDO_BOARD_SIZE) {
    const hi = step - LUDO_BOARD_SIZE - 1;
    const hc = HOME_COLS[color];
    if (hi >= 0 && hi < hc.length) {
      return [(hc[hi][0] + 0.5) * CELL, (hc[hi][1] + 0.5) * CELL];
    }
  }
  const ap = getAbsPos(color, step);
  if (ap >= 0 && ap < TRACK.length) {
    return [(TRACK[ap][0] + 0.5) * CELL, (TRACK[ap][1] + 0.5) * CELL];
  }
  return [7.5 * CELL, 7.5 * CELL];
}

// --- Hop-animating token ---
const HOP_MS = 100;

function HoppingToken({
  token, color, isMovable, isSelected, colorDef, pH, onClick,
}: {
  token: { id: number; stepsFromStart: number; state: string };
  color: LudoColor;
  isMovable: boolean;
  isSelected: boolean;
  colorDef: (typeof COLORS)[LudoColor];
  pH: number;
  onClick: () => void;
}) {
  const prev = useRef(token.stepsFromStart);
  const [pos, setPos] = useState<[number, number]>(() =>
    pxForStep(token.stepsFromStart, color, token.id),
  );
  const busy = useRef(false);

  useEffect(() => {
    const p = prev.current;
    const n = token.stepsFromStart;
    prev.current = n;

    if (p === n || busy.current) {
      setPos(pxForStep(n, color, token.id));
      return;
    }
    if (n === 0 && p > 0) { setPos(pxForStep(0, color, token.id)); return; }
    if (n > p || (p === 0 && n >= 1)) {
      const start = p === 0 ? 1 : p + 1;
      const wps: [number, number][] = [];
      for (let s = start; s <= n; s++) wps.push(pxForStep(s, color, token.id));
      hop(wps);
      return;
    }
    setPos(pxForStep(n, color, token.id));
  }, [token.stepsFromStart, color, token.id]);

  function hop(wps: [number, number][]) {
    if (!wps.length) return;
    busy.current = true;
    let i = 0;
    const tick = () => {
      setPos(wps[i]);
      i++;
      if (i < wps.length) setTimeout(tick, HOP_MS);
      else busy.current = false;
    };
    tick();
  }

  const c = colorDef;
  return (
    <motion.g
      onClick={onClick}
      style={{ cursor: isMovable ? 'pointer' : 'default' }}
      animate={{ x: pos[0], y: pos[1] }}
      transition={{ type: 'tween', duration: 0.1, ease: 'easeOut' }}
    >
      {isMovable && (
        <circle cx={0} cy={pH * 0.1} r={CELL * 0.48}
          fill="none" stroke="#fff" strokeWidth={2} opacity={0.6}
          className="ludo-pulse" />
      )}
      {isSelected && (
        <circle cx={0} cy={pH * 0.1} r={CELL * 0.5}
          fill="none" stroke="#fff" strokeWidth={2.5} opacity={0.9}
          filter="url(#glow)" />
      )}
      <g filter="url(#tokenShadow)">
        <ellipse cx={0} cy={pH * 0.42} rx={pH * 0.38} ry={pH * 0.14} fill={c.token} />
        <path d={`M ${-pH*0.28} ${pH*0.38} Q ${-pH*0.18} ${-pH*0.05} 0 ${-pH*0.15} Q ${pH*0.18} ${-pH*0.05} ${pH*0.28} ${pH*0.38} Z`} fill={c.bg} />
        <circle cx={0} cy={-pH * 0.28} r={pH * 0.2} fill={c.bg} />
        <circle cx={-pH * 0.06} cy={-pH * 0.34} r={pH * 0.07} fill="#fff" opacity={0.5} />
        <path d={`M ${-pH*0.08} ${pH*0.3} Q ${-pH*0.04} ${pH*0.05} 0 ${-pH*0.1} Q ${pH*0.04} ${pH*0.05} ${pH*0.08} ${pH*0.3} Z`} fill="#fff" opacity={0.18} />
      </g>
      <text x={0} y={pH * 0.2} textAnchor="middle" dominantBaseline="central"
        fontSize="11" fontWeight="bold" fill="#fff">
        {token.id + 1}
      </text>
    </motion.g>
  );
}

// --- Component ---

interface LudoBoardProps {
  players: LudoPlayerState[];
  myColor: LudoColor;
  currentTurn: string;
  availableMoves: LudoMoveAction[][] | null;
  onMoveSelect: (moves: LudoMoveAction[]) => void;
  lastMove?: LudoMoveRecord | null;
  disabled?: boolean;
  selectedTokenId?: number | null;
  onTokenSelect?: (tokenId: number | null) => void;
}

export function LudoBoard({
  players, myColor, currentTurn, availableMoves, onMoveSelect,
  lastMove, disabled, selectedTokenId, onTokenSelect,
}: LudoBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sz, setSz] = useState(VP);

  useEffect(() => {
    function measure() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const pw = containerRef.current?.parentElement?.clientWidth ?? vw;
      const maxH = vh * 0.82;
      const maxW = Math.min(pw, vw - 32);
      setSz(Math.floor(Math.min(maxW, maxH)));
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const movableTokenIds = useMemo(() => {
    if (!availableMoves || availableMoves.length === 0) return new Set<number>();
    const ids = new Set<number>();
    for (const combo of availableMoves) for (const a of combo) ids.add(a.tokenId);
    return ids;
  }, [availableMoves]);

  const handleTokenClick = useCallback(
    (playerId: string, tokenId: number) => {
      if (disabled) return;
      const mp = players.find((p) => p.color === myColor);
      if (!mp || playerId !== mp.id) return;
      if (!movableTokenIds.has(tokenId)) return;
      if (selectedTokenId === tokenId) { onTokenSelect?.(null); return; }
      onTokenSelect?.(tokenId);
      const tm = availableMoves?.filter((c) => c.some((a) => a.tokenId === tokenId));
      if (tm && tm.length === 1) { onMoveSelect(tm[0]); onTokenSelect?.(null); }
    },
    [disabled, players, myColor, movableTokenIds, selectedTokenId, onTokenSelect, availableMoves, onMoveSelect],
  );

  const myPlayer = players.find((p) => p.color === myColor);
  const activeColors = useMemo(() => new Set(players.map((p) => p.color)), [players]);
  const pH = CELL * 0.75;

  return (
    <div ref={containerRef} className="w-full flex justify-center">
      <svg viewBox={`0 0 ${VP} ${VP}`} width={sz} height={sz}
        className="select-none" style={{ maxWidth: '100%', maxHeight: '85vh' }}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="tokenShadow">
            <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#000" floodOpacity="0.6" />
          </filter>
        </defs>

        <rect width={VP} height={VP} fill="#0a0a0a" rx="14" />
        <rect width={VP} height={VP} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" rx="14" />

        {ALL_COLORS.map((col) => {
          const c = COLORS[col]; const br = BASE_RECTS[col]; const active = activeColors.has(col);
          return (
            <g key={col} opacity={active ? 1 : 0.25}>
              <rect x={br.x*CELL+2} y={br.y*CELL+2} width={br.w*CELL-4} height={br.h*CELL-4}
                fill={c.bg} opacity={0.08} rx="10" />
              <rect x={(br.x+0.8)*CELL} y={(br.y+0.8)*CELL} width={(br.w-1.6)*CELL} height={(br.h-1.6)*CELL}
                fill={c.bg} opacity={0.05} rx="8" stroke={c.bg} strokeWidth="1" strokeOpacity={0.15} />
              {BASE_POS[col].map(([bx,by],i) => (
                <circle key={i} cx={bx*CELL} cy={by*CELL} r={CELL*0.35}
                  fill={c.bg} opacity={0.1} stroke={c.bg} strokeWidth="1" strokeOpacity={0.15} />
              ))}
            </g>
          );
        })}

        {TRACK.map(([cx,cy],i) => {
          const isSafe = LUDO_SAFE_SQUARES.includes(i);
          const se = Object.entries(LUDO_START_POSITIONS).find(([,p]) => p === i);
          const tc = se ? COLORS[se[0] as LudoColor] : null;
          return (
            <g key={`t-${i}`}>
              <rect x={cx*CELL+1} y={cy*CELL+1} width={CELL-2} height={CELL-2}
                fill={tc ? tc.light : '#111'} stroke={tc ? tc.bg : '#1a1a1a'}
                strokeWidth={1} strokeOpacity={tc ? 0.3 : 0.6} rx="3" />
              {isSafe && (
                <text x={(cx+0.5)*CELL} y={(cy+0.5)*CELL} textAnchor="middle"
                  dominantBaseline="central" fontSize="14" fill={tc ? tc.bg : '#333'} opacity={0.5}>&#9733;</text>
              )}
            </g>
          );
        })}

        {ALL_COLORS.map((col) => {
          const c = COLORS[col]; const active = activeColors.has(col);
          return HOME_COLS[col].map(([cx,cy],i) => (
            <rect key={`h-${col}-${i}`} x={cx*CELL+1} y={cy*CELL+1}
              width={CELL-2} height={CELL-2} fill={c.bg}
              opacity={active ? 0.15 + i*0.04 : 0.06} rx="3" />
          ));
        })}

        <rect x={6.25*CELL} y={6.25*CELL} width={2.5*CELL} height={2.5*CELL}
          fill="#111" stroke="rgba(255,255,255,0.06)" strokeWidth={2} rx="6" />
        {ALL_COLORS.map((col,idx) => {
          const c = COLORS[col];
          const cx = 7.5*CELL; const cy = 7.5*CELL; const r = 1.1*CELL;
          const a1 = (idx*Math.PI*2)/4 - Math.PI/2;
          const a2 = ((idx+1)*Math.PI*2)/4 - Math.PI/2;
          return (
            <polygon key={`ctr-${col}`}
              points={`${cx},${cy} ${cx+r*Math.cos(a1)},${cy+r*Math.sin(a1)} ${cx+r*Math.cos(a2)},${cy+r*Math.sin(a2)}`}
              fill={c.bg} opacity={activeColors.has(col) ? 0.2 : 0.06} />
          );
        })}

        {players.map((p) => {
          const c = COLORS[p.color];
          return p.tokens.map((token) => {
            const isMovable = myPlayer?.id === p.id && movableTokenIds.has(token.id) && !disabled;
            const isSelected = selectedTokenId === token.id && myPlayer?.id === p.id;
            return (
              <HoppingToken key={`tok-${p.id}-${token.id}`}
                token={token} color={p.color} isMovable={isMovable}
                isSelected={isSelected} colorDef={c} pH={pH}
                onClick={() => handleTokenClick(p.id, token.id)} />
            );
          });
        })}
      </svg>
    </div>
  );
}
