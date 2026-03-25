'use client';

import { useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LudoPlayerState, LudoMoveAction, LudoMoveRecord } from '@/shared';
import { LudoColor, LUDO_START_POSITIONS, LUDO_SAFE_SQUARES, LUDO_BOARD_SIZE } from '@/shared';

// ─── Board Geometry ───
// The Ludo board is a 15×15 grid. Each cell is CELL_SIZE px.
const CELL_SIZE = 36;
const BOARD_CELLS = 15;
const BOARD_PX = CELL_SIZE * BOARD_CELLS;

// Color palette
const COLORS: Record<LudoColor, { bg: string; fill: string; light: string; token: string }> = {
  [LudoColor.RED]: { bg: '#FF4C4C', fill: '#FF4C4C', light: '#FFD6D6', token: '#CC0000' },
  [LudoColor.GREEN]: { bg: '#4CAF50', fill: '#4CAF50', light: '#D6FFD6', token: '#2E7D32' },
  [LudoColor.YELLOW]: { bg: '#FFC107', fill: '#FFC107', light: '#FFF8D6', token: '#F57F17' },
  [LudoColor.BLUE]: { bg: '#2196F3', fill: '#2196F3', light: '#D6EAFF', token: '#1565C0' },
};

/**
 * Map of absolute board position (0–51) to pixel coordinates on the 15×15 grid.
 * The track goes clockwise starting from Red's entry.
 */
const TRACK_COORDS: [number, number][] = buildTrackCoordinates();

function buildTrackCoordinates(): [number, number][] {
  const coords: [number, number][] = [];

  // The Ludo main track follows the cross-shaped path.
  // We define it as 4 arms × 13 squares each = 52 squares.
  // Grid coords are (col, row) where (0,0) is top-left.

  // Segment 1: Red entry (top-left arm) — going up then right across top
  // Pos 0: Red start square (col=1, row=6)
  // Going up from (1,6) to (1,1), then right to (5,1), then down at (6,0)
  const seg: [number, number][] = [
    [1,6],[2,6],[3,6],[4,6],[5,6], // left to center-left (row 6)
    [6,5],[6,4],[6,3],[6,2],[6,1],[6,0], // up along col 6
    [7,0],[8,0], // across top
    [8,1],[8,2],[8,3],[8,4],[8,5], // down along col 8
    [9,6],[10,6],[11,6],[12,6],[13,6], // right along row 6
    [13,7],[13,8], // down right corner
    [12,8],[11,8],[10,8],[9,8], // left along row 8
    [8,9],[8,10],[8,11],[8,12],[8,13],[8,14], // down along col 8
    [7,14],[6,14], // across bottom
    [6,13],[6,12],[6,11],[6,10],[6,9], // up along col 6
    [5,8],[4,8],[3,8],[2,8],[1,8], // left along row 8
    [0,8],[0,7],[0,6], // up-left corner + back to start area
    [1,7], // This wraps back; but we stop at 52. Actually we need exactly 52.
  ];

  // The above manual approach is error-prone. Let me use a systematic approach.
  // Clear and rebuild properly.
  return buildSystematicTrack();
}

