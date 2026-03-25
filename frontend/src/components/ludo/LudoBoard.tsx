'use client';

import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { LudoPlayerState, LudoMoveAction, LudoMoveRecord } from '@/shared';
import { LudoColor, LUDO_START_POSITIONS, LUDO_SAFE_SQUARES, LUDO_BOARD_SIZE } from '@/shared';

// ─── Board Geometry ───
const CELL_SIZE = 44;
const BOARD_CELLS = 15;
const BOARD_PX = CELL_SIZE * BOARD_CELLS;

// All 4 colors always shown
const ALL_COLORS: LudoColor[] = [LudoColor.RED, LudoColor.GREEN, LudoColor.YELLOW, LudoColor.BLUE];

const COLORS: Record<LudoColor, { bg: string; fill: string; light: string; token: string; glow: string }> = {
  [LudoColor.RED]: { bg: '#FF4C4C', fill: '#FF4C4C', light: '#FFD6D6', token: '#CC0000', glow: 'rgba(255,76,76,0.5)' },
  [LudoColor.GREEN]: { bg: '#4CAF50', fill: '#4CAF50', light: '#D6FFD6', token: '#2E7D32', glow: 'rgba(76,175,80,0.5)' },
  [LudoColor.YELLOW]: { bg: '#FFC107', fill: '#FFC107', light: '#FFF8D6', token: '#F57F17', glow: 'rgba(255,193,7,0.5)' },
  [LudoColor.BLUE]: { bg: '#2196F3', fill: '#2196F3', light: '#D6EAFF', token: '#1565C0', glow: 'rgba(33,150,243,0.5)' },
};

const TRACK_COORDS: [number, number][] = buildSystematicTrack();

function buildSystematicTrack(): [number, number][] {
  const c: [number, number][] = [];
  c.push([1,6]);c.push([2,6]);c.push([3,6]);c.push([4,6]);c.push([5,6]);
  c.push([6,5]);c.push([6,4]);c.push([6,3]);c.push([6,2]);c.push([6,1]);c.push([6,0]);
  c.push([7,0]);c.push([8,0]);
  c.push([8,1]);c.push([8,2]);c.push([8,3]);c.push([8,4]);c.push([8,5]);
  c.push([9,6]);c.push([10,6]);c.push([11,6]);c.push([12,6]);c.push([13,6]);c.push([14,6]);
  c.push([14,7]);c.push([14,8]);
  c.push([13,8]);c.push([12,8]);c.push([11,8]);c.push([10,8]);c.push([9,8]);
  c.push([8,9]);c.push([8,10]);c.push([8,11]);c.push([8,12]);c.push([8,13]);c.push([8,14]);
  c.push([7,14]);c.push([6,14]);
  c.push([6,13]);c.push([6,12]);c.push([6,11]);c.push([6,10]);c.push([6,9]);
  c.push([5,8]);c.push([4,8]);c.push([3,8]);c.push([2,8]);c.push([1,8]);c.push([0,8]);
  c.push([0,7]);c.push([0,6]);
  return c;
}

