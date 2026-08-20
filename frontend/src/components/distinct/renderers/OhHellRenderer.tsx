import { Button } from '@/components/ui/Button';
import type { OhHellAction, OhHellPlayerView } from '@/shared';
import { CardFace } from './CardFace';

interface Props { readonly view: OhHellPlayerView; readonly disabled: boolean; readonly onAction: (action: OhHellAction) => void }

export function OhHellRenderer({ view, disabled, onAction }: Props) {
  const name = (id: string) => view.players.find((player) => player.id === id)?.name ?? 'Player';
  return (
    <div className="w-full max-w-[56rem]">
      <div className="flex flex-wrap items-center justify-center gap-4 border-y border-white/12 py-4 text-sm text-white/55"><span>Deal {view.dealNumber}/13</span><span>{view.handSize} cards</span><span>Dealer {name(view.dealerId)}</span><span>Trump {view.trumpSuit}</span><CardFace card={view.trumpCard} label={`Trump card ${view.trumpCard.rank} of ${view.trumpCard.suit}`} /></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{view.players.map((player) => <div key={player.id} className="border-b border-white/12 px-2 py-2"><p className="font-bold">{player.name}</p><p className="text-xs text-white/45">{player.score} pts · bid {player.bid ?? '—'} · {player.tricksWon} tricks</p></div>)}</div>
      {view.phase === 'bidding' && view.canAct && <div className="mt-6 border-y border-white/12 py-5 text-center"><p className="mb-3 text-xs font-bold uppercase text-white/40">Your exact bid</p><div className="flex flex-wrap justify-center gap-2">{view.legalBids.map((bid) => <Button key={bid} disabled={disabled} onClick={() => onAction({ type: 'bid_oh_hell', bid })}>{bid}</Button>)}</div></div>}
      {view.phase === 'playing' && <div className="mt-6 min-h-28 border-y border-white/12 py-4"><p className="mb-3 text-center text-xs font-bold uppercase text-white/40">Current trick</p><div className="flex flex-wrap justify-center gap-3">{view.trick.map((entry) => <div key={`${entry.playerId}-${entry.card.id}`} className="text-center"><CardFace card={entry.card} /><p className="mt-1 text-xs text-white/45">{name(entry.playerId)}</p></div>)}</div></div>}
      <div className="mt-6 flex min-h-28 flex-wrap justify-center gap-2" aria-label="Your private hand">{view.yourHand.map((card) => <CardFace key={card.id} card={card} disabled={disabled || !view.canAct || view.phase !== 'playing' || !view.legalCardIds.includes(card.id)} onClick={view.phase === 'playing' && view.canAct ? () => onAction({ type: 'play_oh_hell_card', cardId: card.id }) : undefined} />)}</div>
      {view.phase === 'deal_complete' && view.lastDeal && <div className="mt-5 border-y border-white/12 py-4 text-center"><p className="font-bold">Deal {view.lastDeal.dealNumber} scored</p><p className="mt-1 text-sm text-white/50">{view.players.map((player) => `${player.name} +${view.lastDeal?.points[player.id] ?? 0}`).join(' · ')}</p>{view.canAct && <Button className="mt-3" disabled={disabled} onClick={() => onAction({ type: 'next_oh_hell_deal' })}>Next deal</Button>}</div>}
    </div>
  );
}