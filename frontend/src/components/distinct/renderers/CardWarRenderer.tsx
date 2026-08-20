'use client';

import { Button } from '@/components/ui/Button';
import type { CardWarAction, CardWarPlayerView } from '@/shared';
import { CardFace } from './CardFace';

interface Props { view: CardWarPlayerView; disabled: boolean; onAction: (action: CardWarAction) => void }

export function CardWarRenderer({ view, disabled, onAction }: Props) {
  return (
    <div className="w-full max-w-[46rem] text-center">
      <div className="grid grid-cols-2 gap-4">{view.players.map((player) => <div key={player.id} className="border border-white/12 p-4"><p className="truncate font-bold">{player.name}</p><p className="mt-1 text-3xl font-black text-[#f0b25d]">{player.cardCount}</p><p className="text-xs text-white/45">CARDS</p></div>)}</div>
      {view.lastBattle && <div className="mt-7"><p className="text-sm text-white/50">Battle {view.battleNumber} · {view.lastBattle.potSize} cards in the pot</p><div className="mt-3 grid grid-cols-2 gap-6">{view.lastBattle.reveals.map((reveal) => <div key={reveal.playerId}><div className="flex justify-center gap-2">{reveal.faceUp.map((card, index) => <CardFace key={`${card.id}-${index}`} card={card} />)}</div><p className="mt-2 text-xs text-white/45">{reveal.faceDownCount} face down</p></div>)}</div></div>}
      <div className="mt-7"><Button disabled={disabled || !view.canAct} onClick={() => onAction({ type: 'battle' })}>Battle</Button></div>
    </div>
  );
}