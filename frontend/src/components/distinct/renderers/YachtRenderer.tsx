'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { YACHT_CATEGORIES, type YachtAction, type YachtCategory, type YachtPlayerView } from '@/shared';

const LABELS: Record<YachtCategory, string> = {
  ones: 'Ones', twos: 'Twos', threes: 'Threes', fours: 'Fours', fives: 'Fives', sixes: 'Sixes',
  three_kind: 'Three of a kind', four_kind: 'Four of a kind', full_house: 'Full house',
  small_straight: 'Small straight', large_straight: 'Large straight', yacht: 'Yacht', chance: 'Chance',
};

interface Props { view: YachtPlayerView; disabled: boolean; onAction: (action: YachtAction) => void }

export function YachtRenderer({ view, disabled, onAction }: Props) {
  const [held, setHeld] = useState<number[]>([]);
  const freshTurn = view.rollsUsed === 0;
  useEffect(() => setHeld([]), [view.currentTurnId, freshTurn]);
  const toggleHeld = (index: number) => setHeld((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index]);
  const yourCard = view.scorecards[view.youId];
  return (
    <div className="grid w-full max-w-[52rem] gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section>
        <div className="grid min-h-24 grid-cols-5 gap-2" aria-label="Five dice">
          {Array.from({ length: 5 }, (_, index) => {
            const die = view.dice[index];
            const isHeld = held.includes(index);
            return <button key={index} type="button" disabled={disabled || !view.canAct || !die || view.rollsUsed >= 3} aria-pressed={isHeld} onClick={() => toggleHeld(index)} aria-label={die ? `Die ${index + 1}: ${die}${isHeld ? ', held' : ''}` : `Die ${index + 1}: not rolled`} className={`flex aspect-square items-center justify-center border text-3xl font-black sm:text-5xl ${isHeld ? 'border-[#f0d567] bg-[#f0d567] text-[#262615]' : 'border-white/15 bg-[#f5f1e7] text-[#22251f]'} disabled:cursor-default`}>{die ?? '?'}</button>;
          })}
        </div>
        <div className="mt-5 flex justify-center">
          <Button disabled={disabled || !view.canAct || view.rollsUsed >= 3} onClick={() => { onAction({ type: 'roll_dice', heldIndices: held }); setHeld([]); }}>{view.rollsUsed === 0 ? 'Roll five dice' : `Roll again (${3 - view.rollsUsed} left)`}</Button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Score categories">
          {YACHT_CATEGORIES.map((category) => {
            const used = yourCard?.[category];
            const possible = view.possibleScores[category];
            return <button key={category} type="button" disabled={disabled || !view.canAct || possible === undefined || used !== null} onClick={() => onAction({ type: 'score_category', category })} className="min-h-14 border border-white/12 bg-white/5 px-2 py-2 text-left disabled:opacity-50"><span className="block text-xs font-bold text-white/60">{LABELS[category]}</span><span className="text-xl font-black text-white">{used ?? possible ?? '-'}</span></button>;
          })}
        </div>
      </section>
      <aside className="border-l border-white/10 pl-4">
        <h2 className="text-sm font-bold text-white/60">TOTALS</h2>
        {view.players.map((player) => <div key={player.id} className="flex justify-between border-b border-white/10 py-3"><span className="truncate">{player.name}</span><strong>{view.totals[player.id]}</strong></div>)}
      </aside>
    </div>
  );
}