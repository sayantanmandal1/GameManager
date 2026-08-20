'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { CardSuit, EuchreAction, EuchrePlayerView } from '@/shared';
import { CardTable, PlayingCardHand } from './CardTable';
import { CardFace } from './CardFace';

interface Props {
  readonly view: EuchrePlayerView;
  readonly disabled: boolean;
  readonly onAction: (action: EuchreAction) => void;
}

const SUIT_LABEL: Record<CardSuit, string> = { clubs: '♣ Clubs', diamonds: '♦ Diamonds', hearts: '♥ Hearts', spades: '♠ Spades' };

export function EuchreRenderer({ view, disabled, onAction }: Props) {
  const [alone, setAlone] = useState(false);
  const name = (id: string | null) => view.players.find((player) => player.id === id)?.name ?? '—';
  const playing = view.phase === 'playing';
  const discarding = view.phase === 'dealer_discard';
  const tablePlayers = view.players.map((player) => ({
    id: player.id,
    name: player.name,
    handCount: player.handCount,
    detail: `Team ${player.team + 1}${player.sittingOut ? ' · sitting out' : ''}`,
  }));
  const handActive = (playing && view.canAct) || (discarding && view.canDiscard);
  const handLegalIds = discarding && view.canDiscard
    ? view.yourHand.map((card) => card.id)
    : view.legalCardIds;
  const playFromHand = (cardId: string) => {
    if (discarding) onAction({ type: 'euchre_discard', cardId });
    else onAction({ type: 'play_euchre_card', cardId });
  };
  let tableCenter = (
    <div className="text-center">
      <div className="mb-2 flex items-center justify-center gap-3"><span className="text-[10px] font-bold uppercase text-white/45">Upcard</span><CardFace card={view.upcard} size="mini" /></div>
      {discarding && <p className="text-xs text-white/65">Dealer chooses one card to discard</p>}
      {playing && <div className="flex min-h-20 flex-wrap justify-center gap-2" aria-label="Current trick">{view.trick.map((entry) => <div key={`${entry.playerId}-${entry.card.id}`} className="text-center"><CardFace card={entry.card} size="mini" /><p className="mt-1 max-w-14 truncate text-[10px] text-white/45">{name(entry.playerId)}</p></div>)}{view.trick.length === 0 && <p className="self-center text-xs text-white/40">Awaiting lead</p>}</div>}
    </div>
  );
  if (view.phase === 'hand_complete' && view.lastHand) {
    tableCenter = <div className="rounded-xl border border-white/12 bg-[#0c2b23]/95 p-4 text-center shadow-xl"><p className="font-bold">{name(view.lastHand.makerId)} made {view.lastHand.tricks[view.lastHand.makerTeam]} tricks · {view.lastHand.points[0]}–{view.lastHand.points[1]} points</p>{view.canAct && <Button className="mt-3" disabled={disabled} onClick={() => onAction({ type: 'next_euchre_hand' })}>Next hand</Button>}</div>;
  } else if (view.phase === 'bidding') {
    tableCenter = (
      <div className="rounded-xl border border-white/12 bg-[#0c2b23]/95 p-3 text-center shadow-xl">
        <div className="flex items-center justify-center gap-3"><span className="text-[10px] font-bold uppercase text-white/45">Upcard</span><CardFace card={view.upcard} size="mini" /></div>
        {view.canAct && <>
          <label className="inline-flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={alone} onChange={(event) => setAlone(event.target.checked)} /> Go alone</label>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button variant="secondary" disabled={disabled || !view.canPass} onClick={() => onAction({ type: 'euchre_call', euchreCall: { type: 'pass' } })}>Pass</Button>
            {view.canOrderUp && <Button disabled={disabled} onClick={() => onAction({ type: 'euchre_call', euchreCall: { type: 'order_up', alone } })}>Order {SUIT_LABEL[view.upcard.suit]}</Button>}
            {view.legalTrumpSuits.map((suit) => <Button key={suit} disabled={disabled} onClick={() => onAction({ type: 'euchre_call', euchreCall: { type: 'name_trump', suit, alone } })}>{SUIT_LABEL[suit]}</Button>)}
          </div>
        </>}
      </div>
    );
  }
  return (
    <div className="w-full max-w-[72rem]">
      <CardTable
        players={tablePlayers}
        youId={view.youId}
        currentTurnId={view.currentTurnId}
        topRail={<div className="flex gap-2"><Team label="Team 1" score={view.teamScores[0]} tricks={view.tricksWon[0]} /><Team label="Team 2" score={view.teamScores[1]} tricks={view.tricksWon[1]} /></div>}
        center={tableCenter}
        hand={<PlayingCardHand cards={view.yourHand} legalCardIds={handLegalIds} active={handActive} disabled={disabled} onPlay={playFromHand} />}
        bottomRail={<div className="flex flex-wrap justify-center gap-3 text-[10px] font-bold uppercase text-white/50"><span>Hand {view.handNumber}</span><span>Dealer {name(view.dealerId)}</span><span>{view.trumpSuit ? `Trump ${SUIT_LABEL[view.trumpSuit]}` : `Bidding round ${view.biddingRound}`}</span>{view.alone && <span className="text-[#e8c663]">Lone hand</span>}</div>}
      />
    </div>
  );
}

function Team({ label, score, tricks }: Readonly<{ label: string; score: number; tricks: number }>) {
  return <div className="min-w-24 rounded-full border border-white/15 bg-[#0c2b23]/95 px-3 py-1 text-center shadow-lg"><p className="text-[9px] font-bold uppercase text-white/45">{label}</p><p className="text-sm font-black">{score} <span className="text-[9px] text-white/45">· {tricks} tricks</span></p></div>;
}