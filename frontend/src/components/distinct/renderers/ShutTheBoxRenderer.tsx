'use client';

import { Button } from '@/components/ui/Button';
import type { ShutTheBoxAction, ShutTheBoxPlayerView } from '@/shared';

interface Props { view: ShutTheBoxPlayerView; disabled: boolean; onAction: (action: ShutTheBoxAction) => void }

export function ShutTheBoxRenderer({ view, disabled, onAction }: Props) {
  const yourOpen = new Set(view.openTiles[view.youId]);
  return (
    <div className="w-full max-w-[48rem]">
      <div className="grid gap-2 sm:grid-cols-2">
        {view.players.map((player) => <div key={player.id} className="flex items-center justify-between border-b border-white/10 px-3 py-2"><span className="truncate font-semibold">{player.name}</span><span className="text-sm text-white/55">{view.scores[player.id] ?? `${view.openTiles[player.id].reduce((sum, tile) => sum + tile, 0)} open`}</span></div>)}
      </div>
      <div className="mt-8 grid grid-cols-9 gap-1" aria-label="Your tiles one through nine">
        {Array.from({ length: 9 }, (_, index) => index + 1).map((tile) => <span key={tile} className={`flex aspect-[2/3] items-center justify-center border text-xl font-black sm:text-3xl ${yourOpen.has(tile) ? 'border-[#d9c39a] bg-[#d9c39a] text-[#292219]' : 'border-white/5 bg-black/25 text-white/15 line-through'}`}>{tile}</span>)}
      </div>
      <div className="mt-7 text-center"><p className="text-xs font-bold text-white/45">ROLL</p><p className="text-4xl font-black text-white">{view.roll.length ? `${view.roll.join(' + ')} = ${view.roll.reduce((sum, die) => sum + die, 0)}` : 'Ready'}</p></div>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {view.phase === 'rolling' && <Button disabled={disabled || !view.canAct} onClick={() => onAction({ type: 'roll_box' })}>Roll</Button>}
        {view.phase === 'closing' && view.legalCombinations.map((combination) => <button key={combination.join('-')} type="button" disabled={disabled || !view.canAct} onClick={() => onAction({ type: 'close_tiles', tiles: combination })} className="min-h-11 border border-[#d9c39a] px-4 font-bold text-[#f0dfbf] hover:bg-[#d9c39a] hover:text-[#292219] disabled:opacity-50" aria-label={`Close tiles ${combination.join(', ')}`}>{combination.join(' + ')}</button>)}
      </div>
    </div>
  );
}