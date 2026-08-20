'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { FarkleAction, FarklePlayerView } from '@/shared';

interface Props { view: FarklePlayerView; disabled: boolean; onAction: (action: FarkleAction) => void }

export function FarkleRenderer({ view, disabled, onAction }: Props) {
  const [selected, setSelected] = useState<number[]>([]);
  useEffect(() => setSelected([]), [view.phase, view.dice.length, view.currentTurnId]);
  const selectable = new Set(view.selectableIndices);
  const toggle = (index: number) => selectable.has(index) && setSelected((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index]);
  return (
    <div className="w-full max-w-[48rem]">
      <div className="grid gap-2 sm:grid-cols-2">
        {view.players.map((player) => <div key={player.id} className="flex items-center justify-between border-b border-white/10 px-3 py-2"><span className="truncate font-semibold">{player.name}{view.entered[player.id] ? '' : ' (not in)'}</span><strong>{view.scores[player.id]}</strong></div>)}
      </div>
      <div className="mt-7 flex min-h-24 flex-wrap justify-center gap-3" aria-label="Rolled dice">
        {view.dice.length === 0 && <p className="self-center text-white/45">{view.diceRemaining} dice ready</p>}
        {view.dice.map((die, index) => <button key={index} type="button" disabled={disabled || !view.canAct || !selectable.has(index)} aria-pressed={selected.includes(index)} onClick={() => toggle(index)} aria-label={`Die ${index + 1}: ${die}${selectable.has(index) ? ', scores' : ', does not score'}`} className={`flex h-16 w-16 items-center justify-center border text-3xl font-black ${selected.includes(index) ? 'border-[#ff9f52] bg-[#ff9f52] text-[#2d2017]' : 'border-white/15 bg-[#f5f1e7] text-[#29231e]'} disabled:opacity-45`}>{die}</button>)}
      </div>
      <div className="mt-5 text-center"><p className="text-xs font-bold text-white/45">TURN SCORE</p><p className="text-4xl font-black text-[#ff9f52]">{view.turnScore}</p></div>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {view.phase === 'rolling' ? <Button disabled={disabled || !view.canAct} onClick={() => onAction({ type: 'roll_farkle' })}>Roll {view.diceRemaining}</Button> : <Button disabled={disabled || selected.length === 0} onClick={() => onAction({ type: 'select_dice', indices: selected })}>Keep scoring dice</Button>}
        <Button variant="secondary" disabled={disabled || !view.canBank} onClick={() => onAction({ type: 'bank_farkle' })}>Bank</Button>
      </div>
      <p className="mt-4 text-center text-sm text-white/55">{view.lastEvent}</p>
      {view.finalTriggerId && <p className="mt-1 text-center text-sm font-bold text-[#ff9f52]">Final round: {view.finalTurnsRemaining} turns remain</p>}
    </div>
  );
}