const HOME_COLUMNS: Record<LudoColor, [number, number][]> = {
  [LudoColor.RED]: [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  [LudoColor.GREEN]: [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
  [LudoColor.YELLOW]: [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],
  [LudoColor.BLUE]: [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
};

const BASE_POSITIONS: Record<LudoColor, [number, number][]> = {
  [LudoColor.RED]: [[1.5,1.5],[4.5,1.5],[1.5,4.5],[4.5,4.5]],
  [LudoColor.GREEN]: [[10.5,1.5],[13.5,1.5],[10.5,4.5],[13.5,4.5]],
  [LudoColor.YELLOW]: [[10.5,10.5],[13.5,10.5],[10.5,13.5],[13.5,13.5]],
  [LudoColor.BLUE]: [[1.5,10.5],[4.5,10.5],[1.5,13.5],[4.5,13.5]],
};

const BASE_RECTS: Record<LudoColor, { x: number; y: number; w: number; h: number }> = {
  [LudoColor.RED]: { x: 0, y: 0, w: 6, h: 6 },
  [LudoColor.GREEN]: { x: 9, y: 0, w: 6, h: 6 },
  [LudoColor.YELLOW]: { x: 9, y: 9, w: 6, h: 6 },
  [LudoColor.BLUE]: { x: 0, y: 9, w: 6, h: 6 },
};

function getAbsolutePosition(color: LudoColor, stepsFromStart: number): number {
  if (stepsFromStart <= 0 || stepsFromStart > LUDO_BOARD_SIZE) return -1;
  const start = LUDO_START_POSITIONS[color];
  return (start + stepsFromStart - 1) % LUDO_BOARD_SIZE;
}

/** Get pixel position for any step value (exported for hop animation) */
function getPixelForStep(step: number, color: LudoColor, tokenId: number): [number, number] {
  if (step === 0) {
    const basePos = BASE_POSITIONS[color][tokenId];
    return [basePos[0] * CELL_SIZE, basePos[1] * CELL_SIZE];
  }
  if (step >= LUDO_BOARD_SIZE + 7) {
    const offsets = [[-0.3,-0.3],[0.3,-0.3],[-0.3,0.3],[0.3,0.3]];
    const o = offsets[tokenId];
    return [(7 + o[0]) * CELL_SIZE, (7 + o[1]) * CELL_SIZE];
  }
  if (step > LUDO_BOARD_SIZE) {
    const homeIdx = step - LUDO_BOARD_SIZE - 1;
    const homeCoords = HOME_COLUMNS[color];
    if (homeIdx >= 0 && homeIdx < homeCoords.length) {
      const [cx, cy] = homeCoords[homeIdx];
      return [(cx + 0.5) * CELL_SIZE, (cy + 0.5) * CELL_SIZE];
    }
  }
  const absPos = getAbsolutePosition(color, step);
  if (absPos >= 0 && absPos < TRACK_COORDS.length) {
    const [cx, cy] = TRACK_COORDS[absPos];
    return [(cx + 0.5) * CELL_SIZE, (cy + 0.5) * CELL_SIZE];
  }
  return [7.5 * CELL_SIZE, 7.5 * CELL_SIZE];
}

const HOP_STEP_DURATION = 0.1; // seconds per hop step

/** Hopping token component — animates through intermediate squares */
function HoppingToken({
  token,
  color,
  isMovable,
  isSelected,
  colorDef,
  pawnH,
  onClick,
}: {
  token: { id: number; stepsFromStart: number; state: string };
  color: LudoColor;
  isMovable: boolean;
  isSelected: boolean;
  colorDef: typeof COLORS[LudoColor];
  pawnH: number;
  onClick: () => void;
}) {
  const prevStepsRef = useRef(token.stepsFromStart);
  const [animPos, setAnimPos] = useState(() => getPixelForStep(token.stepsFromStart, color, token.id));
  const animatingRef = useRef(false);

  useEffect(() => {
    const prevSteps = prevStepsRef.current;
    const newSteps = token.stepsFromStart;
    prevStepsRef.current = newSteps;

    if (prevSteps === newSteps || animatingRef.current) {
      // No change or already animating — just jump
      setAnimPos(getPixelForStep(newSteps, color, token.id));
      return;
    }

    // Token sent back to base (captured)
    if (newSteps === 0 && prevSteps > 0) {
      setAnimPos(getPixelForStep(0, color, token.id));
      return;
    }

    // Entering from base: jump from base to step 1 position
    if (prevSteps === 0 && newSteps >= 1) {
      // Animate: base → step 1 → ... → newSteps
      const waypoints: [number, number][] = [];
      for (let s = 1; s <= newSteps; s++) {
        waypoints.push(getPixelForStep(s, color, token.id));
      }
      animateWaypoints(waypoints);
      return;
    }

    // Normal forward movement: step through each cell
    if (newSteps > prevSteps) {
      const waypoints: [number, number][] = [];
      for (let s = prevSteps + 1; s <= newSteps; s++) {
        waypoints.push(getPixelForStep(s, color, token.id));
      }
      animateWaypoints(waypoints);
      return;
    }

    // Fallback — just set position
    setAnimPos(getPixelForStep(newSteps, color, token.id));
  }, [token.stepsFromStart, color, token.id]);

  function animateWaypoints(waypoints: [number, number][]) {
    if (waypoints.length === 0) return;
    animatingRef.current = true;
    let i = 0;
    const step = () => {
      setAnimPos(waypoints[i]);
      i++;
      if (i < waypoints.length) {
        setTimeout(step, HOP_STEP_DURATION * 1000);
      } else {
        animatingRef.current = false;
      }
    };
    step();
  }

  const c = colorDef;

  return (
    <motion.g
      onClick={onClick}
      style={{ cursor: isMovable ? 'pointer' : 'default' }}
      animate={{ x: animPos[0], y: animPos[1] }}
      transition={{ type: 'tween', duration: HOP_STEP_DURATION, ease: 'easeOut' }}
    >
      {isMovable && (
        <circle
          cx={0}
          cy={pawnH * 0.1}
          r={CELL_SIZE * 0.48}
          fill="none"
          stroke={c.bg}
          strokeWidth={2.5}
          opacity={0.7}
          className="ludo-pulse"
        />
      )}
      {isSelected && (
        <circle
          cx={0}
          cy={pawnH * 0.1}
          r={CELL_SIZE * 0.5}
          fill="none"
          stroke="#fff"
          strokeWidth={2.5}
          opacity={0.9}
          filter="url(#glow)"
        />
      )}
      <g filter="url(#tokenShadow)">
        <ellipse
          cx={0}
          cy={pawnH * 0.42}
          rx={pawnH * 0.38}
          ry={pawnH * 0.14}
          fill={c.token}
        />
        <path
          d={`M ${-pawnH * 0.28} ${pawnH * 0.38} Q ${-pawnH * 0.18} ${-pawnH * 0.05} 0 ${-pawnH * 0.15} Q ${pawnH * 0.18} ${-pawnH * 0.05} ${pawnH * 0.28} ${pawnH * 0.38} Z`}
          fill={c.bg}
        />
        <circle
          cx={0}
          cy={-pawnH * 0.28}
          r={pawnH * 0.2}
          fill={c.bg}
        />
        <circle
          cx={-pawnH * 0.06}
          cy={-pawnH * 0.34}
          r={pawnH * 0.07}
          fill="#fff"
          opacity={0.4}
        />
        <path
          d={`M ${-pawnH * 0.08} ${pawnH * 0.3} Q ${-pawnH * 0.04} ${pawnH * 0.05} 0 ${-pawnH * 0.1} Q ${pawnH * 0.04} ${pawnH * 0.05} ${pawnH * 0.08} ${pawnH * 0.3} Z`}
          fill="#fff"
          opacity={0.15}
        />
      </g>
      <text
        x={0}
        y={pawnH * 0.2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="11"
        fontWeight="bold"
        fill="#fff"
      >
        {token.id + 1}
      </text>
    </motion.g>
  );
}

// ─── Component Props ───

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
  players,
  myColor,
  currentTurn,
  availableMoves,
  onMoveSelect,
  lastMove,
  disabled,
  selectedTokenId,
  onTokenSelect,
}: LudoBoardProps) {
  const movableTokenIds = useMemo(() => {
    if (!availableMoves || availableMoves.length === 0) return new Set<number>();
    const ids = new Set<number>();
    for (const combo of availableMoves) {
      for (const action of combo) ids.add(action.tokenId);
    }
    return ids;
  }, [availableMoves]);

  const handleTokenClick = useCallback(
    (playerId: string, tokenId: number) => {
      if (disabled) return;
      const myPlayer = players.find((p) => p.color === myColor);
      if (!myPlayer || playerId !== myPlayer.id) return;
      if (!movableTokenIds.has(tokenId)) return;

      if (selectedTokenId === tokenId) {
        onTokenSelect?.(null);
        return;
      }
      onTokenSelect?.(tokenId);

      const tokenMoves = availableMoves?.filter((combo) =>
        combo.some((a) => a.tokenId === tokenId),
      );
      if (tokenMoves && tokenMoves.length === 1) {
        onMoveSelect(tokenMoves[0]);
        onTokenSelect?.(null);
      }
    },
    [disabled, players, myColor, movableTokenIds, selectedTokenId, onTokenSelect, availableMoves, onMoveSelect],
  );

  const myPlayer = players.find((p) => p.color === myColor);
  // Build a set of active player colors for dimming inactive zones
  const activeColors = useMemo(() => new Set(players.map((p) => p.color)), [players]);

  const pawnH = CELL_SIZE * 0.75;

  return (
    <div className="inline-block">
      <svg
        viewBox={`0 0 ${BOARD_PX} ${BOARD_PX}`}
        width="100%"
        style={{ maxWidth: BOARD_PX, maxHeight: BOARD_PX }}
        className="select-none drop-shadow-2xl"
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="tokenShadow">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* Background */}
        <rect width={BOARD_PX} height={BOARD_PX} fill="#0f0f1e" rx="12" />
        <rect width={BOARD_PX} height={BOARD_PX} fill="none" stroke="#ffffff10" strokeWidth="2" rx="12" />

        {/* All 4 base areas always shown */}
        {ALL_COLORS.map((color) => {
          const c = COLORS[color];
          const baseRect = BASE_RECTS[color];
          const isActive = activeColors.has(color);
          return (
            <g key={color} opacity={isActive ? 1 : 0.3}>
              <rect
                x={baseRect.x * CELL_SIZE + 2}
                y={baseRect.y * CELL_SIZE + 2}
                width={baseRect.w * CELL_SIZE - 4}
                height={baseRect.h * CELL_SIZE - 4}
                fill={c.bg}
                opacity={0.15}
                rx="10"
              />
              <rect
                x={(baseRect.x + 0.8) * CELL_SIZE}
                y={(baseRect.y + 0.8) * CELL_SIZE}
                width={(baseRect.w - 1.6) * CELL_SIZE}
                height={(baseRect.h - 1.6) * CELL_SIZE}
                fill={c.bg}
                opacity={0.08}
                rx="8"
                stroke={c.bg}
                strokeWidth="1"
                strokeOpacity={0.3}
              />
              {/* Base token slots */}
              {BASE_POSITIONS[color].map(([bx, by], i) => (
                <circle
                  key={i}
                  cx={bx * CELL_SIZE}
                  cy={by * CELL_SIZE}
                  r={CELL_SIZE * 0.35}
                  fill={c.bg}
                  opacity={0.12}
                  stroke={c.bg}
                  strokeWidth="1"
                  strokeOpacity={0.2}
                />
              ))}
            </g>
          );
        })}

        {/* Track squares */}
        {TRACK_COORDS.map(([cx, cy], i) => {
          const isSafe = LUDO_SAFE_SQUARES.includes(i);
          const startColor = Object.entries(LUDO_START_POSITIONS).find(
            ([, pos]) => pos === i,
          );
          const trackColor = startColor ? COLORS[startColor[0] as LudoColor] : null;

          return (
            <g key={`track-${i}`}>
              <rect
                x={cx * CELL_SIZE + 1}
                y={cy * CELL_SIZE + 1}
                width={CELL_SIZE - 2}
                height={CELL_SIZE - 2}
                fill={trackColor ? trackColor.light : '#1a1a35'}
                stroke={trackColor ? trackColor.bg : '#252545'}
                strokeWidth={1}
                rx="4"
              />
              {isSafe && (
                <text
                  x={(cx + 0.5) * CELL_SIZE}
                  y={(cy + 0.5) * CELL_SIZE}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="16"
                  fill={trackColor ? trackColor.bg : '#555'}
                  opacity={0.7}
                >
                  ★
                </text>
              )}
            </g>
          );
        })}

        {/* All 4 home columns always shown */}
        {ALL_COLORS.map((color) => {
          const c = COLORS[color];
          const cols = HOME_COLUMNS[color];
          const isActive = activeColors.has(color);
          return cols.map(([cx, cy], i) => (
            <rect
              key={`home-${color}-${i}`}
              x={cx * CELL_SIZE + 1}
              y={cy * CELL_SIZE + 1}
              width={CELL_SIZE - 2}
              height={CELL_SIZE - 2}
              fill={c.bg}
              opacity={isActive ? 0.3 + i * 0.08 : 0.1}
              rx="4"
            />
          ));
        })}

        {/* Center home */}
        <rect
          x={6.25 * CELL_SIZE}
          y={6.25 * CELL_SIZE}
          width={2.5 * CELL_SIZE}
          height={2.5 * CELL_SIZE}
          fill="#1a1a35"
          stroke="#ffffff15"
          strokeWidth={2}
          rx="6"
        />
        {ALL_COLORS.map((color, idx) => {
          const c = COLORS[color];
          const cx = 7.5 * CELL_SIZE;
          const cy = 7.5 * CELL_SIZE;
          const r = 1.1 * CELL_SIZE;
          const angle = (idx * Math.PI * 2) / 4 - Math.PI / 2;
          const nextAngle = ((idx + 1) * Math.PI * 2) / 4 - Math.PI / 2;
          const x1 = cx + r * Math.cos(angle);
          const y1 = cy + r * Math.sin(angle);
          const x2 = cx + r * Math.cos(nextAngle);
          const y2 = cy + r * Math.sin(nextAngle);
          return (
            <polygon
              key={`center-${color}`}
              points={`${cx},${cy} ${x1},${y1} ${x2},${y2}`}
              fill={c.bg}
              opacity={activeColors.has(color) ? 0.35 : 0.1}
            />
          );
        })}

        {/* Tokens — Pawn shapes with hop animation */}
        {players.map((p) => {
          const c = COLORS[p.color];
          return p.tokens.map((token) => {
            const isMovable =
              myPlayer?.id === p.id && movableTokenIds.has(token.id) && !disabled;
            const isSelected = selectedTokenId === token.id && myPlayer?.id === p.id;

            return (
              <HoppingToken
                key={`token-${p.id}-${token.id}`}
                token={token}
                color={p.color}
                isMovable={isMovable}
                isSelected={isSelected}
                colorDef={c}
                pawnH={pawnH}
                onClick={() => handleTokenClick(p.id, token.id)}
              />
            );
          });
        })}
      </svg>
    </div>
  );
}
