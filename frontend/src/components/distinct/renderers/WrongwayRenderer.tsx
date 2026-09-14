'use client';

import { useMemo, useState } from 'react';
import type {
  WrongwayAction,
  WrongwayPlayer,
  WrongwayPlayerView,
  WrongwayWall,
  WrongwayWallOrientation,
} from '@/shared';

interface WrongwayRendererProps {
  view: WrongwayPlayerView;
  disabled: boolean;
  onAction: (action: WrongwayAction) => void;
}

const BOARD_SIZE = 9;
const WALL_ANCHOR_SIZE = 8;

type InputMode = 'move' | 'wall';

export function WrongwayRenderer({ view, disabled, onAction }: WrongwayRendererProps) {
  const [mode, setMode] = useState<InputMode>('move');
  const [orientation, setOrientation] = useState<WrongwayWallOrientation>('horizontal');

  const playersByCell = useMemo(() => {
    const map = new Map<string, WrongwayPlayer>();
    for (const player of view.players) {
      map.set(`${player.position.row}:${player.position.column}`, player);
    }
    return map;
  }, [view.players]);

  const legalMoves = useMemo(() => new Set(view.legalMoves), [view.legalMoves]);
  const legalWalls = useMemo(() => {
    const set = new Set<string>();
    for (const wall of view.legalWallPlacements) {
      set.add(wallKey(wall.orientation, wall.row, wall.column));
    }
    return set;
  }, [view.legalWallPlacements]);

  const currentPlayer = view.players.find((player) => player.id === view.currentTurnId) ?? null;
  const winner = view.winnerId
    ? view.players.find((player) => player.id === view.winnerId) ?? null
    : null;
  const canInteract = view.phase === 'playing' && view.canAct && !disabled;

  return (
    <section className="w-full max-w-[44rem] rounded-md border border-[#172844] bg-[#050b1e] p-3 text-[#d7e5ff] sm:p-4" aria-label="Wrongway game panel">
      <div className="flex flex-wrap items-center gap-2" aria-label="Wrongway input mode controls">
        <button
          type="button"
          aria-label="Move mode"
          aria-pressed={mode === 'move'}
          onClick={() => setMode('move')}
          className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${mode === 'move' ? 'border-[#675cff] bg-[#675cff] text-white' : 'border-[#314869] bg-[#08142d] text-[#c7d6f6]'}`}
        >
          Move
        </button>
        <button
          type="button"
          aria-label="Wall mode"
          aria-pressed={mode === 'wall'}
          onClick={() => setMode('wall')}
          className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${mode === 'wall' ? 'border-[#675cff] bg-[#675cff] text-white' : 'border-[#314869] bg-[#08142d] text-[#c7d6f6]'}`}
        >
          Wall
        </button>
        {mode === 'wall' && (
          <div className="ml-auto flex items-center gap-2" aria-label="Wall orientation controls">
            <button
              type="button"
              aria-label="Horizontal orientation"
              aria-pressed={orientation === 'horizontal'}
              onClick={() => setOrientation('horizontal')}
              className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${orientation === 'horizontal' ? 'border-[#675cff] bg-[#675cff] text-white' : 'border-[#314869] bg-[#08142d] text-[#c7d6f6]'}`}
            >
              Horizontal
            </button>
            <button
              type="button"
              aria-label="Vertical orientation"
              aria-pressed={orientation === 'vertical'}
              onClick={() => setOrientation('vertical')}
              className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${orientation === 'vertical' ? 'border-[#675cff] bg-[#675cff] text-white' : 'border-[#314869] bg-[#08142d] text-[#c7d6f6]'}`}
            >
              Vertical
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="min-w-0 rounded-md border border-[#1b3356] bg-[#08142d] p-2">
          <div className="mx-auto w-full max-w-[23rem]">
            <div
              aria-label="Wrongway board"
              className="relative aspect-square w-full overflow-hidden rounded-md border border-[#2a4467] bg-[#08142d]"
              data-wrongway-board
            >
              <div className="grid h-full w-full grid-cols-9 grid-rows-9">
                {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, cell) => {
                  const row = Math.floor(cell / BOARD_SIZE);
                  const column = cell % BOARD_SIZE;
                  const pawn = playersByCell.get(`${row}:${column}`) ?? null;
                  const legalMove = mode === 'move' && canInteract && legalMoves.has(cell);
                  const label = cellLabel(row, column, pawn, legalMove);

                  return (
                    <button
                      key={`wrongway-cell-${row}-${column}`}
                      type="button"
                      data-wrongway-cell
                      data-cell-row={row}
                      data-cell-column={column}
                      data-cell-index={cell}
                      aria-label={label}
                      disabled={!legalMove}
                      onClick={() => onAction({ type: 'wrongway_move', cell })}
                      className={`relative flex items-center justify-center border border-[#314869] ${(row + column) % 2 === 0 ? 'bg-[#0b1b3b]' : 'bg-[#08142d]'} disabled:cursor-default disabled:opacity-100`}
                    >
                      {legalMove && <span className="h-2.5 w-2.5 rounded-full bg-[#675cff]" />}
                      {pawn && (
                        <span
                          data-wrongway-pawn
                          data-pawn-player-id={pawn.id}
                          data-pawn-row={row}
                          data-pawn-column={column}
                          data-pawn-color={pawn.color}
                          className={`absolute h-[68%] w-[68%] rounded-full border-2 ${pawn.color === 'red' ? 'border-[#ff9ca3] bg-[#ff4e59]' : 'border-[#9ac3ff] bg-[#4d9cff]'}`}
                          style={{
                            boxShadow: pawn.color === 'red'
                              ? '0 0 8px rgba(255, 78, 89, 0.8)'
                              : '0 0 8px rgba(77, 156, 255, 0.8)',
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                {view.walls.map((wall) => (
                  <span
                    key={`wall-${wall.orientation}-${wall.row}-${wall.column}`}
                    data-wrongway-wall
                    data-wall-orientation={wall.orientation}
                    data-wall-row={wall.row}
                    data-wall-column={wall.column}
                    data-wall-color={wall.color ?? 'blue'}
                    className={`absolute rounded-[2px] border ${wall.color === 'red' ? 'border-[#ff9ca3]/70 bg-[#ff4e59]' : 'border-[#adc7ff]/70 bg-[#4d9cff]'}`}
                    style={{
                      ...placedWallStyle(wall),
                      boxShadow: wall.color === 'red'
                        ? '0 0 8px rgba(255, 78, 89, 0.78)'
                        : '0 0 8px rgba(77, 156, 255, 0.78)',
                    }}
                  />
                ))}
              </div>

              {mode === 'wall' && (
                <div className="absolute inset-0" aria-label="Wrongway wall anchors">
                  {Array.from({ length: WALL_ANCHOR_SIZE * WALL_ANCHOR_SIZE }, (_, anchor) => {
                    const row = Math.floor(anchor / WALL_ANCHOR_SIZE);
                    const column = anchor % WALL_ANCHOR_SIZE;
                    const legal = canInteract && legalWalls.has(wallKey(orientation, row, column));
                    return (
                      <button
                        key={`anchor-${orientation}-${row}-${column}`}
                        type="button"
                        data-wrongway-wall-anchor
                        data-wall-anchor-row={row}
                        data-wall-anchor-column={column}
                        data-wall-anchor-orientation={orientation}
                        data-wall-anchor-legal={legal}
                        aria-label={`Wall anchor row ${row + 1}, column ${column + 1}, ${orientation}${legal ? ', legal' : ', illegal'}`}
                        disabled={!legal}
                        onClick={() => onAction({ type: 'wrongway_place_wall', row, column, orientation })}
                        className={`absolute rounded-[2px] border border-[#675cff] ${legal ? 'bg-[#675cff]/35 hover:bg-[#675cff]/50' : 'bg-transparent opacity-0'} disabled:cursor-default`}
                        style={anchorStyle(orientation, row, column)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="rounded-md border border-[#1b3356] bg-[#08142d] p-3 text-sm" aria-label="Wrongway game details">
          <p className="font-semibold text-[#c7d6f6]">Turn: {currentPlayer ? currentPlayer.name : 'Unknown'}</p>
          <div className="mt-2 space-y-2">
            {view.players.map((player) => (
              <div key={player.id} className="rounded-md border border-[#203b61] bg-[#091933] px-2 py-1.5">
                <p className="flex items-center gap-2 font-semibold">
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full ${player.color === 'red' ? 'bg-[#ff4e59]' : 'bg-[#4d9cff]'}`}
                    style={{
                      boxShadow: player.color === 'red'
                        ? '0 0 6px rgba(255, 78, 89, 0.8)'
                        : '0 0 6px rgba(77, 156, 255, 0.8)',
                    }}
                  />
                  {player.name}
                </p>
                <p className="text-xs text-[#9db6dd]">Destination: {player.goalRow === 0 ? 'Top edge' : 'Bottom edge'}</p>
                <p className="text-xs text-[#9db6dd]">Walls: {player.wallsRemaining}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[#a9bfe2]">
            {view.phase === 'finished'
              ? `Winner: ${winner?.name ?? 'Unknown'}`
              : mode === 'move'
                ? 'Action: Select a highlighted destination.'
                : `Action: Place a ${orientation} wall on a highlighted anchor.`}
          </p>
        </aside>
      </div>
    </section>
  );
}

function wallKey(orientation: WrongwayWallOrientation, row: number, column: number): string {
  return `${orientation}:${row}:${column}`;
}

function cellLabel(row: number, column: number, pawn: WrongwayPlayer | null, legalMove: boolean): string {
  const parts = [`Row ${row + 1}`, `column ${column + 1}`];
  if (pawn) parts.push(`${pawn.color} pawn`);
  if (legalMove) parts.push('legal move');
  return parts.join(', ');
}

function placedWallStyle(wall: WrongwayWall): React.CSSProperties {
  const segment = 100 / BOARD_SIZE;
  const span = segment * 2;
  const thickness = segment * 0.2;
  if (wall.orientation === 'horizontal') {
    return {
      left: `${wall.column * segment}%`,
      top: `calc(${(wall.row + 1) * segment}% - ${thickness / 2}%)`,
      width: `${span}%`,
      height: `${thickness}%`,
    };
  }
  return {
    left: `calc(${(wall.column + 1) * segment}% - ${thickness / 2}%)`,
    top: `${wall.row * segment}%`,
    width: `${thickness}%`,
    height: `${span}%`,
  };
}

function anchorStyle(orientation: WrongwayWallOrientation, row: number, column: number): React.CSSProperties {
  const segment = 100 / BOARD_SIZE;
  const span = segment * 2;
  const hit = segment * 0.46;
  if (orientation === 'horizontal') {
    return {
      left: `${column * segment}%`,
      top: `calc(${(row + 1) * segment}% - ${hit / 2}%)`,
      width: `${span}%`,
      height: `${hit}%`,
    };
  }
  return {
    left: `calc(${(column + 1) * segment}% - ${hit / 2}%)`,
    top: `${row * segment}%`,
    width: `${hit}%`,
    height: `${span}%`,
  };
}