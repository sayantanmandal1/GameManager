'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CARD_SUITS, type CardSuit, type CrazyEightsAction, type CrazyEightsPlayerView } from '@/shared';
import { CardFace } from './CardFace';

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
  return (
    <div className="w-full max-w-[48rem]">
      <div className="flex items-center justify-center gap-8">
        <CardFace card={view.topCard} label={`Top card ${view.topCard.rank} of ${view.topCard.suit}`} />
        <div><p className="text-xs font-bold text-white/50">ACTIVE SUIT</p><p className="mt-1 text-xl font-black capitalize text-white">{view.activeSuit}</p><p className="mt-3 text-sm text-white/50">Draw pile {view.drawPileCount}</p></div>
      </div>
      <div className="mt-7 flex min-h-32 flex-wrap justify-center gap-2" aria-label="Your hand">
        {view.yourHand.map((card) => {
          const legal = view.legalCardIds.includes(card.id);
          return <CardFace key={card.id} card={card} disabled={disabled || !view.canAct || !legal} selected={selectedId === card.id} onClick={() => setSelectedId(card.id)} />;
        })}
      </div>
      {selected?.rank === '8' && <div className="mt-4 flex flex-wrap justify-center gap-2" role="group" aria-label="Suit chosen by eight">{CARD_SUITS.map((suit) => <button key={suit} type="button" aria-pressed={chosenSuit === suit} onClick={() => setChosenSuit(suit)} className={`game-choice text-sm capitalize ${chosenSuit === suit ? 'border-game-blue bg-game-blue text-game-bg' : 'text-game-text'}`}>{suit}</button>)}</div>}
      <div className="mt-5 flex justify-center gap-3">
        <Button disabled={disabled || !selected} onClick={play}>Play card</Button>
        <Button variant="secondary" disabled={disabled || !view.canDraw} onClick={() => onAction({ type: 'draw_card' })}>Draw</Button>
      </div>
    </div>
  );
}