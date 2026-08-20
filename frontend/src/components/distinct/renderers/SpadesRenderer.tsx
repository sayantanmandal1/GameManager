'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { SpadesAction, SpadesPlayerView } from '@/shared';
import { CardTable, PlayingCardHand } from './CardTable';
import { CardFace } from './CardFace';

interface Props { view: SpadesPlayerView; disabled: boolean; onAction: (action: SpadesAction) => void }

export function SpadesRenderer({ view, disabled, onAction }: Readonly<Props>) {
  const [bid, setBid] = useState(3);
  const name = (id: string) => view.players.find((player) => player.id === id)?.name ?? 'Player';
  const tablePlayers = view.players.map((player) => ({
    id: player.id,
    name: player.name,
    handCount: player.handCount,
    detail: `Team ${player.team + 1} · bid ${player.bid ?? '—'} · ${player.tricksWon} tricks`,
  }));
  return (
    <div className="w-full max-w-[72rem]">
      <CardTable
        players={tablePlayers}
        youId={view.youId}
        currentTurnId={view.currentTurnId}
        topRail={(
          <div className="flex gap-2" aria-label="Team scores">
            {[0, 1].map((team) => (
              <div key={team} className="min-w-28 rounded-full border border-white/15 bg-[#0c2b23]/95 px-3 py-1 text-center shadow-lg">
                <p className="text-[9px] font-bold uppercase text-white/45">Team {team + 1}</p>
                <p className="text-sm font-black">{view.teamScores[team]} <span className="text-[9px] text-white/45">· {view.teamBags[team]} bags</span></p>
              </div>
            ))}
          </div>
        )}
        center={view.phase === 'bidding' ? (
          <div className="rounded-xl border border-white/12 bg-[#0c2b23]/95 p-4 text-center shadow-xl">
            <p className="text-xs font-bold uppercase text-white/50">Contract bidding</p>
            <p className="mt-1 text-sm text-white/60">{view.players.map((player) => `${player.name} ${player.bid ?? '—'}`).join(' · ')}</p>
            {view.canAct && <div className="mt-3 flex items-end justify-center gap-3"><label className="text-xs text-white/60">Your bid<input aria-label="Your bid" type="number" min={0} max={13} value={bid} onChange={(event) => setBid(Math.max(0, Math.min(13, Number(event.target.value))))} className="mt-1 block min-h-10 w-20 rounded border border-white/15 bg-black/25 px-3 text-white" /></label><Button disabled={disabled} onClick={() => onAction({ type: 'bid_spades', bid })}>Lock bid</Button></div>}
          </div>
        ) : (
          <div className="flex min-h-28 flex-wrap items-center justify-center gap-2" aria-label="Current trick">
            {view.trick.map((entry) => <div key={`${entry.playerId}-${entry.card.id}`} className="text-center"><CardFace card={entry.card} size="mini" /><p className="mt-1 max-w-14 truncate text-[10px] text-white/50">{name(entry.playerId)}</p></div>)}
            {view.trick.length === 0 && <p className="text-xs text-white/40">Awaiting lead</p>}
          </div>
        )}
        hand={(
          <PlayingCardHand
            cards={view.yourHand}
            legalCardIds={view.legalCardIds}
            active={view.phase === 'playing' && view.canAct}
            disabled={disabled}
            onPlay={(cardId) => onAction({ type: 'play_card', cardId })}
          />
        )}
        bottomRail={<p className="text-[11px] font-bold uppercase text-white/50">Round {view.roundNumber} · Spades {view.spadesBroken ? 'broken' : 'unbroken'}</p>}
      />
    </div>
  );
}