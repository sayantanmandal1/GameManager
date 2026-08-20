import type { ReactNode } from 'react';
import type { StandardCard } from '@/shared';
import { CardBack, CardFace } from './CardFace';

export interface CardTablePlayer {
  readonly id: string;
  readonly name: string;
  readonly handCount: number;
  readonly detail?: string;
}

interface Props {
  readonly players: CardTablePlayer[];
  readonly youId: string;
  readonly currentTurnId: string | null;
  readonly center: ReactNode;
  readonly hand: ReactNode;
  readonly revealedHands?: Readonly<Record<string, StandardCard[]>>;
  readonly topRail?: ReactNode;
  readonly bottomRail?: ReactNode;
}

export function CardTable({
  players,
  youId,
  currentTurnId,
  center,
  hand,
  revealedHands = {},
  topRail,
  bottomRail,
}: Props) {
  const ordered = rotatePlayers(players, youId);
  const you = ordered[0];
  const left = ordered[1];
  const top = ordered[2];
  const right = ordered[3];

  return (
    <section
      className="relative min-h-[43rem] w-full overflow-hidden rounded-[1.75rem] border border-[#d2b76f]/35 bg-[#123f33] shadow-[0_28px_70px_rgba(0,0,0,0.4)] sm:min-h-[47rem]"
      aria-label="Card table"
    >
      <div className="pointer-events-none absolute inset-3 rounded-[1.35rem] border border-white/10" />
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:repeating-linear-gradient(135deg,transparent_0,transparent_20px,rgba(255,255,255,0.035)_21px)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-black/15" />

      {topRail && <div className="absolute inset-x-0 top-2 z-20 flex justify-center px-36 text-center max-sm:px-24">{topRail}</div>}
      {top && (
        <TableSeat
          player={top}
          position="top"
          active={top.id === currentTurnId}
          revealedCards={revealedHands[top.id]}
        />
      )}
      {left && (
        <TableSeat
          player={left}
          position="left"
          active={left.id === currentTurnId}
          revealedCards={revealedHands[left.id]}
        />
      )}
      {right && (
        <TableSeat
          player={right}
          position="right"
          active={right.id === currentTurnId}
          revealedCards={revealedHands[right.id]}
        />
      )}

      <div className="absolute inset-x-[5.25rem] bottom-[12.5rem] top-[9rem] z-10 flex items-center justify-center max-sm:inset-x-[4.4rem] max-sm:bottom-[12rem] max-sm:top-[8.5rem]">
        {center}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 border-t border-white/10 bg-black/20 px-2 pb-3 pt-2 backdrop-blur-sm">
        {you && <SeatIdentity player={you} active={you.id === currentTurnId} isYou />}
        <div className="mt-1 min-h-24 overflow-x-auto [scrollbar-width:thin]">{hand}</div>
        {bottomRail && <div className="mt-1 flex justify-center">{bottomRail}</div>}
      </div>
    </section>
  );
}

function TableSeat({ player, position, active, revealedCards }: Readonly<{
  player: CardTablePlayer;
  position: 'top' | 'left' | 'right';
  active: boolean;
  revealedCards?: StandardCard[];
}>) {
  const positionClass = {
    top: 'left-1/2 top-12 -translate-x-1/2',
    left: 'left-2 top-[38%] -translate-y-1/2 sm:left-4',
    right: 'right-2 top-[38%] -translate-y-1/2 sm:right-4',
  }[position];
  return (
    <div className={`absolute z-20 flex w-[7.2rem] flex-col items-center ${positionClass}`}>
      <SeatIdentity player={player} active={active} />
      {player.detail && <p className="mt-1 max-w-28 truncate text-[9px] font-semibold uppercase text-white/45">{player.detail}</p>}
      {revealedCards ? <MiniFaceFan cards={revealedCards} /> : <CardBackFan count={player.handCount} />}
    </div>
  );
}