function buildSystematicTrack(): [number, number][] {
  // Standard Ludo board track on a 15×15 grid
  // The cross shape has paths of width 3 in each direction.
  // Track squares are on the outer 2 columns/rows of each arm.

  const c: [number, number][] = [];

  // Starting from Red's entry at position 0 = grid(1, 6), going clockwise
  // Bottom of top-left arm, going right then up then across...

  // Red's section (positions 0–12): Start bottom-left, go up, then right
  c.push([1,6]);  // 0: Red start (safe)
  c.push([2,6]);  // 1
  c.push([3,6]);  // 2
  c.push([4,6]);  // 3
  c.push([5,6]);  // 4
  c.push([6,5]);  // 5
  c.push([6,4]);  // 6
  c.push([6,3]);  // 7
  c.push([6,2]);  // 8: safe
  c.push([6,1]);  // 9
  c.push([6,0]);  // 10
  c.push([7,0]);  // 11
  c.push([8,0]);  // 12

  // Green's section (positions 13–25): Top-right, going down then left
  c.push([8,1]);  // 13: Green start (safe)
  c.push([8,2]);  // 14
  c.push([8,3]);  // 15
  c.push([8,4]);  // 16
  c.push([8,5]);  // 17
  c.push([9,6]);  // 18
  c.push([10,6]); // 19
  c.push([11,6]); // 20
  c.push([12,6]); // 21: safe
  c.push([13,6]); // 22
  c.push([14,6]); // 23
  c.push([14,7]); // 24
  c.push([14,8]); // 25

  // Yellow's section (positions 26–38): Bottom-right, going left then up
  c.push([13,8]); // 26: Yellow start (safe)
  c.push([12,8]); // 27
  c.push([11,8]); // 28
  c.push([10,8]); // 29
  c.push([9,8]);  // 30
  c.push([8,9]);  // 31
  c.push([8,10]); // 32
  c.push([8,11]); // 33
  c.push([8,12]); // 34: safe
  c.push([8,13]); // 35
  c.push([8,14]); // 36
  c.push([7,14]); // 37
  c.push([6,14]); // 38

  // Blue's section (positions 39–51): Bottom-left, going up then right
  c.push([6,13]); // 39: Blue start (safe)
  c.push([6,12]); // 40
  c.push([6,11]); // 41
  c.push([6,10]); // 42
  c.push([6,9]);  // 43
  c.push([5,8]);  // 44
  c.push([4,8]);  // 45
  c.push([3,8]);  // 46
  c.push([2,8]);  // 47: safe
  c.push([1,8]);  // 48
  c.push([0,8]);  // 49
  c.push([0,7]);  // 50
  c.push([0,6]);  // 51

  return c;
}

