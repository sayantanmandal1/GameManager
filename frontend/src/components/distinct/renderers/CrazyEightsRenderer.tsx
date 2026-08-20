'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CARD_SUITS, type CardSuit, type CrazyEightsAction, type CrazyEightsPlayerView } from '@/shared';

interface Props { view: CrazyEightsPlayerView; disabled: boolean; onAction: (action: CrazyEightsAction) => void }

export function CrazyEightsRenderer({ view, disabled, onAction }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chosenSuit, setChosenSuit] = useState<CardSuit>('clubs');
  useEffect(() => setSelectedId(null), [view.currentTurnId, view.yourHand.length]);
  const selected = view.yourHand.find((card) => card.id === selectedId);
  const play = () => {
    if (!selected) return;
    onAction(selected.rank === '8' ? { type: 'play_card', cardId: selected.id, chosenSuit } : { type: 'play_card', cardId: selected.id });
  };
  const cardTone = (suit: CardSuit) => suit === 'hearts' || suit === 'diamonds' ? 'text-[#c63f37]' : 'text-[#1b211d]';
  return (
    <div className="w-full max-w-[48rem]">
      <div className="flex items-center justify-center gap-8">
        <div className={`flex h-32 w-20 flex-col justify-between border bg-[#f5f1e7] p-3 text-2xl font-black shadow-xl ${cardTone(view.topCard.suit)}`} aria-label={`Top card ${view.topCard.rank} of ${view.topCard.suit}`}><span>{view.topCard.rank}</span><span className="text-xs uppercase">{view.topCard.suit}</span></div>
        <div><p className="text-xs font-bold text-white/50">ACTIVE SUIT</p><p className="mt-1 text-xl font-black capitalize text-white">{view.activeSuit}</p><p className="mt-3 text-sm text-white/50">Draw pile {view.drawPileCount}</p></div>
      </div>
      <div className="mt-7 flex min-h-32 flex-wrap justify-center gap-2" aria-label="Your hand">
        {view.yourHand.map((card) => {
          const legal = view.legalCardIds.includes(card.id);
          return <button key={card.id} type="button" disabled={disabled || !view.canAct || !legal} aria-pressed={selectedId === card.id} onClick={() => setSelectedId(card.id)} aria-label={`${card.rank} of ${card.suit}`} className={`flex h-28 w-[4.5rem] flex-col justify-between border bg-[#f5f1e7] p-2 text-left font-black shadow-lg ${cardTone(card.suit)} ${selectedId === card.id ? 'outline outline-4 outline-[#ff7468]' : ''} disabled:opacity-45`}><span>{card.rank}</span><span className="text-xs uppercase">{card.suit}</span></button>;
        })}
      </div>
      {selected?.rank === '8' && <div className="mt-4 flex flex-wrap justify-center gap-2" role="group" aria-label="Suit chosen by eight">{CARD_SUITS.map((suit) => <button key={suit} type="button" aria-pressed={chosenSuit === suit} onClick={() => setChosenSuit(suit)} className={`min-h-10 border px-3 text-sm font-bold capitalize ${chosenSuit === suit ? 'border-[#ff7468] bg-[#ff7468] text-[#2a1818]' : 'border-white/15 text-white'}`}>{suit}</button>)}</div>}
      <div className="mt-5 flex justify-center gap-3">
        <Button disabled={disabled || !selected} onClick={play}>Play card</Button>
        <Button variant="secondary" disabled={disabled || !view.canDraw} onClick={() => onAction({ type: 'draw_card' })}>Draw</Button>
      </div>
    </div>
  );
}