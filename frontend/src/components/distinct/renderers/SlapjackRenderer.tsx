import { Button } from '@/components/ui/Button';
import type { SlapjackAction, SlapjackPlayerView } from '@/shared';
import { CardFace } from './CardFace';

interface Props { readonly view: SlapjackPlayerView; readonly disabled: boolean; readonly onAction: (action: SlapjackAction) => void }

export function SlapjackRenderer({ view, disabled, onAction }: Props) {
  return (
    <div className="w-full max-w-[48rem]">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{view.players.map((player) => <div key={player.id} className={`border-b px-2 py-2 ${player.eliminated ? 'border-red-400/25 opacity-40' : 'border-white/12'}`}><p className="font-bold">{player.name}</p><p className="text-xs text-white/45">{player.cardCount} cards{player.lastChance ? ' · last chance' : ''}</p></div>)}</div>
      <div className="mt-7 flex min-h-40 flex-col items-center justify-center border-y border-white/12 py-5"><p className="text-xs font-bold uppercase text-white/40">Center pile · {view.pileCount}</p>{view.topCard ? <div className="mt-3"><CardFace card={view.topCard} /></div> : <p className="mt-3 text-white/35">Empty</p>}{view.phase === 'slap_window' && <p className="mt-3 font-black text-[#f07b67]">JACK WINDOW OPEN</p>}</div>
      <div className="mt-5 flex flex-wrap justify-center gap-2">{view.canFlip && <Button disabled={disabled} onClick={() => onAction({ type: 'flip_slapjack' })}>Flip</Button>}{view.canSlap && <Button variant="danger" disabled={disabled} onClick={() => onAction({ type: 'slap_jack' })}>Slap</Button>}{view.canContinue && <Button variant="secondary" disabled={disabled} onClick={() => onAction({ type: 'continue_slapjack' })}>Continue</Button>}</div>
    </div>
  );
}