/** Home column coordinates for each color (6 squares leading to center) */
const HOME_COLUMNS: Record<LudoColor, [number, number][]> = {
  [LudoColor.RED]: [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  [LudoColor.GREEN]: [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
  [LudoColor.YELLOW]: [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],
  [LudoColor.BLUE]: [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
};

/** Base positions for tokens in each color's base area (4 positions) */
const BASE_POSITIONS: Record<LudoColor, [number, number][]> = {
  [LudoColor.RED]: [[1.5,1.5],[4.5,1.5],[1.5,4.5],[4.5,4.5]],
  [LudoColor.GREEN]: [[10.5,1.5],[13.5,1.5],[10.5,4.5],[13.5,4.5]],
  [LudoColor.YELLOW]: [[10.5,10.5],[13.5,10.5],[10.5,13.5],[13.5,13.5]],
  [LudoColor.BLUE]: [[1.5,10.5],[4.5,10.5],[1.5,13.5],[4.5,13.5]],
};

function getAbsolutePosition(color: LudoColor, stepsFromStart: number): number {
  if (stepsFromStart <= 0 || stepsFromStart > LUDO_BOARD_SIZE) return -1;
  const start = LUDO_START_POSITIONS[color];
  return (start + stepsFromStart - 1) % LUDO_BOARD_SIZE;
}

function getTokenPixelPosition(
  token: { stepsFromStart: number; state: string; id: number },
  color: LudoColor,
): [number, number] {
  // At base
  if (token.stepsFromStart === 0) {
    const basePos = BASE_POSITIONS[color][token.id];
    return [basePos[0] * CELL_SIZE, basePos[1] * CELL_SIZE];
  }

  // Finished (at center)
  if (token.stepsFromStart >= LUDO_BOARD_SIZE + 7) {
    const offsets = [[-0.3,-0.3],[0.3,-0.3],[-0.3,0.3],[0.3,0.3]];
    const o = offsets[token.id];
    return [(7 + o[0]) * CELL_SIZE, (7 + o[1]) * CELL_SIZE];
  }

  // On home column (steps 53–58 -> index 0–5)
  if (token.stepsFromStart > LUDO_BOARD_SIZE) {
    const homeIdx = token.stepsFromStart - LUDO_BOARD_SIZE - 1;
    const homeCoords = HOME_COLUMNS[color];
    if (homeIdx >= 0 && homeIdx < homeCoords.length) {
      const [cx, cy] = homeCoords[homeIdx];
      return [(cx + 0.5) * CELL_SIZE, (cy + 0.5) * CELL_SIZE];
    }
  }

  // On main track
  const absPos = getAbsolutePosition(color, token.stepsFromStart);
  if (absPos >= 0 && absPos < TRACK_COORDS.length) {
    const [cx, cy] = TRACK_COORDS[absPos];
    return [(cx + 0.5) * CELL_SIZE, (cy + 0.5) * CELL_SIZE];
  }

  return [7.5 * CELL_SIZE, 7.5 * CELL_SIZE];
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
  // Find which tokens can be moved
  const movableTokenIds = useMemo(() => {
    if (!availableMoves || availableMoves.length === 0) return new Set<number>();
    const ids = new Set<number>();
    for (const combo of availableMoves) {
      for (const action of combo) {
        ids.add(action.tokenId);
      }
    }
    return ids;
  }, [availableMoves]);

  // Get moves for a selected token
  const movesForToken = useMemo(() => {
    if (selectedTokenId == null || !availableMoves) return [];
    return availableMoves.filter((combo) =>
      combo.some((a) => a.tokenId === selectedTokenId),
    );
  }, [selectedTokenId, availableMoves]);

  const handleTokenClick = useCallback(
    (playerId: string, tokenId: number) => {
      if (disabled) return;
      const myPlayer = players.find((p) => p.color === myColor);
      if (!myPlayer || playerId !== myPlayer.id) return;
      if (!movableTokenIds.has(tokenId)) return;

      // If clicking same token, deselect
      if (selectedTokenId === tokenId) {
        onTokenSelect?.(null);
        return;
      }

      // Select this token
      onTokenSelect?.(tokenId);

      // If only one move combo involves this token, auto-execute
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

  return (
    <div className="inline-block">
      <svg
        viewBox={`0 0 ${BOARD_PX} ${BOARD_PX}`}
        width="100%"
        style={{ maxWidth: BOARD_PX, maxHeight: BOARD_PX }}
        className="select-none"
      >
        {/* Background */}
        <rect width={BOARD_PX} height={BOARD_PX} fill="#1a1a2e" rx="8" />

        {/* Base areas (4 colored squares in corners) */}
        {players.map((p) => {
          const c = COLORS[p.color];
          const baseRect = BASE_RECTS[p.color];
          return (
            <g key={p.color}>
              <rect
                x={baseRect.x * CELL_SIZE}
                y={baseRect.y * CELL_SIZE}
                width={baseRect.w * CELL_SIZE}
                height={baseRect.h * CELL_SIZE}
                fill={c.bg}
                opacity={0.2}
                rx="8"
              />
              <rect
                x={(baseRect.x + 0.5) * CELL_SIZE}
                y={(baseRect.y + 0.5) * CELL_SIZE}
                width={(baseRect.w - 1) * CELL_SIZE}
                height={(baseRect.h - 1) * CELL_SIZE}
                fill={c.bg}
                opacity={0.1}
                rx="6"
              />
            </g>
          );
        })}

        {/* Track squares */}
        {TRACK_COORDS.map(([cx, cy], i) => {
          const isSafe = LUDO_SAFE_SQUARES.includes(i);
          // Determine if this is a start square for any color
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
                fill={trackColor ? trackColor.light : '#2a2a4a'}
                stroke={trackColor ? trackColor.bg : '#3a3a5a'}
                strokeWidth={1}
                rx="3"
              />
              {isSafe && (
                <text
                  x={(cx + 0.5) * CELL_SIZE}
                  y={(cy + 0.5) * CELL_SIZE}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="14"
                  fill={trackColor ? trackColor.bg : '#666'}
                  opacity={0.6}
                >
                  ★
                </text>
              )}
            </g>
          );
        })}

        {/* Home columns */}
        {players.map((p) => {
          const c = COLORS[p.color];
          const cols = HOME_COLUMNS[p.color];
          return cols.map(([cx, cy], i) => (
            <rect
              key={`home-${p.color}-${i}`}
              x={cx * CELL_SIZE + 1}
              y={cy * CELL_SIZE + 1}
              width={CELL_SIZE - 2}
              height={CELL_SIZE - 2}
              fill={c.bg}
              opacity={0.3 + i * 0.1}
              rx="3"
            />
          ));
        })}

        {/* Center home triangle */}
        <rect
          x={6.5 * CELL_SIZE}
          y={6.5 * CELL_SIZE}
          width={2 * CELL_SIZE}
          height={2 * CELL_SIZE}
          fill="#2a2a4a"
          stroke="#4a4a6a"
          strokeWidth={2}
          rx="4"
        />
        {/* Center color triangles */}
        {players.map((p, idx) => {
          const c = COLORS[p.color];
          const cx = 7.5 * CELL_SIZE;
          const cy = 7.5 * CELL_SIZE;
          const r = 0.9 * CELL_SIZE;
          const angle = (idx * Math.PI * 2) / players.length - Math.PI / 2;
          const nextAngle = ((idx + 1) * Math.PI * 2) / players.length - Math.PI / 2;
          const x1 = cx + r * Math.cos(angle);
          const y1 = cy + r * Math.sin(angle);
          const x2 = cx + r * Math.cos(nextAngle);
          const y2 = cy + r * Math.sin(nextAngle);
          return (
            <polygon
              key={`center-${p.color}`}
              points={`${cx},${cy} ${x1},${y1} ${x2},${y2}`}
              fill={c.bg}
              opacity={0.4}
            />
          );
        })}

        {/* Tokens */}
        {players.map((p) => {
          const c = COLORS[p.color];
          return p.tokens.map((token) => {
            const [px, py] = getTokenPixelPosition(token, p.color);
            const isMovable =
              myPlayer?.id === p.id && movableTokenIds.has(token.id) && !disabled;
            const isSelected = selectedTokenId === token.id && myPlayer?.id === p.id;
            const isCurrentPlayer = p.id === currentTurn;

            return (
              <g
                key={`token-${p.id}-${token.id}`}
                onClick={() => handleTokenClick(p.id, token.id)}
                style={{ cursor: isMovable ? 'pointer' : 'default' }}
              >
                {/* Pulse animation for movable tokens */}
                {isMovable && (
                  <circle
                    cx={px}
                    cy={py}
                    r={CELL_SIZE * 0.42}
                    fill="none"
                    stroke={c.bg}
                    strokeWidth={2}
                    opacity={0.6}
                    className="ludo-pulse"
                  />
                )}
                {/* Selection ring */}
                {isSelected && (
                  <circle
                    cx={px}
                    cy={py}
                    r={CELL_SIZE * 0.45}
                    fill="none"
                    stroke="#fff"
                    strokeWidth={2.5}
                    opacity={0.9}
                  />
                )}
                {/* Token body */}
                <circle
                  cx={px}
                  cy={py}
                  r={CELL_SIZE * 0.35}
                  fill={c.token}
                  stroke={isMovable ? '#fff' : c.bg}
                  strokeWidth={isMovable ? 2 : 1.5}
                />
                {/* Token inner circle */}
                <circle
                  cx={px}
                  cy={py}
                  r={CELL_SIZE * 0.18}
                  fill={c.bg}
                  opacity={0.8}
                />
                {/* Token number (for accessibility) */}
                <text
                  x={px}
                  y={py}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="10"
                  fontWeight="bold"
                  fill="#fff"
                >
                  {token.id + 1}
                </text>
              </g>
            );
          });
        })}
      </svg>
    </div>
  );
}

// Base area rectangles (in grid units)
const BASE_RECTS: Record<LudoColor, { x: number; y: number; w: number; h: number }> = {
  [LudoColor.RED]: { x: 0, y: 0, w: 6, h: 6 },
  [LudoColor.GREEN]: { x: 9, y: 0, w: 6, h: 6 },
  [LudoColor.YELLOW]: { x: 9, y: 9, w: 6, h: 6 },
  [LudoColor.BLUE]: { x: 0, y: 9, w: 6, h: 6 },
};
