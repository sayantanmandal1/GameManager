'use client';

import type { LiarsDeckAction, LiarsDeckCard, LiarsDeckPlayerView } from '@/shared';
import { Button } from '@/components/ui/Button';
import { CardFace } from './CardFace';

export const LIARS_RANK_LABELS = { A: 'Ace', K: 'King', Q: 'Queen', joker: 'Joker', devil: 'Devil' } as const;

export function LiarsDeckCardFace({ card, selected = false, disabled = false, onClick }: Readonly<{
  card: LiarsDeckCard; selected?: boolean; disabled?: boolean; onClick?: () => void;
}>) {
  if (card.rank !== 'joker' && card.rank !== 'devil') {
    return <CardFace card={{ id: card.id, rank: card.rank, suit: 'spades' }} label={`${LIARS_RANK_LABELS[card.rank]} card`} selected={selected} disabled={disabled} onClick={onClick} />;
  }
  const content = <>
    <span className="text-[9px] font-black uppercase">{card.rank}</span>
    <svg viewBox="0 0 64 64" aria-hidden="true" className="h-11 w-11">
      <path d={card.rank === 'devil' ? 'M15 8L24 19H40L49 8L46 32L38 51H26L18 32ZM24 30L29 33M40 30L35 33M27 42H37' : 'M11 20L24 29L32 10L40 29L53 20L45 48H19ZM19 52H45'} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
    </svg>
    <span className="self-end rotate-180 text-[9px] font-black uppercase">{card.rank}</span>
  </>;
  const className = `flex h-24 w-16 shrink-0 flex-col items-center justify-between rounded-xl border border-black/15 bg-[#fff4d8] p-1.5 shadow-lg ${card.rank === 'devil' ? 'text-[#ac3037]' : 'text-[#433364]'} ${selected ? 'outline outline-4 outline-game-blue' : ''} disabled:opacity-45`;
  return onClick ? <button type="button" className={className} aria-label={`${LIARS_RANK_LABELS[card.rank]} card`} aria-pressed={selected} disabled={disabled} onClick={onClick}>{content}</button>
    : <span className={className} aria-label={`${LIARS_RANK_LABELS[card.rank]} card`}>{content}</span>;
}

/** Classic / Devil mode choice shown to the host before the first deal. */
export function LiarsDeckSetupPanel({ view, disabled, onAction, className = '' }: Readonly<{
  view: LiarsDeckPlayerView; disabled: boolean; onAction: (action: LiarsDeckAction) => void; className?: string;
}>) {
  const hostName = view.players.find((player) => player.id === view.hostId)?.name ?? 'Player';
  return (
    <section className={`w-full max-w-3xl rounded-3xl border border-[#d1af68]/25 bg-[#201a14] p-6 text-center ${className}`}>
      <p className="eyebrow text-[#e5bd72]">Liar&apos;s Deck</p>
      <h2 className="mt-3 text-2xl font-semibold">Choose the table rules</h2>
      <p className="mt-3 text-sm leading-6 text-white/65">Two to six players, five cards each. Play one to three as the table rank. Jokers are wild. A wrong call or a caught lie costs a chamber; the last survivor wins.</p>
      <p className="mt-2 text-xs leading-5 text-white/55">Up to four players: 20 cards (6 Aces, 6 Kings, 6 Queens, 2 Jokers). Five or six players: 30 cards (9 of each rank, 3 Jokers).</p>
      {view.canAct ? <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button disabled={disabled} onClick={() => onAction({ type: 'select_liars_deck_mode', mode: 'classic' })}>Classic</Button>
        <Button variant="secondary" disabled={disabled} onClick={() => onAction({ type: 'select_liars_deck_mode', mode: 'devil' })}>Devil · Devil&apos;s Deal</Button>
      </div> : <p role="status" className="mt-6 text-sm text-[#e5bd72]">Waiting for {hostName} to choose Classic or Devil.</p>}
      <p className="mt-4 text-xs leading-5 text-white/55">Devil adds a single special card, played alone. A challenged Devil puts opponents still holding cards at risk. Devil&apos;s Deal instead reveals the last four table cards: if all four are lies, every other survivor takes the risk.</p>
    </section>
  );
}

export function liarsRevealTitle(reveal: NonNullable<LiarsDeckPlayerView['lastReveal']>) {
  if (reveal.kind === 'devils_deal') return "Devil's Deal";
  return reveal.kind === 'devil' ? 'Devil revealed' : 'Claim revealed';
}

export function liarsRevealSummary(view: LiarsDeckPlayerView, reveal: NonNullable<LiarsDeckPlayerView['lastReveal']>) {
  const name = (id: string) => view.players.find((player) => player.id === id)?.name ?? 'Player';
  if (reveal.kind === 'devils_deal') return reveal.successful ? 'All four cards were lies.' : 'At least one card was truthful. The deal failed.';
  if (reveal.kind === 'devil') return `${name(reveal.claimantId)} played the Devil.`;
  return reveal.successful ? `${name(reveal.claimantId)} was bluffing.` : `${name(reveal.claimantId)} told the truth.`;
}
