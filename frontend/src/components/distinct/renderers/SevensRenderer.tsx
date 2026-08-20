import { Button } from '@/components/ui/Button';
import type { CardRank, CardSuit, SevensAction, SevensPlayerView } from '@/shared';
import { CARD_SUITS } from '@/shared';
import { CardFace } from './CardFace';

interface Props {
  readonly view: SevensPlayerView;
  readonly disabled: boolean;
  readonly onAction: (action: SevensAction) => void;
}

const RANKS: CardRank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUIT_SYMBOL: Record<CardSuit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' };

export function SevensRenderer({ view, disabled, onAction }: Props) {
  return (
    <div className="w-full max-w-[56rem]">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{view.players.map((player) => <div key={player.id} className="border-b border-white/12 px-2 py-2"><p className="font-bold">{player.name}</p><p className="text-xs text-white/45">{player.score} pts · {player.handCount} cards</p></div>)}</div>
      <div className="mt-6 space-y-2 border-y border-white/12 py-4" aria-label="Sevens layout">
        {CARD_SUITS.map((suit) => <SuitRow key={suit} suit={suit} low={view.layout[suit].low} high={view.layout[suit].high} />)}
      </div>
      <div className="mt-6 flex min-h-28 flex-wrap justify-center gap-2" aria-label="Your private hand">{view.yourHand.map((card) => <CardFace key={card.id} card={card} disabled={disabled || !view.canAct || !view.legalCardIds.includes(card.id)} onClick={view.canAct ? () => onAction({ type: 'play_sevens_card', cardId: card.id }) : undefined} />)}</div>
      {view.canPass && <div className="mt-4 text-center"><Button variant="secondary" disabled={disabled} onClick={() => onAction({ type: 'pass_sevens' })}>Pass</Button></div>}
      {view.phase === 'round_complete' && view.lastRound && <div className="mt-5 border-y border-white/12 py-4 text-center"><p className="font-bold">{view.players.find((player) => player.id === view.lastRound?.winnerId)?.name} scored {view.lastRound.points}</p>{view.canAct && <Button className="mt-3" disabled={disabled} onClick={() => onAction({ type: 'next_sevens_round' })}>Next round</Button>}</div>}
      <p className="mt-4 text-center text-sm text-white/45">Round {view.roundNumber}</p>
    </div>
  );
}

function SuitRow({ suit, low, high }: Readonly<{ suit: CardSuit; low: CardRank | null; high: CardRank | null }>) {
  const active = low && high ? RANKS.slice(RANKS.indexOf(low), RANKS.indexOf(high) + 1) : [];
  const red = suit === 'diamonds' || suit === 'hearts';
  return <div className="flex min-h-10 items-center gap-2"><span className={`w-7 text-xl ${red ? 'text-red-300' : 'text-white'}`}>{SUIT_SYMBOL[suit]}</span><div className="flex flex-wrap gap-1">{active.length > 0 ? active.map((rank) => <span key={rank} className="flex h-8 w-8 items-center justify-center border border-white/15 bg-black/15 text-xs font-bold">{rank}</span>) : <span className="text-sm text-white/30">Closed</span>}</div></div>;
}