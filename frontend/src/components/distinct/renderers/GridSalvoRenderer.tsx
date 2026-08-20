'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { GridSalvoAction, GridSalvoPlayerView, GridSalvoShipPlacement } from '@/shared';

const SHIP_LENGTHS = [5, 4, 3, 3, 2];

interface Props {
  view: GridSalvoPlayerView;
  disabled: boolean;
  onAction: (action: GridSalvoAction) => void;
}

export function GridSalvoRenderer({ view, disabled, onAction }: Props) {
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [ships, setShips] = useState<GridSalvoShipPlacement[]>([]);

  useEffect(() => {
    if (!view.yourReady) setShips([]);
  }, [view.yourReady, view.phase]);

  const localCells = new Set(ships.flatMap((ship) => {
    const step = Math.floor(ship.start / 10) === Math.floor(ship.end / 10) ? 1 : 10;
    const cells: number[] = [];
    for (let cell = Math.min(ship.start, ship.end); cell <= Math.max(ship.start, ship.end); cell += step) cells.push(cell);
    return cells;
  }));
  const nextLength = SHIP_LENGTHS[ships.length];

  const place = (start: number) => {
    if (disabled || view.yourReady || nextLength === undefined) return;
    const row = Math.floor(start / 10);
    const column = start % 10;
    if (orientation === 'horizontal' && column + nextLength > 10) return;
    if (orientation === 'vertical' && row + nextLength > 10) return;
    const end = start + (orientation === 'horizontal' ? nextLength - 1 : (nextLength - 1) * 10);
    const cells = Array.from({ length: nextLength }, (_, index) => start + index * (orientation === 'horizontal' ? 1 : 10));
    if (cells.some((cell) => localCells.has(cell))) return;
    setShips((current) => [...current, { start, end }]);
  };

  const renderGrid = (kind: 'own' | 'target') => (
    <div role="grid" aria-label={kind === 'own' ? 'Your ocean grid' : 'Opponent ocean grid'} className="grid aspect-square grid-cols-10 overflow-hidden border border-white/20 bg-[#0e2630]">
      {Array.from({ length: 100 }, (_, cell) => {
        const value = kind === 'own' ? view.yourOcean[cell] : view.opponentOcean[cell];
        const localShip = kind === 'own' && localCells.has(cell);
        const announcedValue = localShip ? 'ship' : value;
        const enabled = kind === 'target'
          ? view.canAct && view.phase === 'playing' && value === 'unknown' && !disabled
          : view.phase === 'placement' && !view.yourReady && !disabled;
        const tone = value === 'hit' ? 'bg-[#ff684d]' : value === 'miss' ? 'bg-[#d7eef2]/45' : value === 'ship' || localShip ? 'bg-[#58c7d9]' : 'bg-[#123844]';
        return (
          <button
            key={cell}
            type="button"
            role="gridcell"
            disabled={!enabled}
            onClick={() => kind === 'target' ? onAction({ type: 'shoot', cell }) : place(cell)}
            aria-label={`${kind === 'own' ? 'Own' : 'Target'} row ${Math.floor(cell / 10) + 1}, column ${(cell % 10) + 1}, ${announcedValue}`}
            className={`aspect-square border border-white/10 ${tone} enabled:hover:outline enabled:hover:outline-2 enabled:hover:outline-inset enabled:hover:outline-white disabled:cursor-default`}
          />
        );
      })}
    </div>
  );

  if (view.phase === 'placement') {
    return (
      <div className="w-full max-w-[44rem]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2" role="group" aria-label="Ship orientation">
            {(['horizontal', 'vertical'] as const).map((value) => (
              <button key={value} type="button" aria-pressed={orientation === value} onClick={() => setOrientation(value)} className={`min-h-10 px-3 text-sm font-bold ${orientation === value ? 'bg-[#58c7d9] text-[#10272f]' : 'border border-white/15 text-white'}`}>{value === 'horizontal' ? 'Horizontal' : 'Vertical'}</button>
            ))}
          </div>
          <p className="text-sm font-semibold text-white/70">{view.yourReady ? 'Fleet locked' : `Ship ${ships.length + 1}/5${nextLength ? `, length ${nextLength}` : ''}`}</p>
        </div>
        {renderGrid('own')}
        {!view.yourReady && (
          <div className="mt-4 flex justify-center gap-3">
            <Button variant="secondary" disabled={ships.length === 0} onClick={() => setShips((current) => current.slice(0, -1))}>Undo</Button>
            <Button disabled={ships.length !== 5} onClick={() => onAction({ type: 'place_fleet', ships })}>Lock fleet</Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid w-full max-w-[52rem] gap-5 sm:grid-cols-2">
      <section><h2 className="mb-2 text-center text-sm font-bold text-white/65">YOUR OCEAN</h2>{renderGrid('own')}</section>
      <section><h2 className="mb-2 text-center text-sm font-bold text-white/65">TARGET GRID</h2>{renderGrid('target')}</section>
    </div>
  );
}