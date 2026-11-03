'use client';

import { useEffect, useState } from 'react';
import type { LiarsDeckAction, LiarsDeckCard, LiarsDeckPlayerView } from '@/shared';
import { Button } from '@/components/ui/Button';
import { CardFace } from './CardFace';
import { LiarTableScene } from './LiarTableScene';

const RANK_LABELS = { A: 'Ace', K: 'King', Q: 'Queen', joker: 'Joker', devil: 'Devil' } as const;

export function LiarsDeckRenderer({ view, disabled, onAction }: Readonly<{
  view: LiarsDeckPlayerView; disabled: boolean; onAction: (action: LiarsDeckAction) => void;
}>) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  useEffect(() => setSelectedIds([]), [view.round, view.currentTurnId, view.pileCount]);
  const selected = view.yourHand.filter((card) => selectedIds.includes(card.id));
  const name = (id: string) => view.players.find((player) => player.id === id)?.name ?? 'Player';
  const toggle = (card: LiarsDeckCard) => {
    setSelectedIds((ids) => {
      if (ids.includes(card.id)) return ids.filter((id) => id !== card.id);
      if (card.rank === 'devil' || view.yourHand.some((entry) => entry.rank === 'devil' && ids.includes(entry.id))) return [card.id];
      return [...ids, card.id];
    });
  };

  if (view.phase === 'setup') return (
    <section className="w-full max-w-3xl rounded-3xl border border-[#d1af68]/25 bg-[#201a14] p-6 text-center">
      <p className="eyebrow text-[#e5bd72]">Liar&apos;s Deck</p>
      <h2 className="mt-3 text-2xl font-semibold">Choose the table rules</h2>
      <p className="mt-3 text-sm leading-6 text-white/65">Five cards each. Play one to three as the table rank. Jokers are wild. A wrong call or a caught lie costs a chamber; the last survivor wins.</p>
      {view.canAct ? <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button disabled={disabled} onClick={() => onAction({ type: 'select_liars_deck_mode', mode: 'classic' })}>Classic</Button>
        <Button variant="secondary" disabled={disabled} onClick={() => onAction({ type: 'select_liars_deck_mode', mode: 'devil' })}>Devil · Devil&apos;s Deal</Button>
      </div> : <p role="status" className="mt-6 text-sm text-[#e5bd72]">Waiting for {name(view.hostId)} to choose Classic or Devil.</p>}
      <p className="mt-4 text-xs leading-5 text-white/55">Devil adds a single special card, played alone. A challenged Devil puts opponents still holding cards at risk. Devil&apos;s Deal instead reveals the last four table cards: if all four are lies, every other survivor takes the risk.</p>
    </section>
  );

  return (
    <section className="w-full max-w-[64rem] space-y-4" aria-label="Liar's Deck table">
      <LiarTableScene kind="deck" players={view.players} youId={view.youId} currentTurnId={view.currentTurnId} round={view.round} tableCount={view.pileCount} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {view.players.map((player) => <div key={player.id} className={`min-w-0 rounded-xl border p-3 ${view.currentTurnId === player.id && view.phase === 'playing' ? 'border-[#dfbd70]/70 bg-[#dfbd70]/10' : 'border-white/10 bg-black/15'} ${player.active ? '' : 'opacity-45'}`}>
          <p className="truncate text-sm font-bold" title={player.name}>{player.name}{player.id === view.youId ? ' · you' : ''}</p>
          <p className="mt-1 text-xs text-white/65">{player.active ? `${player.handCount} cards · ${player.pulls}/6 chambers` : 'Eliminated'}</p>
        </div>)}
      </div>
      <div className="rounded-2xl border border-[#dfbd70]/20 bg-black/20 p-4 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-[#dfbd70]">{view.mode === 'devil' ? 'Devil' : 'Classic'} · Round {view.round}</p>
        <h2 className="mt-1 text-2xl font-semibold">{RANK_LABELS[view.tableRank]}&apos;s table</h2>
        <p className="mt-2 text-sm text-white/65">{view.pendingClaim ? `${name(view.pendingClaim.playerId)} claims ${view.pendingClaim.count} ${RANK_LABELS[view.tableRank]}${view.pendingClaim.count === 1 ? '' : 's'}` : 'Open the round with one to three cards.'}</p>
      </div>
      {view.phase === 'playing' && <>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-white/60">Your private hand</p>
          <div className="flex flex-wrap justify-center gap-2" aria-label="Your private hand">
            {view.yourHand.map((card) => <LiarsDeckCardFace key={card.id} card={card} selected={selectedIds.includes(card.id)} disabled={disabled || (selected.length >= 3 && !selectedIds.includes(card.id) && card.rank !== 'devil')} onClick={view.canPlay ? () => toggle(card) : undefined} />)}
            {view.yourHand.length === 0 && <p className="py-4 text-sm text-white/65">{view.players.find((player) => player.id === view.youId)?.active ? 'Your hand is empty. You sit out until the next round.' : 'You are spectating this match.'}</p>}
          </div>
          {view.canPlay && <p className="mt-3 text-xs text-white/65">{selected.length}/3 selected · cards are played face down</p>}
        </div>
        {view.forcedChallenge && <p role="status" className="text-center text-sm font-semibold text-[#f2d18a]">You hold the last hand. The previous claim must be challenged after a short pause.</p>}
        {view.canAct && <div className="flex flex-wrap justify-center gap-3">
          <Button disabled={disabled || !view.canPlay || selected.length < 1 || selected.length > 3} onClick={() => onAction({ type: 'play_liars_deck', cardIds: selected.map((card) => card.id) })}>Play selected</Button>
          <Button variant="danger" disabled={disabled || !view.canChallenge} onClick={() => onAction({ type: 'call_liars_deck' })}>Call Liar!</Button>
          {view.mode === 'devil' && <Button variant="secondary" disabled={disabled || !view.canDevilsDeal} onClick={() => onAction({ type: 'devils_deal' })}>Devil&apos;s Deal</Button>}
        </div>}
      </>}
      {view.lastReveal && (view.phase === 'reveal' || view.phase === 'finished') && <div role="status" className="rounded-2xl border border-[#d1af68]/30 bg-[#241c15] p-5 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-[#e5bd72]">{view.lastReveal.kind === 'devils_deal' ? "Devil's Deal" : view.lastReveal.kind === 'devil' ? 'Devil revealed' : 'Claim revealed'}</p>
        <div className="my-4 flex flex-wrap justify-center gap-2" aria-label="Revealed cards">{view.lastReveal.cards.map((card) => <LiarsDeckCardFace key={card.id} card={card} />)}</div>
        <p className="text-sm text-white/80">{view.lastReveal.kind === 'devils_deal' ? (view.lastReveal.successful ? 'All four cards were lies.' : 'At least one card was truthful. The deal failed.') : view.lastReveal.kind === 'devil' ? `${name(view.lastReveal.claimantId)} played the Devil.` : view.lastReveal.successful ? `${name(view.lastReveal.claimantId)} was bluffing.` : `${name(view.lastReveal.claimantId)} told the truth.`}</p>
        <p className="mt-2 text-sm text-white/65">{view.lastReveal.riskPlayerIds.map(name).join(', ')} took a chamber risk.</p>
        {view.lastReveal.eliminatedIds.length > 0 && <p className="mt-2 text-sm text-red-300">Eliminated: {view.lastReveal.eliminatedIds.map(name).join(', ')}</p>}
        {view.phase === 'reveal' && <p className="mt-3 text-xs text-white/55">A fresh round starts in a few seconds.</p>}
        {view.phase === 'reveal' && view.youId === view.hostId && <Button className="mt-4" disabled={disabled} variant="secondary" onClick={() => onAction({ type: 'next_liars_deck_round' })}>Next round</Button>}
      </div>}
      {view.phase === 'reveal' && !view.lastReveal && <div role="status" className="rounded-2xl border border-[#d1af68]/30 bg-[#241c15] p-5 text-center">
        <p className="text-sm text-white/80">A player resigned. The remaining players continue with a fresh round in a few seconds.</p>
        {view.youId === view.hostId && <Button className="mt-4" disabled={disabled} variant="secondary" onClick={() => onAction({ type: 'next_liars_deck_round' })}>Next round</Button>}
      </div>}
      <details className="rounded-2xl border border-white/10 p-4 text-sm text-white/65"><summary className="cursor-pointer font-semibold">Table rules</summary><p className="mt-3 leading-6">Only the next player may challenge the latest claim. Any off-rank card makes a mixed claim a lie; Jokers always match. Empty hands are skipped. The last player still holding cards must challenge the previous claim. Chamber positions stay secret and do not reset between rounds. Bluff is a separate game and is unchanged.</p></details>
    </section>
  );
}

