import { Button } from '@/components/ui/Button';
import type { SpoonsAction, SpoonsPlayerView } from '@/shared';
import { CardFace } from './CardFace';

interface Props { readonly view: SpoonsPlayerView; readonly disabled: boolean; readonly onAction: (action: SpoonsAction) => void }
const WORD = 'SPOON';

export function SpoonsRenderer({ view, disabled, onAction }: Props) {
  return (
    <div className="w-full max-w-[54rem]">
      <div className="border-y border-white/12 py-5 text-center"><p className="text-xs font-bold uppercase text-white/40">Spoons remaining</p><p className="mt-1 text-5xl font-black">{view.spoonsRemaining}</p><p className="mt-2 text-xs text-white/45">Round {view.roundNumber}</p></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{view.players.map((player) => <div key={player.id} className={`border-b px-2 py-2 ${player.active ? 'border-white/12' : 'border-red-400/25 opacity-40'}`}><p className="font-bold">{player.name}{player.grabbed ? ' · spoon' : ''}</p><p className="text-xs text-white/45">{WORD.slice(0, player.letters) || 'safe'} · {player.handCount} cards</p></div>)}</div>
      <div className="mt-7 flex min-h-28 flex-wrap justify-center gap-2" aria-label="Your private hand">{view.yourHand.map((card) => <CardFace key={card.id} card={card} disabled={disabled || !view.canPass} onClick={view.canPass ? () => onAction({ type: 'pass_spoon_card', cardId: card.id }) : undefined} />)}</div>
      <div className="mt-5 flex justify-center gap-2">{view.canGrab && <Button variant="danger" disabled={disabled} onClick={() => onAction({ type: 'grab_spoon' })}>Grab spoon</Button>}{view.canStartNext && <Button disabled={disabled} onClick={() => onAction({ type: 'next_spoons_round' })}>Next round</Button>}</div>
      {view.lastRound && <p className="mt-4 text-center text-sm text-white/50">{view.players.find((player) => player.id === view.lastRound?.loserId)?.name} received a letter{view.lastRound.eliminated ? ' and was eliminated' : ''}.</p>}
    </div>
  );
}