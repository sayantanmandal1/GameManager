'use client';

import type { HexAction, HexPlayerView } from '@/shared';

interface Props { view: HexPlayerView; disabled: boolean; onAction: (action: HexAction) => void }

function hexTone(stone: HexPlayerView['board'][number]): string {
  if (stone === 'vertical') return 'bg-[#f16b76]';
  if (stone === 'horizontal') return 'bg-[#6fc6d1]';
  return 'bg-[#eee9da] hover:bg-white';
}

function hexLabel(row: number, column: number, stone: HexPlayerView['board'][number]): string {
  const state = stone ? `, ${stone}` : ', empty';
  return `Hex row ${row + 1}, column ${column + 1}${state}`;
}

export function HexRenderer({ view, disabled, onAction }: Readonly<Props>) {
  return (
    <div className="w-full max-w-[44rem]">
      <div className="mx-auto w-full overflow-x-auto pb-3" aria-label="Eleven by eleven Hex board">
        <div className="mx-auto grid min-w-[34rem] max-w-[42rem] grid-cols-11 gap-1 px-7 py-3">
          {view.board.map((stone, cell) => {
            const row = Math.floor(cell / 11);
            const column = cell % 11;
            const legal = view.legalCells.includes(cell);
            const cellKey = `hex-r${row}-c${column}`;
            return <button key={cellKey} type="button" disabled={disabled || !view.canAct || !legal} onClick={() => onAction({ type: 'place_hex', cell })} aria-label={hexLabel(row, column, stone)} className={`aspect-square border border-black/30 shadow-sm disabled:cursor-default ${hexTone(stone)} disabled:opacity-100`} style={{ transform: `translateX(${row * 0.72}rem) rotate(30deg)`, clipPath: 'polygon(25% 6%,75% 6%,100% 50%,75% 94%,25% 94%,0 50%)' }} />;
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-5 text-sm text-white/60">{view.players.map((player) => <span key={player.id}><span className={`mr-2 inline-block h-3 w-3 ${player.stone === 'vertical' ? 'bg-[#f16b76]' : 'bg-[#6fc6d1]'}`} />{player.name}: {player.stone === 'vertical' ? 'top–bottom' : 'left–right'}</span>)}</div>
    </div>
  );
}