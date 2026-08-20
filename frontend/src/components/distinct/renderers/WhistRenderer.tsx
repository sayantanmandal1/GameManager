import { Button } from '@/components/ui/Button';
import type { WhistAction, WhistPlayerView } from '@/shared';
import { CardTable, PlayingCardHand } from './CardTable';
import { CardFace } from './CardFace';

interface Props { readonly view: WhistPlayerView; readonly disabled: boolean; readonly onAction: (action: WhistAction) => void }

export function WhistRenderer({ view, disabled, onAction }: Props) {
  const name = (id: string) => view.players.find((player) => player.id === id)?.name ?? 'Player';
  const tablePlayers = view.players.map((player) => ({
    id: player.id,
    name: player.name,
    handCount: player.handCount,
    detail: `Team ${player.team + 1} · ${player.tricksWon} tricks`,
  }));
  return (
    <div className="w-full max-w-[72rem]">
      <CardTable
        players={tablePlayers}
        youId={view.youId}
        currentTurnId={view.currentTurnId}
        topRail={<div className="flex gap-2">{[0, 1].map((team) => <div key={team} className="min-w-28 rounded-full border border-white/15 bg-[#0c2b23]/95 px-3 py-1 text-center shadow-lg"><p className="text-[9px] font-bold uppercase text-white/45">Team {team + 1}</p><p className="text-sm font-black">{view.gamePoints[team]} / 5 <span className="text-[9px] text-white/45">· {view.teamTricks[team]} tricks</span></p></div>)}</div>}
        center={view.phase === 'hand_complete' && view.lastHand ? (
          <div className="rounded-xl border border-white/12 bg-[#0c2b23]/95 p-4 text-center shadow-xl"><p className="font-bold">Odd tricks: {view.lastHand.oddPoints[0]}–{view.lastHand.oddPoints[1]}</p>{view.canAct && <Button className="mt-3" disabled={disabled} onClick={() => onAction({ type: 'next_whist_hand' })}>Next hand</Button>}</div>
        ) : (
          <div className="text-center">
            <div className="mb-3 flex items-center justify-center gap-2"><span className="text-[10px] font-bold uppercase text-white/45">Trump</span><CardFace card={view.trumpCard} size="mini" label={`Trump card ${view.trumpCard.rank} of ${view.trumpCard.suit}`} /></div>
            <div className="flex min-h-20 flex-wrap justify-center gap-2" aria-label="Current trick">{view.trick.map((entry) => <div key={`${entry.playerId}-${entry.card.id}`} className="text-center"><CardFace card={entry.card} size="mini" /><p className="mt-1 max-w-14 truncate text-[10px] text-white/45">{name(entry.playerId)}</p></div>)}{view.trick.length === 0 && <p className="self-center text-xs text-white/40">Awaiting lead</p>}</div>
          </div>
        )}
        hand={<PlayingCardHand cards={view.yourHand} legalCardIds={view.legalCardIds} active={view.canAct && view.phase === 'playing'} disabled={disabled} onPlay={(cardId) => onAction({ type: 'play_whist_card', cardId })} />}
        bottomRail={<p className="text-[10px] font-bold uppercase text-white/50">Hand {view.handNumber} · Dealer {name(view.dealerId)} · Trump {view.trumpSuit}</p>}
      />
    </div>
  );
}