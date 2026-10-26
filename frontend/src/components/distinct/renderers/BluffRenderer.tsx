'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CARD_RANKS, type CardRank, type BluffAction, type BluffPlayerView } from '@/shared';
import { CardFace } from './CardFace';

interface Props {
  readonly view: BluffPlayerView;
  readonly disabled: boolean;
  readonly onAction: (action: BluffAction) => void;
}

export function BluffRenderer({ view, disabled, onAction }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [chosenRank, setChosenRank] = useState<CardRank>('A');
  useEffect(() => setSelectedIds([]), [view.currentTurnId, view.phase, view.yourHand, view.claimRank]);
  const rank = view.claimRank ?? chosenRank;
  const name = (id: string) => view.players.find((player) => player.id === id)?.name ?? 'Player';
  const toggle = (cardId: string) => setSelectedIds((current) => {
    if (current.includes(cardId)) return current.filter((id) => id !== cardId);
    return current.length < 4 ? [...current, cardId] : current;
  });

  return (
    <div className="w-full max-w-[54rem] space-y-5">
      <div className="premium-panel grid grid-cols-3 divide-x divide-white/10 py-4 text-center">
        <div className="px-2"><p className="eyebrow">Round rank</p><p className="mt-2 text-3xl font-semibold">{view.claimRank ?? 'Any'}</p></div>
        <div className="px-2"><p className="eyebrow">On the table</p><p className="mt-2 text-3xl font-semibold">{view.pileCount}</p></div>
        <div className="px-2"><p className="eyebrow">Cleared away</p><p className="mt-2 text-3xl font-semibold">{view.discardedCount}</p></div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{view.players.map((player) => <div key={player.id} className={`rounded-2xl border px-3 py-3 ${player.id === view.currentTurnId ? 'border-game-blue/40 bg-game-blue/10' : 'border-white/10 bg-white/[0.025]'}`}><p className="truncate text-sm font-semibold">{player.name}</p><p className="mt-1 text-xs text-game-muted">{player.handCount} cards{player.id === view.youId ? ' · You' : ''}</p></div>)}</div>
      {view.pendingClaim && (
        <div className="premium-panel px-4 py-5 text-center" aria-live="polite">
          <p className="eyebrow">{view.phase === 'challenge' ? 'Final claim · last chance to challenge' : 'Latest claim'}</p>
          <p className="mt-2 text-xl font-semibold">{name(view.pendingClaim.playerId)} · {view.pendingClaim.count} × {view.pendingClaim.rank}</p>
          <p className="mt-2 text-sm text-game-muted">{view.phase === 'challenge' ? 'Every opponent must let it stand, or call the bluff, before a winner is declared.' : `${view.consecutivePasses} consecutive passes · ${view.players.length} clears the pile`}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {view.canAccept && <Button variant="secondary" disabled={disabled} onClick={() => onAction({ type: 'bluff_accept' })}>Let it stand</Button>}
            {view.canChallenge && <Button disabled={disabled} onClick={() => onAction({ type: 'bluff_challenge' })}>Call bluff</Button>}
          </div>
        </div>
      )}
      {view.lastReveal && (
        <div className="premium-panel p-4 text-center" aria-live="polite">
          <p className={`font-bold ${view.lastReveal.truthful ? 'text-emerald-200' : 'text-red-200'}`}>{view.lastReveal.truthful ? 'Claim was true' : 'Bluff caught'} · {name(view.lastReveal.collectorId)} took the pile</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">{view.lastReveal.cards.map((card) => <CardFace key={card.id} card={card} />)}</div>
        </div>
      )}
      <section className="premium-panel p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-semibold">Your hand</h2><p className="mt-1 text-xs text-game-muted">Sorted by rank · select up to four cards</p></div>
        {view.canClaim && !view.claimRank && <label className="flex items-center gap-3 text-sm text-game-muted">Claim rank<select aria-label="Claim rank" className="min-h-11 rounded-xl border border-game-border bg-game-bg px-3 text-game-text" value={chosenRank} disabled={disabled} onChange={(event) => { const next = CARD_RANKS.find((value) => value === event.target.value); if (next) setChosenRank(next); }}>{CARD_RANKS.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>}
      </div>
      <div className="flex min-h-28 flex-wrap justify-center gap-3 py-2" aria-label="Your private hand">
        {view.yourHand.map((card) => <CardFace key={card.id} card={card} selected={selectedIds.includes(card.id)} disabled={disabled || !view.canClaim} onClick={view.canClaim ? () => toggle(card.id) : undefined} />)}
      </div>
      {view.canClaim && <div className="mt-5 flex flex-wrap justify-center gap-3"><Button disabled={disabled || selectedIds.length === 0} onClick={() => onAction({ type: 'bluff_play', cardIds: selectedIds, rank })}>Claim {selectedIds.length || '—'} × {rank}</Button>{view.canPass && <Button variant="secondary" disabled={disabled} onClick={() => onAction({ type: 'bluff_pass' })}>Pass</Button>}</div>}
      </section>
      <details className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-game-muted">
        <summary className="cursor-pointer py-1 font-semibold text-game-text">How this table plays</summary>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>The opening player chooses any rank. Everyone claims that same rank until the round ends; the cards can be anything.</li>
          <li>Play one to four cards or pass. Passing skips only this turn. A new play resets the pass count, including when the last claimant plays again.</li>
          <li>Anyone except the latest claimant can call bluff before the next play or pile clearance. Only the latest cards are revealed; the liar or incorrect challenger takes the entire table pile.</li>
          <li>The challenge winner starts a new rank. If everyone passes consecutively, the pile is cleared out of play and the player after the last claimant starts.</li>
          <li>A final claim must survive a challenge or be accepted by every opponent before winning.</li>
        </ul>
      </details>
    </div>
  );
}