function SeatIdentity({ player, active, isYou = false }: Readonly<{
  player: CardTablePlayer;
  active: boolean;
  isYou?: boolean;
}>) {
  return (
    <div className={`flex max-w-full items-center gap-2 rounded-full border px-2.5 py-1 shadow-lg ${active ? 'border-[#f3d477] bg-[#f3d477] text-[#17231f]' : 'border-white/15 bg-[#102820]/90 text-white'}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${active ? 'bg-[#17231f]' : 'bg-[#72d3a3]'}`} />
      <span className="truncate text-xs font-bold">{player.name}{isYou ? ' · you' : ''}</span>
      <span className="shrink-0 text-[10px] opacity-70">{player.handCount}</span>
    </div>
  );
}

export function CardBackFan({ count }: Readonly<{ count: number }>) {
  const shown = Math.min(Math.max(count, 0), 7);
  return (
    <div className="relative mt-2 h-14 w-24" aria-label={`${count} hidden cards`}>
      {Array.from({ length: shown }, (_, index) => (
        <span
          key={index}
          className="absolute left-1/2 top-0"
          style={{ transform: `translateX(-50%) translateX(${(index - (shown - 1) / 2) * 9}px) rotate(${(index - (shown - 1) / 2) * 5}deg)`, transformOrigin: 'bottom center' }}
        >
          <CardBack size="tiny" />
        </span>
      ))}
    </div>
  );
}

function MiniFaceFan({ cards }: Readonly<{ cards: StandardCard[] }>) {
  const shown = cards.slice(0, 7);
  return (
    <div className="relative mt-2 h-20 w-28" aria-label={`${cards.length} revealed cards`}>
      {shown.map((card, index) => (
        <span
          key={card.id}
          className="absolute left-1/2 top-0"
          style={{ transform: `translateX(-50%) translateX(${(index - (shown.length - 1) / 2) * 11}px) rotate(${(index - (shown.length - 1) / 2) * 5}deg)`, transformOrigin: 'bottom center' }}
        >
          <CardFace card={card} size="mini" />
        </span>
      ))}
      {cards.length > shown.length && <span className="absolute -bottom-1 right-0 rounded-full bg-black/75 px-1.5 text-[10px] font-bold">+{cards.length - shown.length}</span>}
    </div>
  );
}

function rotatePlayers(players: CardTablePlayer[], youId: string): CardTablePlayer[] {
  const index = players.findIndex((player) => player.id === youId);
  if (index < 0) return players.slice(0, 4);
  return [...players.slice(index), ...players.slice(0, index)].slice(0, 4);
}

export function PlayingCardHand({
  cards,
  legalCardIds = [],
  selectedCardIds = [],
  active,
  disabled = false,
  onPlay,
  ariaLabel = 'Your private hand',
}: Readonly<{
  cards: StandardCard[];
  legalCardIds?: string[];
  selectedCardIds?: string[];
  active: boolean;
  disabled?: boolean;
  onPlay: (cardId: string) => void;
  ariaLabel?: string;
}>) {
  const legal = new Set(legalCardIds);
  const selected = new Set(selectedCardIds);
  const sorted = [...cards].sort(compareCards);
  return (
    <div className="flex min-h-24 w-max min-w-full items-end justify-center px-7 pt-2" aria-label={ariaLabel}>
      {sorted.map((card, index) => {
        const playable = active && legal.has(card.id);
        return (
          <span
            key={card.id}
            className={index === 0 ? '' : '-ml-8 max-sm:-ml-6'}
            style={{ transform: `rotate(${(index - (sorted.length - 1) / 2) * 1.1}deg)`, transformOrigin: 'bottom center' }}
          >
            <CardFace
              card={card}
              selected={selected.has(card.id)}
              disabled={disabled || !playable}
              onClick={active ? () => onPlay(card.id) : undefined}
            />
          </span>
        );
      })}
    </div>
  );
}

function compareCards(left: StandardCard, right: StandardCard): number {
  const suits: StandardCard['suit'][] = ['spades', 'hearts', 'diamonds', 'clubs'];
  const ranks: StandardCard['rank'][] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
  return suits.indexOf(left.suit) - suits.indexOf(right.suit)
    || ranks.indexOf(left.rank) - ranks.indexOf(right.rank);
}