export function LiarsDeckCardFace({ card, selected = false, disabled = false, onClick }: Readonly<{
  card: LiarsDeckCard; selected?: boolean; disabled?: boolean; onClick?: () => void;
}>) {
  if (card.rank !== 'joker' && card.rank !== 'devil') {
    return <CardFace card={{ id: card.id, rank: card.rank, suit: 'spades' }} label={`${RANK_LABELS[card.rank]} card`} selected={selected} disabled={disabled} onClick={onClick} />;
  }
  const content = <>
    <span className="text-[9px] font-black uppercase">{card.rank}</span>
    <svg viewBox="0 0 64 64" aria-hidden="true" className="h-11 w-11">
      <path d={card.rank === 'devil' ? 'M15 8L24 19H40L49 8L46 32L38 51H26L18 32ZM24 30L29 33M40 30L35 33M27 42H37' : 'M11 20L24 29L32 10L40 29L53 20L45 48H19ZM19 52H45'} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
    </svg>
    <span className="self-end rotate-180 text-[9px] font-black uppercase">{card.rank}</span>
  </>;
  const className = `flex h-24 w-16 shrink-0 flex-col items-center justify-between rounded-xl border border-black/15 bg-[#fff4d8] p-1.5 shadow-lg ${card.rank === 'devil' ? 'text-[#ac3037]' : 'text-[#433364]'} ${selected ? 'outline outline-4 outline-game-blue' : ''} disabled:opacity-45`;
  return onClick ? <button type="button" className={className} aria-label={`${RANK_LABELS[card.rank]} card`} aria-pressed={selected} disabled={disabled} onClick={onClick}>{content}</button>
    : <span className={className} aria-label={`${RANK_LABELS[card.rank]} card`}>{content}</span>;
}
