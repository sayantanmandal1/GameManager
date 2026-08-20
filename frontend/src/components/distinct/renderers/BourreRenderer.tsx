'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { BourreAction, BourrePlayerView } from '@/shared';
import { CardFace } from './CardFace';

interface Props {
  readonly view: BourrePlayerView;
  readonly disabled: boolean;
  readonly onAction: (action: BourreAction) => void;
}

export function BourreRenderer({ view, disabled, onAction }: Props) {
  const [discardIds, setDiscardIds] = useState<string[]>([]);
  useEffect(() => setDiscardIds([]), [view.handNumber, view.phase, view.currentTurnId]);
  const name = (id: string | null) => view.players.find((player) => player.id === id)?.name ?? '—';
  const toggleDiscard = (cardId: string) => setDiscardIds((current) =>
    current.includes(cardId) ? current.filter((id) => id !== cardId) : [...current, cardId]);

  return (
    <div className="w-full max-w-[56rem]">
      <div className="grid grid-cols-3 border-y border-white/12 text-center">
        <Stat label="Hand" value={String(view.handNumber)} />
        <Stat label="Pot" value={String(view.pot)} />
        <Stat label="Trump" value={view.trumpSuit.toUpperCase()} />
      </div>
      <div className="mt-3 flex items-center justify-center gap-3 text-sm text-white/55">
        <span>Dealer {name(view.dealerId)}</span>
        <CardFace card={view.trumpCard} label={`Trump card ${view.trumpCard.rank} of ${view.trumpCard.suit}`} />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {view.players.map((player) => (
          <div key={player.id} className="border-b border-white/12 px-2 py-2">
            <p className="font-bold">{player.name}{player.id === view.youId ? ' (you)' : ''}</p>
            <p className="text-xs text-white/50">{player.score} pts · {player.tricksWon} tricks · {player.decision}</p>
          </div>
        ))}
      </div>
      {view.phase === 'playing' && (
        <div className="mt-6 min-h-28 border-y border-white/12 py-4">
          <p className="mb-3 text-center text-xs font-bold uppercase text-white/45">Current trick</p>
          <div className="flex flex-wrap justify-center gap-3">
            {view.trick.map((entry) => <div key={`${entry.playerId}-${entry.card.id}`} className="text-center"><CardFace card={entry.card} /><p className="mt-1 text-xs text-white/45">{name(entry.playerId)}</p></div>)}
          </div>
        </div>
      )}
      <div className="mt-6 flex min-h-28 flex-wrap justify-center gap-2" aria-label="Your private hand">
        {view.yourHand.map((card) => {
          const deciding = view.phase === 'deciding' && view.canAct;
          const playable = view.phase === 'playing' && view.canAct && view.legalCardIds.includes(card.id);
          let onClick: (() => void) | undefined;
          if (deciding) onClick = () => toggleDiscard(card.id);
          else if (playable) onClick = () => onAction({ type: 'play_bourre_card', cardId: card.id });
          return <CardFace key={card.id} card={card} selected={discardIds.includes(card.id)} disabled={disabled || (!deciding && !playable)} onClick={onClick} />;
        })}
      </div>
      {view.phase === 'deciding' && view.canAct && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button disabled={disabled} onClick={() => onAction({ type: 'bourre_decide', play: true, discardIds })}>Stay · redraw {discardIds.length}</Button>
          <Button variant="secondary" disabled={disabled || !view.canFold} onClick={() => onAction({ type: 'bourre_decide', play: false, discardIds: [] })}>Fold</Button>
        </div>
      )}
      {view.phase === 'hand_complete' && view.lastHand && (
        <div className="mt-5 border-y border-white/12 py-4 text-center">
          <p className="font-bold">{view.lastHand.winnerId ? `${name(view.lastHand.winnerId)} won ${view.lastHand.pot}` : `Split: ${view.lastHand.splitIds.map(name).join(', ')}`}</p>
          {view.lastHand.bourreIds.length > 0 && <p className="mt-1 text-sm text-red-200">Bourré: {view.lastHand.bourreIds.map(name).join(', ')}</p>}
          {view.canAct && <Button className="mt-3" disabled={disabled} onClick={() => onAction({ type: 'next_bourre_hand' })}>Next hand</Button>}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div className="px-2 py-3"><p className="text-xs uppercase text-white/40">{label}</p><p className="mt-1 font-black">{value}</p></div>;
}