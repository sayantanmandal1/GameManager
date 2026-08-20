'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { HeartsAction, HeartsPlayerView } from '@/shared';
import { CardTable, PlayingCardHand } from './CardTable';
import { CardFace } from './CardFace';

interface Props { view: HeartsPlayerView; disabled: boolean; onAction: (action: HeartsAction) => void }

export function HeartsRenderer({ view, disabled, onAction }: Readonly<Props>) {
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => setSelected([]), [view.roundNumber, view.phase]);
  const toggle = (cardId: string) => setSelected((current) => {
    if (current.includes(cardId)) return current.filter((id) => id !== cardId);
    return current.length < 3 ? [...current, cardId] : current;
  });
  const canPlay = view.phase === 'playing' && view.canAct;
  const canSelectPass = view.phase === 'passing' && view.canAct;
  const name = (id: string) => view.players.find((player) => player.id === id)?.name ?? 'Player';
  const tablePlayers = view.players.map((player) => ({
    id: player.id,
    name: player.name,
    handCount: player.handCount,
    detail: `${player.score} pts · ${player.roundPoints} this round${player.passed ? ' · ready' : ''}`,
  }));
  const legalIds = canPlay
    ? view.legalCardIds
    : canSelectPass
      ? view.yourHand.map((card) => card.id)
      : [];
  return (
    <div className="w-full max-w-[72rem]">
      <CardTable
        players={tablePlayers}
        youId={view.youId}
        currentTurnId={view.currentTurnId}
        topRail={(
          <div className="rounded-full border border-white/15 bg-[#0c2b23]/95 px-4 py-1 text-center shadow-lg" aria-label="Hearts scores">
            <p className="text-[9px] font-bold uppercase text-white/45">Round {view.roundNumber}</p>
            <p className="text-xs font-black">{view.players.map((player) => `${player.name} ${player.score}`).join(' · ')}</p>
          </div>
        )}
        center={view.phase === 'passing' ? (
          <div className="rounded-xl border border-white/12 bg-[#0c2b23]/95 p-4 text-center shadow-xl">
            <p className="text-xs font-bold uppercase text-white/50">Pass {view.passDirection}</p>
            <p className="mt-1 text-sm text-white/65">Choose exactly three cards</p>
            <Button className="mt-3" disabled={disabled || !view.canAct || selected.length !== 3} onClick={() => onAction({ type: 'pass_cards', cardIds: selected })}>Pass selected cards</Button>
          </div>
        ) : (
          <div className="flex min-h-24 flex-wrap items-center justify-center gap-2" aria-label="Current trick">
            {view.trick.map((entry) => <div key={`${entry.playerId}-${entry.card.id}`} className="text-center"><CardFace card={entry.card} size="mini" label={`${name(entry.playerId)} played ${entry.card.rank} of ${entry.card.suit}`} /><p className="mt-1 max-w-14 truncate text-[10px] text-white/45">{name(entry.playerId)}</p></div>)}
            {view.trick.length === 0 && <p className="text-xs text-white/40">Awaiting lead</p>}
          </div>
        )}
        hand={(
          <PlayingCardHand
            cards={view.yourHand}
            legalCardIds={legalIds}
            selectedCardIds={selected}
            active={canPlay || canSelectPass}
            disabled={disabled}
            onPlay={(cardId) => canPlay ? onAction({ type: 'play_card', cardId }) : toggle(cardId)}
          />
        )}
        bottomRail={<p className="text-[10px] font-bold uppercase text-white/50">Round {view.roundNumber} · {view.passDirection} pass · Hearts {view.heartsBroken ? 'broken' : 'unbroken'}</p>}
      />
    </div>
  );
}