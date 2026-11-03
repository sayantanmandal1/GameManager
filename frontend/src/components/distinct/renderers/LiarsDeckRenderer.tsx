'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiarsDeckAction, LiarsDeckCard, LiarsDeckPlayerView } from '@/shared';
import { Button } from '@/components/ui/Button';
import { LiarsCharacterAvatar } from './LiarsCharacterAvatar';
import { LiarTableScene } from './LiarTableScene';
import { playLiarsBarVoice } from './liarsBarAssets';
import { LiarsRouletteStage, useLiarsRoulette, withPendingShotsHidden } from './LiarsRoulette';
import { LiarsDeckRoundIntro, deckSummary, useServerCountdown } from './LiarsDeckRoundIntro';
import { LIARS_RANK_LABELS as RANK_LABELS, LiarsDeckCardFace, LiarsDeckSetupPanel, liarsRevealSummary, liarsRevealTitle } from './LiarsDeckPanels';
import { LiarsBarStage3D, useLiarsStageMode } from './LiarsBarStage3D';
import { useDistinctGameStore } from '@/stores/distinctGameStore';

export { LiarsDeckCardFace } from './LiarsDeckPanels';

const RULES_TEXT = 'Only the next player may challenge the latest claim. Any off-rank card makes a mixed claim a lie; Jokers always match. Empty hands are skipped. The last player still holding cards must challenge the previous claim. Chamber positions stay secret and do not reset between rounds. Each round opens by turning over the table card and announcing the deck: 20 cards for up to four players, 30 cards for five or six. Bluff is a separate game and is unchanged.';

