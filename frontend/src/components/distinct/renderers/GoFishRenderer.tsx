'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { CardRank, GoFishAction, GoFishPlayerView } from '@/shared';

interface Props { view: GoFishPlayerView; disabled: boolean; onAction: (action: GoFishAction) => void }

export function GoFishRenderer({ view, disabled, onAction }: Props) {
  const [rank, setRank] = useState<CardRank | ''>('');
  const [target, setTarget] = useState('');
  const selectedRank = view.legalRanks.includes(rank as CardRank) ? rank as CardRank : view.legalRanks[0];
  const selectedTarget = view.legalTargets.includes(target) ? target : view.legalTargets[0];
  return (
    <div className="w-full max-w-[48rem]">
      <div className="grid gap-2 sm:grid-cols-2">
        {view.players.map((player) => <div key={player.id} className="flex items-center justify-between border-b border-white/12 px-3 py-2"><span className="truncate font-semibold">{player.name}</span><span className="text-sm text-white/60">{player.handCount} cards / {player.books.length} books</span></div>)}
      </div>
      <div className="mt-6 flex min-h-28 flex-wrap justify-center gap-2" aria-label="Your hand">
        {view.yourHand.map((card) => <span key={card.id} className={`flex h-24 w-16 flex-col justify-between border bg-[#f5f1e7] p-2 font-black shadow-lg ${card.suit === 'hearts' || card.suit === 'diamonds' ? 'text-[#c63f37]' : 'text-[#1a211d]'}`}><span>{card.rank}</span><span className="text-xs uppercase">{card.suit[0]}</span></span>)}
      </div>
      {view.canAct && (
        <div className="mx-auto mt-6 grid max-w-xl gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className="text-sm text-white/60">Player<select value={selectedTarget ?? ''} onChange={(event) => setTarget(event.target.value)} className="mt-1 min-h-11 w-full border border-white/15 bg-black/25 px-3 text-white">{view.legalTargets.map((id) => <option key={id} value={id}>{view.players.find((player) => player.id === id)?.name}</option>)}</select></label>
          <label className="text-sm text-white/60">Rank<select value={selectedRank ?? ''} onChange={(event) => setRank(event.target.value as CardRank)} className="mt-1 min-h-11 w-full border border-white/15 bg-black/25 px-3 text-white">{view.legalRanks.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <Button className="self-end" disabled={disabled || !selectedRank || !selectedTarget} onClick={() => selectedRank && selectedTarget && onAction({ type: 'ask', targetPlayerId: selectedTarget, rank: selectedRank })}>Ask</Button>
        </div>
      )}
      <p className="mt-4 text-center text-sm text-white/55">Pond: {view.deckCount} cards</p>
    </div>
  );
}