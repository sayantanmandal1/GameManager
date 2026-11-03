'use client';

import { useEffect, useState } from 'react';
import { LIARS_DECK_DEAL_INTRO_MS, type LiarsDeckDeckCounts, type LiarsDeckPlayerView } from '@/shared';

const RANK_NAMES = { A: 'Ace', K: 'King', Q: 'Queen', joker: 'Joker', devil: 'Devil' } as const;
const DECK_ORDER = ['A', 'K', 'Q', 'joker', 'devil'] as const;

/**
 * Counts down a server-provided remaining duration from the moment the view arrives.
 * A new key (or a refreshed server value) restarts the countdown.
 */
export function useServerCountdown(key: string | null, remainingMs: number): number {
  const [timer, setTimer] = useState<{ token: string; end: number; now: number } | null>(null);
  const token = key && remainingMs > 0 ? `${key}:${remainingMs}` : null;
  useEffect(() => {
    if (!token) return;
    const end = Date.now() + remainingMs;
    const tick = () => setTimer({ token, end, now: Date.now() });
    const first = setTimeout(tick, 0);
    const interval = setInterval(() => {
      tick();
      if (Date.now() >= end) clearInterval(interval);
    }, 200);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [token, remainingMs]);
  if (!token) return 0;
  if (timer?.token !== token) return remainingMs;
  return Math.max(0, timer.end - timer.now);
}

export function deckSummary(deck: LiarsDeckDeckCounts): string {
  return DECK_ORDER.filter((rank) => deck[rank] > 0)
    .map((rank) => `${deck[rank]} ${RANK_NAMES[rank]}${deck[rank] === 1 ? '' : 's'}`)
    .join(' · ');
}

export function LiarsDeckComposition({ deck, tableRank }: Readonly<{ deck: LiarsDeckDeckCounts; tableRank: LiarsDeckPlayerView['tableRank'] }>) {
  const total = DECK_ORDER.reduce((sum, rank) => sum + deck[rank], 0);
  return (
    <div aria-label={`Deck of ${total}: ${deckSummary(deck)}`}>
      <ul className="flex flex-wrap justify-center gap-2">
        {DECK_ORDER.filter((rank) => deck[rank] > 0).map((rank) => {
          const truthful = rank === tableRank || rank === 'joker' || rank === 'devil';
          return (
            <li key={rank} className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-sm ${truthful ? 'border-[#dfbd70]/60 bg-[#dfbd70]/10 text-[#f6dca0]' : 'border-white/10 bg-black/25 text-white/70'}`}>
              <span aria-hidden="true" className={`grid h-7 w-5 place-items-center rounded-[4px] bg-[#fff4d8] text-[10px] font-black ${rank === 'devil' ? 'text-[#ac3037]' : 'text-[#2b2620]'}`}>
                {rank === 'joker' ? 'J★' : rank === 'devil' ? '☠' : rank}
              </span>
              <span className="font-semibold tabular-nums">×{deck[rank]}</span>
              <span className="hidden sm:inline">{RANK_NAMES[rank]}{deck[rank] === 1 ? '' : 's'}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-white/55">{total}-card deck · five cards to each player · highlighted cards count as {RANK_NAMES[tableRank]}s</p>
    </div>
  );
}

/** Opening of every round: the table card is turned over and the deck composition is announced before anyone may act. */
export function LiarsDeckRoundIntro({ view, remainingMs }: Readonly<{ view: LiarsDeckPlayerView; remainingMs: number }>) {
  const progress = Math.min(1, Math.max(0, 1 - remainingMs / LIARS_DECK_DEAL_INTRO_MS));
  const active = view.players.filter((player) => player.active).length;
  return (
    <div role="status" aria-live="polite" className="rounded-2xl border border-[#dfbd70]/40 bg-[radial-gradient(ellipse_at_top,#3a2b19_0%,#1c1610_70%)] p-5 text-center shadow-[0_20px_60px_-30px_rgba(223,189,112,0.6)]" data-liars-round-intro>
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#dfbd70]">{view.mode === 'devil' ? 'Devil' : 'Classic'} · Round {view.round}</p>
      <div className="mx-auto mt-4 flex items-center justify-center gap-4 [perspective:800px]">
        <span key={view.round} aria-hidden="true" className="liars-table-card-reveal grid h-28 w-20 place-items-center rounded-xl border border-black/20 bg-[#fff4d8] text-4xl font-black text-[#2b2620] shadow-2xl sm:h-32 sm:w-24">
          {view.tableRank}
        </span>
        <div className="text-left">
          <h2 className="text-3xl font-semibold text-[#f6dca0] sm:text-4xl">{RANK_NAMES[view.tableRank]}&apos;s Table</h2>
          <p className="mt-1 text-sm text-white/70">Dealing five cards to each of {active} players…</p>
        </div>
      </div>
      <div className="mt-5"><LiarsDeckComposition deck={view.deck} tableRank={view.tableRank} /></div>
      <div className="mx-auto mt-4 h-1 max-w-xs overflow-hidden rounded-full bg-white/10" aria-hidden="true">
        <div className="h-full origin-left rounded-full bg-[#dfbd70] transition-transform duration-200 ease-linear" style={{ transform: `scaleX(${progress})` }} />
      </div>
    </div>
  );
}
