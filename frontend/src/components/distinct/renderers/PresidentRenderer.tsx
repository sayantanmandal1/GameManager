import { Button } from '@/components/ui/Button';
import type { PresidentAction, PresidentPlayerView } from '@/shared';
import { CardFace } from './CardFace';

interface Props { readonly view: PresidentPlayerView; readonly disabled: boolean; readonly onAction: (action: PresidentAction) => void }

export function PresidentRenderer({ view, disabled, onAction }: Props) {
  const name = (id: string) => view.players.find((player) => player.id === id)?.name ?? 'Player';
  return (
    <div className="w-full max-w-[56rem]">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{view.players.map((player) => <div key={player.id} className="border-b border-white/12 px-2 py-2"><p className="font-bold">{player.name}{player.finishPlace ? ` · #${player.finishPlace}` : ''}</p><p className="text-xs text-white/45">{player.score} pts · {player.handCount} cards</p></div>)}</div>
      <div className="mt-6 border-y border-white/12 py-5 text-center"><p className="text-xs font-bold uppercase text-white/40">Current climb</p>{view.pilePlay ? <><p className="mt-1 text-3xl font-black">{view.pilePlay.count} × {view.pilePlay.rank}</p><p className="text-sm text-white/45">by {name(view.pilePlay.playerId)}</p></> : <p className="mt-2 text-lg text-white/55">Open lead</p>}</div>
      {view.phase === 'playing' && view.canAct && <div className="mt-5 flex flex-wrap justify-center gap-2">{view.legalPlays.map((play) => <Button key={`${play.rank}-${play.cardIds.length}`} disabled={disabled} onClick={() => onAction({ type: 'play_president_cards', cardIds: play.cardIds })}>{play.cardIds.length} × {play.rank}</Button>)}{view.canPass && <Button variant="secondary" disabled={disabled} onClick={() => onAction({ type: 'pass_president' })}>Pass</Button>}</div>}
      <div className="mt-6 flex min-h-28 flex-wrap justify-center gap-2" aria-label="Your private hand">{view.yourHand.map((card) => <CardFace key={card.id} card={card} disabled={disabled || !view.canReturn} onClick={view.canReturn ? () => onAction({ type: 'return_president_card', cardId: card.id }) : undefined} />)}</div>
      {view.canReturn && <p className="mt-3 text-center text-sm text-white/55">Return any one card to the previous round’s last-place player.</p>}
      {view.phase === 'round_complete' && view.lastRound && <div className="mt-5 text-center"><p className="font-bold">{view.lastRound.ranking.map(name).join(' · ')}</p>{view.canAct && <Button className="mt-3" disabled={disabled} onClick={() => onAction({ type: 'next_president_round' })}>Next round</Button>}</div>}
      <p className="mt-4 text-center text-sm text-white/45">Round {view.roundNumber}/8</p>
    </div>
  );
}