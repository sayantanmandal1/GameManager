import { Button } from '@/components/ui/Button';
import type { NinetyNineAction, NinetyNinePlayerView } from '@/shared';
import { CardFace } from './CardFace';

interface Props {
  readonly view: NinetyNinePlayerView;
  readonly disabled: boolean;
  readonly onAction: (action: NinetyNineAction) => void;
}

export function NinetyNineRenderer({ view, disabled, onAction }: Props) {
  const legalValues = new Map(view.legalPlays.map((entry) => [entry.cardId, entry.values]));
  return (
    <div className="w-full max-w-[52rem]">
      <div className="border-y border-white/12 py-5 text-center">
        <p className="text-xs font-bold uppercase text-white/45">Running total</p>
        <p className="mt-1 text-6xl font-black tabular-nums">{view.total}</p>
        <p className="mt-2 text-xs text-white/45">Direction {view.direction === 1 ? 'clockwise' : 'counter-clockwise'} · Hand {view.handNumber}</p>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{view.players.map((player) => <div key={player.id} className={`border-b px-2 py-2 ${player.active ? 'border-white/12' : 'border-red-400/30 opacity-45'}`}><p className="font-bold">{player.name}</p><p className="text-xs text-white/45">{'●'.repeat(player.tokens) || 'out'} · {player.handCount} cards</p></div>)}</div>
      <div className="mt-7 flex flex-wrap justify-center gap-4" aria-label="Your private hand">
        {view.yourHand.map((card) => {
          const values = legalValues.get(card.id) ?? [];
          return <div key={card.id} className="text-center"><CardFace card={card} /><div className="mt-2 flex min-h-9 justify-center gap-1">{values.map((value) => <button key={value} type="button" disabled={disabled || !view.canAct} onClick={() => onAction({ type: 'play_ninety_nine', cardId: card.id, chosenValue: value })} className="min-h-9 min-w-10 border border-white/15 bg-black/20 px-2 text-xs font-bold hover:border-white/40 disabled:opacity-30">{labelValue(card.rank, value)}</button>)}</div></div>;
        })}
      </div>
      {view.mustConcede && <div className="mt-4 text-center"><Button variant="danger" disabled={disabled} onClick={() => onAction({ type: 'concede_ninety_nine' })}>Lose a token</Button></div>}
    </div>
  );
}

function labelValue(rank: string, value: number): string {
  if (rank === '9') return 'Set 99';
  if (value === 0) return 'Keep';
  return value > 0 ? `+${value}` : String(value);
}