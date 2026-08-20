'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { BluffAction, BluffPlayerView } from '@/shared';
import { CardFace } from './CardFace';

interface Props {
  readonly view: BluffPlayerView;
  readonly disabled: boolean;
  readonly onAction: (action: BluffAction) => void;
}

export function BluffRenderer({ view, disabled, onAction }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  useEffect(() => setSelectedIds([]), [view.currentTurnId, view.phase, view.yourHand.length]);
  const name = (id: string) => view.players.find((player) => player.id === id)?.name ?? 'Player';
  const toggle = (cardId: string) => setSelectedIds((current) => {
    if (current.includes(cardId)) return current.filter((id) => id !== cardId);
    return current.length < 4 ? [...current, cardId] : current;
  });

  return (
    <div className="w-full max-w-[54rem]">
      <div className="grid grid-cols-2 border-y border-white/12 text-center">
        <div className="px-3 py-4"><p className="text-xs uppercase text-white/40">Required claim</p><p className="text-3xl font-black">{view.claimRank}</p></div>
        <div className="px-3 py-4"><p className="text-xs uppercase text-white/40">Face-down pile</p><p className="text-3xl font-black">{view.pileCount}</p></div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{view.players.map((player) => <div key={player.id} className="border-b border-white/10 px-2 py-2"><p className="font-bold">{player.name}</p><p className="text-xs text-white/45">{player.handCount} cards</p></div>)}</div>
      {view.pendingClaim && (
        <div className="mt-6 border-y border-white/12 py-5 text-center">
          <p className="text-xs uppercase text-white/45">Pending claim</p>
          <p className="mt-1 text-xl font-black">{name(view.pendingClaim.playerId)} · {view.pendingClaim.count} × {view.pendingClaim.rank}</p>
          <div className="mt-3 flex justify-center gap-2">
            {view.canAccept && <Button variant="secondary" disabled={disabled} onClick={() => onAction({ type: 'bluff_accept' })}>Accept</Button>}
            {view.canChallenge && <Button disabled={disabled} onClick={() => onAction({ type: 'bluff_challenge' })}>I doubt it</Button>}
          </div>
        </div>
      )}
      {view.lastReveal && (
        <div className="mt-5 text-center">
          <p className={`font-bold ${view.lastReveal.truthful ? 'text-emerald-200' : 'text-red-200'}`}>{view.lastReveal.truthful ? 'Claim was true' : 'Bluff caught'} · {name(view.lastReveal.collectorId)} took the pile</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">{view.lastReveal.cards.map((card) => <CardFace key={card.id} card={card} />)}</div>
        </div>
      )}
      <div className="mt-6 flex min-h-28 flex-wrap justify-center gap-2" aria-label="Your private hand">
        {view.yourHand.map((card) => <CardFace key={card.id} card={card} selected={selectedIds.includes(card.id)} disabled={disabled || !view.canClaim} onClick={view.canClaim ? () => toggle(card.id) : undefined} />)}
      </div>
      {view.canClaim && <div className="mt-4 text-center"><Button disabled={disabled || selectedIds.length === 0} onClick={() => onAction({ type: 'bluff_play', cardIds: selectedIds })}>Claim {selectedIds.length || '—'} × {view.claimRank}</Button></div>}
    </div>
  );
}