export function LiarsDeckRenderer({ view, disabled, onAction }: Readonly<{
  view: LiarsDeckPlayerView; disabled: boolean; onAction: (action: LiarsDeckAction) => void;
}>) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { mode: stageMode, setPreferred } = useLiarsStageMode();
  const [stageFailed, setStageFailed] = useState(false);
  const stage3d = stageMode === 'on' && !stageFailed;
  const handleStageUnavailable = useCallback(() => setStageFailed(true), []);
  const claimSpeakerId = view.pendingClaim?.count === 3 ? view.pendingClaim.playerId : null;
  const claimSpeakerIndex = claimSpeakerId ? view.players.findIndex((player) => player.id === claimSpeakerId) : -1;
  const claimVoiceKey = claimSpeakerIndex >= 0 ? `${view.round}:${view.pileCount}:${claimSpeakerId}` : null;
  const lastClaimVoiceKey = useRef(claimVoiceKey);
  const roulette = useLiarsRoulette(view);
  const setPresentationHold = useDistinctGameStore((state) => state.setPresentationHold);
  const shots = view.lastReveal?.shots ?? [];
  const tablePlayers = withPendingShotsHidden(view.players, shots, roulette.resolvedCount);
  const introMs = useServerCountdown(view.phase === 'playing' ? `intro:${view.round}` : null, view.roundIntroRemainingMs ?? 0);
  const introActive = view.phase === 'playing' && introMs > 0;
  const nextRoundMs = useServerCountdown(view.phase === 'reveal' ? `next:${view.round}:${shots.length}` : null, view.nextRoundInMs ?? 0);
  const nextRoundLabel = nextRoundMs > 0 ? `Next round deals in ${Math.ceil(nextRoundMs / 1000)}s` : 'Dealing the next round…';
  useEffect(() => setPresentationHold(roulette.active), [roulette.active, setPresentationHold]);
  useEffect(() => () => setPresentationHold(false), [setPresentationHold]);
  useEffect(() => setSelectedIds([]), [view.round, view.currentTurnId, view.pileCount]);
  useEffect(() => {
    if (claimSpeakerIndex < 0 || !claimVoiceKey || claimVoiceKey === lastClaimVoiceKey.current) return;
    lastClaimVoiceKey.current = claimVoiceKey;
    if (!stage3d) playLiarsBarVoice(claimSpeakerIndex, 'threeCards');
  }, [claimSpeakerIndex, claimVoiceKey, stage3d]);
  const selected = view.yourHand.filter((card) => selectedIds.includes(card.id));
  const name = (id: string) => view.players.find((player) => player.id === id)?.name ?? 'Player';
  const toggle = (card: LiarsDeckCard) => {
    setSelectedIds((ids) => {
      if (ids.includes(card.id)) return ids.filter((id) => id !== card.id);
      if (card.rank === 'devil' || view.yourHand.some((entry) => entry.rank === 'devil' && ids.includes(entry.id))) return [card.id];
      return [...ids, card.id];
    });
  };

  const rules = <details className="rounded-2xl border border-white/10 p-4 text-sm text-white/65"><summary className="cursor-pointer font-semibold">Table rules</summary><p className="mt-3 leading-6">{RULES_TEXT}</p></details>;

  if (stage3d) return (
    <section className="w-full space-y-4" aria-label="Liar's Deck table">
      <LiarsBarStage3D view={view} disabled={disabled} onAction={onAction} roulette={roulette} tablePlayers={tablePlayers} introMs={introMs} introActive={introActive}
        nextRoundLabel={nextRoundLabel} selectedIds={selectedIds} onToggle={toggle} onUnavailable={handleStageUnavailable} onClassicView={() => setPreferred('2d')} />
      {rules}
    </section>
  );

  const viewToggle = stageMode === 'off' && <div className="flex justify-end"><button type="button" className="rounded-full border border-[#dfbd70]/30 px-3 py-1.5 text-xs font-semibold text-[#f2d18a] transition hover:bg-[#dfbd70]/10" onClick={() => setPreferred('3d')}>3D table</button></div>;

  if (view.phase === 'setup') return (
    <div className="w-full max-w-3xl space-y-3">
      {viewToggle}
      <LiarsDeckSetupPanel view={view} disabled={disabled} onAction={onAction} />
    </div>
  );

  return (
    <section className="w-full max-w-[64rem] space-y-4" aria-label="Liar's Deck table">
      {viewToggle}
      <LiarTableScene kind="deck" players={tablePlayers} youId={view.youId} currentTurnId={view.currentTurnId} round={view.round} tableCount={view.pileCount} />
      <div className={`grid grid-cols-2 gap-2 ${tablePlayers.length > 4 ? 'sm:grid-cols-3 lg:grid-cols-6' : 'sm:grid-cols-4'}`}>
        {tablePlayers.map((player, index) => <div key={player.id} className={`flex min-w-0 items-center gap-2 rounded-xl border p-2 transition-opacity duration-500 sm:gap-3 sm:p-3 ${view.currentTurnId === player.id && view.phase === 'playing' ? 'border-[#dfbd70]/70 bg-[#dfbd70]/10' : 'border-white/10 bg-black/15'} ${player.active ? '' : 'opacity-45'}`}>
          <LiarsCharacterAvatar playerIndex={index} playerName={player.name} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold" title={player.name}>{player.name}{player.id === view.youId ? ' · you' : ''}</p>
            <p className="mt-1 text-xs text-white/65">{player.active ? `${player.handCount} ${player.handCount === 1 ? 'card' : 'cards'} · ${player.pulls}/6 pulls` : 'Eliminated'}</p>
          </div>
        </div>)}
      </div>
      {introActive ? <LiarsDeckRoundIntro view={view} remainingMs={introMs} /> : <div className="rounded-2xl border border-[#dfbd70]/20 bg-black/20 p-4 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-[#dfbd70]">{view.mode === 'devil' ? 'Devil' : 'Classic'} · Round {view.round}</p>
        <h2 className="mt-1 text-2xl font-semibold">{RANK_LABELS[view.tableRank]}&apos;s table</h2>
        <p className="mt-2 text-sm text-white/65">{view.pendingClaim ? `${name(view.pendingClaim.playerId)} claims ${view.pendingClaim.count} ${RANK_LABELS[view.tableRank]}${view.pendingClaim.count === 1 ? '' : 's'}` : 'Open the round with one to three cards.'}</p>
        {view.deck && <p className="mt-2 text-xs text-white/50">Deck · {deckSummary(view.deck)}</p>}
      </div>}
      {view.phase === 'playing' && <>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-white/60">Your private hand</p>
          <div className="flex flex-wrap justify-center gap-2" aria-label="Your private hand">
            {view.yourHand.map((card, index) => <span key={card.id} className={introActive ? 'liars-deal-in' : undefined} style={introActive ? { animationDelay: `${index * 140}ms` } : undefined}><LiarsDeckCardFace card={card} selected={selectedIds.includes(card.id)} disabled={disabled || introActive || (selected.length >= 3 && !selectedIds.includes(card.id) && card.rank !== 'devil')} onClick={view.canPlay ? () => toggle(card) : undefined} /></span>)}
            {view.yourHand.length === 0 && <p className="py-4 text-sm text-white/65">{view.players.find((player) => player.id === view.youId)?.active ? 'Your hand is empty. You sit out until the next round.' : 'You are spectating this match.'}</p>}
          </div>
          {view.canPlay && !introActive && <p className="mt-3 text-xs text-white/65">{selected.length}/3 selected · cards are played face down</p>}
        </div>
        {view.forcedChallenge && <p role="status" className="text-center text-sm font-semibold text-[#f2d18a]">You hold the last hand. The previous claim must be challenged after a short pause.</p>}
        {view.canAct && <div className="flex flex-wrap justify-center gap-3">
          <Button disabled={disabled || introActive || !view.canPlay || selected.length < 1 || selected.length > 3} onClick={() => onAction({ type: 'play_liars_deck', cardIds: selected.map((card) => card.id) })}>Play selected</Button>
          <Button variant="danger" disabled={disabled || introActive || !view.canChallenge} onClick={() => onAction({ type: 'call_liars_deck' })}>Call Liar!</Button>
          {view.mode === 'devil' && <Button variant="secondary" disabled={disabled || introActive || !view.canDevilsDeal} onClick={() => onAction({ type: 'devils_deal' })}>Devil&apos;s Deal</Button>}
        </div>}
      </>}
      {view.lastReveal && (view.phase === 'reveal' || view.phase === 'finished') && <div className="rounded-2xl border border-[#d1af68]/30 bg-[#241c15] p-5 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-[#e5bd72]">{liarsRevealTitle(view.lastReveal)}</p>
        <div className="my-4 flex flex-wrap justify-center gap-2" aria-label="Revealed cards">{view.lastReveal.cards.map((card) => <LiarsDeckCardFace key={card.id} card={card} />)}</div>
        <p role="status" className="text-sm text-white/80">{liarsRevealSummary(view, view.lastReveal)}</p>
        {shots.length > 0 ? <LiarsRouletteStage view={view} progress={roulette} /> : <>
          <p className="mt-2 text-sm text-white/65">{view.lastReveal.riskPlayerIds.map(name).join(', ')} took a chamber risk.</p>
          {view.lastReveal.eliminatedIds.length > 0 && <p className="mt-2 text-sm text-red-300">Eliminated: {view.lastReveal.eliminatedIds.map(name).join(', ')}</p>}
        </>}
        {view.phase === 'reveal' && !roulette.active && <p role="timer" aria-live="off" className="mt-3 text-xs font-semibold text-[#e5bd72]">{nextRoundLabel}</p>}
        {view.phase === 'reveal' && !roulette.active && view.youId === view.hostId && <Button className="mt-4" disabled={disabled} variant="secondary" onClick={() => onAction({ type: 'next_liars_deck_round' })}>Next round</Button>}
      </div>}
      {view.phase === 'reveal' && !view.lastReveal && <div role="status" className="rounded-2xl border border-[#d1af68]/30 bg-[#241c15] p-5 text-center">
        <p className="text-sm text-white/80">A player resigned. The remaining players continue with a fresh round.</p>
        <p className="mt-2 text-xs font-semibold text-[#e5bd72]">{nextRoundLabel}</p>
        {view.youId === view.hostId && <Button className="mt-4" disabled={disabled} variant="secondary" onClick={() => onAction({ type: 'next_liars_deck_round' })}>Next round</Button>}
      </div>}
      {rules}
    </section>
  );
}
