'use client';

import { Button } from '@/components/ui/Button';
import type { MemoryMatchAction, MemoryMatchPlayerView } from '@/shared';

interface Props { view: MemoryMatchPlayerView; disabled: boolean; onAction: (action: MemoryMatchAction) => void }

function tileTone(tile: MemoryMatchPlayerView['tiles'][number]): string {
  if (tile.matchedBy) return 'border-[#77cfa8] bg-[#204838] text-[#e8fff4]';
  if (tile.revealed) return 'border-[#f28f62] bg-[#f0e4d5] text-[#35251f]';
  return 'border-[#f28f62]/35 bg-[#503127] bg-[radial-gradient(circle_at_center,rgba(242,143,98,0.18)_0,transparent_65%)] text-[#f2c7ac] hover:-translate-y-0.5';
}

export function MemoryMatchRenderer({ view, disabled, onAction }: Readonly<Props>) {
  return (
    <div className="w-full max-w-[46rem]">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{view.players.map((player) => <div key={player.id} className="flex justify-between gap-2 border-b border-white/10 px-3 py-2"><span className="truncate font-bold">{player.name}</span><span className="font-black text-[#f2c7ac]">{view.scores[player.id]}</span></div>)}</div>
      <div className="mx-auto mt-4 grid w-full grid-cols-4 gap-2 sm:mt-7 sm:grid-cols-6" aria-label="Memory Match tiles">{view.tiles.map((tile, tileIndex) => {
        const legal = view.legalTileIndices.includes(tileIndex);
        return <button key={tile.id} type="button" disabled={disabled || !view.canAct || !legal || view.phase !== 'playing'} onClick={() => onAction({ type: 'reveal_tile', tileIndex })} aria-label={tile.symbol ? `Tile ${tileIndex + 1}: ${tile.symbol}` : `Hidden tile ${tileIndex + 1}`} className={`flex aspect-square min-h-[44px] min-w-0 items-center justify-center rounded-md border font-black shadow-md transition-transform disabled:opacity-100 ${tile.symbol ? 'text-2xl sm:text-3xl' : 'text-xl'} ${tileTone(tile)}`}>{tile.symbol ?? '?'}</button>;
      })}</div>
      {view.phase === 'awaiting_ack' && view.canAct && <div className="mt-6 flex justify-center"><Button disabled={disabled} onClick={() => onAction({ type: 'acknowledge_mismatch' })}>Hide mismatch</Button></div>}
    </div>
  );
}