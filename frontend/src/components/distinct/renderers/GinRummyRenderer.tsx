'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { GinRummyAction, GinRummyPlayerView } from '@/shared';
import { CardFace } from './CardFace';

interface Props { view: GinRummyPlayerView; disabled: boolean; onAction: (action: GinRummyAction) => void }

export function GinRummyRenderer({ view, disabled, onAction }: Readonly<Props>) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedLegalId = selectedId && view.legalDiscardIds.includes(selectedId) ? selectedId : null;
  const discard = (knock: boolean) => selectedLegalId && onAction({ type: 'gin_discard', cardId: selectedLegalId, knock });
  const lastRoundLabel = view.lastRound?.gin ? 'gin' : view.lastRound?.undercut ? 'undercut' : 'knock';
  return (
    <div className="w-full max-w-[54rem]">
      <div className="grid gap-2 sm:grid-cols-2">{view.players.map((player) => <div key={player.id} className="flex justify-between border-b border-white/12 px-3 py-2"><span className="font-bold">{player.name}</span><span className="text-sm text-white/55">{player.score} points · {player.handCount} cards</span></div>)}</div>
      <div className="mt-6 flex items-center justify-center gap-8"><div className="text-center"><div className="flex h-24 w-16 items-center justify-center border border-white/15 bg-[#27362f] text-2xl font-black">{view.stockCount}</div><p className="mt-1 text-xs text-white/45">STOCK</p></div>{view.topDiscard ? <CardFace card={view.topDiscard} label={`Top discard ${view.topDiscard.rank} of ${view.topDiscard.suit}`} /> : <span className="flex h-24 w-16 items-center justify-center border border-white/15 text-xs text-white/35">Empty</span>}</div>
      {view.phase === 'drawing' && view.canAct && <div className="mt-5 flex justify-center gap-3"><Button disabled={disabled || !view.canDrawStock} onClick={() => onAction({ type: 'gin_draw', source: 'stock' })}>Draw stock</Button><Button variant="secondary" disabled={disabled || !view.canDrawDiscard} onClick={() => onAction({ type: 'gin_draw', source: 'discard' })}>Take discard</Button></div>}
      <div className="mt-6 flex min-h-28 flex-wrap justify-center gap-2" aria-label="Your private hand">{view.yourHand.map((card) => <CardFace key={card.id} card={card} selected={selectedId === card.id} disabled={disabled || view.phase !== 'discarding' || !view.legalDiscardIds.includes(card.id)} onClick={() => setSelectedId(card.id)} />)}</div>
      <p className="mt-3 text-center text-sm text-white/55">Deadwood {view.yourAnalysis.deadwoodValue} · {view.yourAnalysis.melds.length} melds</p>
      {view.phase === 'discarding' && view.canAct && <div className="mt-5 flex justify-center gap-3"><Button disabled={disabled || !selectedLegalId} onClick={() => discard(false)}>Discard</Button><Button variant="secondary" disabled={disabled || !selectedLegalId || !view.canKnock} onClick={() => discard(true)}>Knock</Button></div>}
      {view.lastRound && <p className="mt-4 text-center text-sm text-white/55">Last round: {lastRoundLabel} for {view.lastRound.points}</p>}
    </div>
  );
}