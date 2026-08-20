'use client';

import { Button } from '@/components/ui/Button';
import type { OldMaidAction, OldMaidPlayerView } from '@/shared';
import { CardFace } from './CardFace';

interface Props { view: OldMaidPlayerView; disabled: boolean; onAction: (action: OldMaidAction) => void }

export function OldMaidRenderer({ view, disabled, onAction }: Readonly<Props>) {
  const target = view.players.find((player) => player.id === view.targetPlayerId);
  return (
    <div className="w-full max-w-[52rem]">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{view.players.map((player) => <div key={player.id} className="border-b border-white/10 px-3 py-2"><span className="font-bold">{player.name}</span><p className="text-xs text-white/50">{player.handCount} cards{player.safeRank ? ` · safe #${player.safeRank}` : ''}</p></div>)}</div>
      {view.canAct && view.targetPlayerId && <div className="mt-7 text-center"><p className="mb-3 text-sm text-white/55">Draw from {target?.name}</p><div className="flex flex-wrap justify-center gap-2" aria-label={`${target?.name} hidden hand`}>{Array.from({ length: view.targetHandCount }, (_, index) => <button key={index} type="button" disabled={disabled} onClick={() => onAction({ type: 'draw_from_player', handIndex: index })} aria-label={`Hidden card ${index + 1}`} className="flex h-24 w-16 items-center justify-center border border-[#e7a0c4]/50 bg-[#512b40] text-2xl font-black shadow-lg disabled:opacity-40">?</button>)}</div></div>}
      <div className="mt-7 flex min-h-28 flex-wrap justify-center gap-2" aria-label="Your private hand">{view.yourHand.map((card) => <CardFace key={card.id} card={card} />)}</div>
      <p className="mt-4 text-center text-sm text-white/50">{view.lastEvent}</p>
      {view.phase === 'finished' && <div className="mt-4 flex justify-center"><Button disabled>Round complete</Button></div>}
    </div>
  );
}