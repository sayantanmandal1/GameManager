'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { LiarsDeckAction, LiarsDeckCard, LiarsDeckPlayerView } from '@/shared';
import { Button } from '@/components/ui/Button';
import { isNativeApp } from '@/lib/nativeApp';
import type { RouletteProgress } from './LiarsRoulette';
import { rouletteHeadline } from './LiarsRoulette';
import { LiarsDeckRoundIntro } from './LiarsDeckRoundIntro';
import { LIARS_RANK_LABELS, LiarsDeckCardFace, LiarsDeckSetupPanel, liarsRevealSummary, liarsRevealTitle } from './LiarsDeckPanels';
import {
  getLiarsBarCharacter, liarsBarClaimLines, playLiarsBarLines, playLiarsBarSfx, preloadLiarsBarSfx, randomLiarsBarLine,
  stopLiarsBarLines, stopLiarsBarMusic, type LiarsBarSfx,
} from './liarsBarAssets';
import { stageSeats, stageSnapshot } from './liarsStageModel';
import type { LiarsStageEngine, StageTagPosition } from './liarsStageEngine';

const VIEW_KEY = 'gameverse:liars-deck-view';
const VIEW_EVENT = 'gameverse:liars-deck-view';
const DESKTOP_QUERY = '(min-width: 1024px) and (hover: hover) and (pointer: fine)';
const PRELOAD: LiarsBarSfx[] = ['card-flip', 'card-pick', 'card-throw', 'fist-table', 'head-fall', 'last-round', 'liar-strike', 'new-round', 'reload', 'roulette-sting', 'ui-click', 'ui-hover'];
let webglSupport: boolean | null = null;

function hasWebGL() {
  if (webglSupport !== null) return webglSupport;
  try {
    const canvas = document.createElement('canvas');
    webglSupport = !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

function stageMode(): 'unsupported' | 'on' | 'off' {
  if (typeof window === 'undefined' || /jsdom/i.test(navigator.userAgent) || isNativeApp()) return 'unsupported';
  if (!window.matchMedia?.(DESKTOP_QUERY).matches || !hasWebGL()) return 'unsupported';
  try {
    return window.localStorage.getItem(VIEW_KEY) === '2d' ? 'off' : 'on';
  } catch {
    return 'on';
  }
}

function subscribeStageMode(onChange: () => void) {
  const media = window.matchMedia?.(DESKTOP_QUERY);
  media?.addEventListener?.('change', onChange);
  window.addEventListener('storage', onChange);
  window.addEventListener(VIEW_EVENT, onChange);
  return () => {
    media?.removeEventListener?.('change', onChange);
    window.removeEventListener('storage', onChange);
    window.removeEventListener(VIEW_EVENT, onChange);
  };
}

/** Desktop browsers get the 3D bar table; phones, tablets, the Android app and tests keep the 2D table. */
export function useLiarsStageMode() {
  const mode = useSyncExternalStore(subscribeStageMode, stageMode, () => 'unsupported' as const);
  const setPreferred = useCallback((preferred: '2d' | '3d') => {
    try {
      window.localStorage.setItem(VIEW_KEY, preferred);
    } catch {
      // Private browsing: the choice lasts for this page only.
    }
    window.dispatchEvent(new Event(VIEW_EVENT));
  }, []);
  return { mode, setPreferred };
}

export interface LiarsStageProps {
  view: LiarsDeckPlayerView;
  disabled: boolean;
  onAction: (action: LiarsDeckAction) => void;
  roulette: RouletteProgress;
  tablePlayers: LiarsDeckPlayerView['players'];
  introMs: number;
  introActive: boolean;
  nextRoundLabel: string;
  selectedIds: string[];
  onToggle: (card: LiarsDeckCard) => void;
  onUnavailable: () => void;
  onClassicView: () => void;
}

function useCue(key: string | null, run: (key: string) => void) {
  const last = useRef(key);
  const latest = useRef(run);
  useEffect(() => {
    latest.current = run;
  });
  useEffect(() => {
    if (key === last.current) return;
    last.current = key;
    if (key) latest.current(key);
  }, [key]);
}

export function LiarsBarStage3D(props: Readonly<LiarsStageProps>) {
  const { view, roulette, tablePlayers, introActive, onUnavailable } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<LiarsStageEngine | null>(null);
  const tagRefs = useRef(new Map<string, HTMLDivElement>());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const [engineReady, setEngineReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(0);

  const seats = useMemo(() => stageSeats({ players: view.players, youId: view.youId }), [view.players, view.youId]);
  const seatsKey = seats.map((seat) => `${seat.id}:${seat.character}:${seat.you ? 1 : 0}`).join('|');
  const snapshot = stageSnapshot(view, tablePlayers, introActive, roulette);
  const snapshotKey = JSON.stringify(snapshot);
  const snapshotRef = useRef(snapshot);
  const seatsRef = useRef(seats);
  useEffect(() => {
    snapshotRef.current = snapshot;
    seatsRef.current = seats;
  });

  const later = useCallback((ms: number, run: () => void) => {
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      run();
    }, ms);
    timers.current.add(timer);
  }, []);

  useEffect(() => {
    preloadLiarsBarSfx(PRELOAD);
    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
      stopLiarsBarLines();
      stopLiarsBarMusic();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let engine: LiarsStageEngine | null = null;
    import('./liarsStageEngine').then(({ LiarsStageEngine }) => {
      if (cancelled) return;
      engine = new LiarsStageEngine(canvas, {
        onSound: (name, volume) => playLiarsBarSfx(name, volume),
        onTags: (positions: Map<string, StageTagPosition>) => {
          const boxes: Array<{ tag: HTMLDivElement; x: number; y: number; w: number; h: number }> = [];
          for (const [id, position] of positions) {
            const tag = tagRefs.current.get(id);
            if (!tag) continue;
            const display = position.visible ? '' : 'none';
            if (tag.style.display !== display) tag.style.display = display;
            const stage = tag.parentElement;
            if (!position.visible || !stage) continue;
            // Keep tags fully inside the stage and below the title / 2D-view row.
            const w = tag.offsetWidth;
            const h = tag.offsetHeight;
            const half = w / 2 + 12;
            const x = Math.min(Math.max(position.x * stage.clientWidth, half), stage.clientWidth - half);
            const y = Math.min(Math.max(position.y * stage.clientHeight, 118), stage.clientHeight - 240);
            boxes.push({ tag, x, y, w, h });
          }
          // Seats near the frame edge clamp to the same spot; stack them instead of overlapping.
          boxes.sort((a, b) => a.y - b.y);
          for (let index = 0; index < boxes.length; index += 1) {
            const box = boxes[index];
            for (let other = 0; other < index; other += 1) {
              const placed = boxes[other];
              const overlapX = Math.abs(box.x - placed.x) < (box.w + placed.w) / 2 + 6;
              const overlapY = Math.abs(box.y - placed.y) < (box.h + placed.h) / 2 + 4;
              if (overlapX && overlapY) {
                box.y = placed.y + placed.h + 6;
                other = -1;
              }
            }
            box.tag.style.left = `${box.x.toFixed(1)}px`;
            box.tag.style.top = `${box.y.toFixed(1)}px`;
          }
        },
        onLost: onUnavailable,
      });
      engineRef.current = engine;
      setEngineReady(true);
    }).catch(onUnavailable);
    return () => {
      cancelled = true;
      engine?.dispose();
      engineRef.current = null;
    };
  }, [onUnavailable]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engineReady || !engine) return;
    let cancelled = false;
    engine.setSeats(seatsRef.current, (fraction) => { if (!cancelled) setProgress(fraction); }).then(() => {
      if (cancelled) return;
      engine.applyInstant(snapshotRef.current);
      setLoaded(true);
    }).catch(() => { if (!cancelled) onUnavailable(); });
    return () => { cancelled = true; };
  }, [engineReady, seatsKey, onUnavailable]);

  useEffect(() => {
    if (loaded) engineRef.current?.apply(snapshotRef.current);
  }, [loaded, snapshotKey]);

  const characterOf = useCallback((id: string) => getLiarsBarCharacter(view.players.findIndex((player) => player.id === id)).id, [view.players]);
  const say = useCallback((id: string, urls: Array<string | null> | null, delay = 0) => {
    const lines = (urls ?? []).filter((url): url is string => !!url);
    if (!lines.length || !view.players.some((player) => player.id === id)) return;
    if (delay) later(delay, () => playLiarsBarLines(lines));
    else playLiarsBarLines(lines);
  }, [later, view.players]);

  const claimKey = view.phase === 'playing' && view.pendingClaim ? `${view.round}:${view.pileCount}:${view.pendingClaim.playerId}:${view.pendingClaim.count}` : null;
  useCue(claimKey, () => {
    const claim = view.pendingClaim;
    if (!claim) return;
    engineRef.current?.throwCards(claim.playerId, claim.count);
    say(claim.playerId, liarsBarClaimLines(characterOf(claim.playerId), claim.count, view.tableRank), 450);
    if (claim.count === 3 && view.currentTurnId && view.currentTurnId !== claim.playerId) {
      say(view.currentTurnId, [randomLiarsBarLine(characterOf(view.currentTurnId), 'bold')], 2300);
    }
  });

  const reveal = view.lastReveal && (view.phase === 'reveal' || view.phase === 'finished') ? view.lastReveal : null;
  const revealKey = reveal ? `${view.round}:${reveal.kind}:${reveal.callerId}:${reveal.claimantId}:${reveal.cards.map((card) => card.id).join(',')}` : null;
  useCue(revealKey, () => {
    if (!reveal) return;
    stopLiarsBarLines();
    if (reveal.kind === 'devils_deal') {
      say(reveal.callerId, [randomLiarsBarLine(characterOf(reveal.callerId), 'devil')]);
      later(200, () => playLiarsBarSfx('liar-strike', 0.6));
      return;
    }
    engineRef.current?.callLiar(reveal.callerId);
    say(reveal.callerId, [randomLiarsBarLine(characterOf(reveal.callerId), 'liar')]);
    later(380, () => playLiarsBarSfx('liar-strike', 0.6));
    if (reveal.kind === 'devil') say(reveal.claimantId, [randomLiarsBarLine(characterOf(reveal.claimantId), 'devil')], 1700);
  });

  const shots = reveal?.shots ?? [];
  const shooter = roulette.active && roulette.step !== 'intro' ? shots[roulette.shotIndex] : null;
  const rouletteKey = roulette.active ? `${revealKey}:${roulette.shotIndex}:${roulette.step}` : null;
  useCue(rouletteKey, () => {
    if (roulette.step === 'intro') {
      playLiarsBarSfx('roulette-sting', 0.55);
      return;
    }
    if (!shooter) return;
    if (roulette.step === 'spin') {
      engineRef.current?.aim(shooter.playerId);
      say(shooter.playerId, [randomLiarsBarLine(characterOf(shooter.playerId), 'preshot')], 300);
    } else if (roulette.step === 'result') {
      if (shooter.fired) {
        stopLiarsBarLines();
        engineRef.current?.fire(shooter.playerId);
      } else {
        engineRef.current?.click(shooter.playerId);
        say(shooter.playerId, [randomLiarsBarLine(characterOf(shooter.playerId), 'relief')], 700);
      }
    }
  });

  const introKey = introActive ? `intro:${view.round}` : null;
  useCue(introKey, () => {
    const active = view.players.filter((player) => player.active);
    playLiarsBarSfx('new-round', 0.6);
    if (view.round === 1) {
      later(350, () => playLiarsBarSfx('reload', 0.55));
      engineRef.current?.reload(active.map((player) => player.id), 3.2);
    } else if (active.length === 2) {
      later(1100, () => playLiarsBarSfx('last-round', 0.6));
    }
  });

  const openingKey = view.phase === 'playing' && !introActive && !view.pendingClaim && view.currentTurnId ? `open:${view.round}:${view.currentTurnId}` : null;
  useCue(openingKey, () => {
    if (Math.random() < 0.6) say(view.currentTurnId, [randomLiarsBarLine(characterOf(view.currentTurnId), 'turn')], 250);
  });

  const winnerKey = view.phase === 'finished' && !roulette.active && view.winnerId ? `win:${view.winnerId}` : null;
  useCue(winnerKey, () => later(400, () => playLiarsBarSfx('winner', 0.45)));

  return (
    <div className="relative isolate w-full overflow-hidden rounded-[28px] border border-[#d1af68]/20 bg-[#0a0705] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]" style={{ height: 'clamp(560px, 76vh, 820px)' }} data-liars-stage={loaded ? 'ready' : 'loading'}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.6)_100%)]" aria-hidden="true" />
      {seats.filter((seat) => !seat.you).map((seat) => {
        const player = tablePlayers.find((entry) => entry.id === seat.id);
        if (!player) return null;
        const current = view.phase === 'playing' && !introActive && view.currentTurnId === seat.id;
        return <div key={seat.id} ref={(node) => { if (node) tagRefs.current.set(seat.id, node); else tagRefs.current.delete(seat.id); }} className="pointer-events-none absolute -translate-x-1/2 -translate-y-full transition-opacity duration-300" style={{ display: 'none', opacity: loaded ? 1 : 0 }} data-liars-tag={seat.id}>
          <div className={`whitespace-nowrap rounded-full border px-3 py-1 text-center text-xs font-bold shadow-lg backdrop-blur-sm ${current ? 'border-[#f2d18a] bg-[#f2d18a]/90 text-[#1b130b]' : player.active ? 'border-white/15 bg-black/55 text-white/90' : 'border-red-400/30 bg-black/55 text-red-200/80 line-through'}`}>
            {player.name}
            {view.phase !== 'setup' && <span className="ml-2 font-semibold opacity-75">{player.active ? `${player.handCount} ${player.handCount === 1 ? 'card' : 'cards'} · ${player.pulls}/6` : 'out'}</span>}
          </div>
        </div>;
      })}
      <StageHud {...props} />
      <div className={`pointer-events-none absolute inset-0 grid place-items-center bg-[#0a0705] transition-opacity duration-500 ${loaded ? 'opacity-0' : 'opacity-100'}`} aria-hidden={loaded}>
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#dfbd70]">Liar&apos;s Bar</p>
          <p className="mt-3 text-lg font-semibold text-white/85">Setting the table…</p>
          <div className="mx-auto mt-4 h-1 w-56 overflow-hidden rounded-full bg-white/10"><div className="h-full origin-left rounded-full bg-[#dfbd70] transition-transform duration-300" style={{ transform: `scaleX(${Math.max(0.04, progress)})` }} /></div>
        </div>
      </div>
    </div>
  );
}

function hover() {
  playLiarsBarSfx('ui-hover', 0.22);
}

function StageHud({ view, disabled, onAction, roulette, tablePlayers, introMs, introActive, nextRoundLabel, selectedIds, onToggle, onClassicView }: Readonly<LiarsStageProps>) {
  const name = (id: string) => view.players.find((player) => player.id === id)?.name ?? 'Player';
  const you = tablePlayers.find((player) => player.id === view.youId);
  const selected = view.yourHand.filter((card) => selectedIds.includes(card.id));
  const reveal = view.lastReveal && (view.phase === 'reveal' || view.phase === 'finished') ? view.lastReveal : null;
  const shots = reveal?.shots ?? [];
  const act = (action: LiarsDeckAction) => {
    playLiarsBarSfx('ui-click', 0.5);
    onAction(action);
  };
  const handCount = view.yourHand.length;
  let status = '';
  if (view.phase === 'playing' && !introActive) {
    const claim = view.pendingClaim ? `${name(view.pendingClaim.playerId)} claims ${view.pendingClaim.count} ${LIARS_RANK_LABELS[view.tableRank]}${view.pendingClaim.count === 1 ? '' : 's'}` : null;
    const turn = view.currentTurnId === view.youId ? 'Your turn' : `${name(view.currentTurnId)} is deciding…`;
    status = claim ? `${claim} · ${turn}` : `${turn} · open with one to three cards`;
  }

  return <div className="absolute inset-0 flex flex-col">
    <div className="pointer-events-none flex items-start justify-between gap-4 p-4">
      <div className="rounded-2xl border border-[#dfbd70]/25 bg-black/50 px-4 py-2 backdrop-blur-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#dfbd70]/85">{view.mode === 'devil' ? 'Devil' : view.mode === 'classic' ? 'Classic' : 'Lobby'}{view.phase !== 'setup' ? ` · Round ${view.round}` : ''}</p>
        {view.phase !== 'setup' && <p className="font-serif text-2xl font-bold uppercase tracking-wide text-[#f6dca0]">{LIARS_RANK_LABELS[view.tableRank]}&apos;s Table</p>}
      </div>
      <button type="button" className="pointer-events-auto rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-xs font-semibold text-white/75 backdrop-blur-sm transition hover:bg-black/70 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#dfbd70]" onClick={onClassicView}>2D view</button>
    </div>

    <div className={`pointer-events-none flex flex-1 justify-center px-6 ${reveal ? 'items-end pb-4' : 'items-center'}`}>
      {view.phase === 'setup' && <div className="pointer-events-auto w-full max-w-2xl"><LiarsDeckSetupPanel view={view} disabled={disabled} onAction={act} className="border-[#d1af68]/35 bg-[#16110c]/90 backdrop-blur-md" /></div>}
      {introActive && <div className="pointer-events-auto w-full max-w-xl opacity-95"><LiarsDeckRoundIntro view={view} remainingMs={introMs} /></div>}
      {reveal && <div className="pointer-events-auto flex w-full max-w-3xl items-center gap-5 rounded-3xl border border-[#d1af68]/30 bg-[#140f0b]/80 px-5 py-4 shadow-2xl backdrop-blur-md">
        <div className="flex shrink-0 -space-x-4" aria-label="Revealed cards">{reveal.cards.map((card, index) => <span key={card.id} style={{ transform: `rotate(${(index - (reveal.cards.length - 1) / 2) * 6}deg)` }}><LiarsDeckCardFace card={card} /></span>)}</div>
        <div className="min-w-0 flex-1 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-[#e5bd72]">{liarsRevealTitle(reveal)}</p>
        <p role="status" className="mt-1 text-sm text-white/85">{liarsRevealSummary(view, reveal)}</p>
        {shots.length > 0 ? <>
          <p aria-live="assertive" className={`mt-2 text-lg font-bold ${roulette.active && roulette.step === 'result' ? (shots[roulette.shotIndex]?.fired ? 'text-red-300' : 'text-emerald-200') : 'text-[#f2d18a]'}`} data-roulette-step={roulette.active ? roulette.step : 'done'}>{rouletteHeadline(view, roulette)}</p>
          <ol className="mt-2 flex flex-wrap justify-center gap-2" aria-label="Trigger pulls">
            {shots.map((shot, index) => {
              const done = index < roulette.resolvedCount;
              const label = done ? (shot.fired ? 'Shot' : 'Click') : 'Waiting';
              return <li key={shot.playerId} className={`rounded-full border px-3 py-1 text-xs font-semibold ${done ? (shot.fired ? 'border-red-400/50 bg-red-500/15 text-red-200' : 'border-emerald-300/40 bg-emerald-400/10 text-emerald-100') : 'border-white/15 text-white/60'}`}>{name(shot.playerId)} · pull {shot.pull}/6 · {label}</li>;
            })}
          </ol>
        </> : <p className="mt-2 text-sm text-white/65">{reveal.riskPlayerIds.map(name).join(', ')} took a chamber risk.</p>}
        {view.phase === 'finished' && !roulette.active && view.winnerId && <p className="mt-2 font-serif text-2xl font-bold text-[#f6dca0]">{view.winnerId === view.youId ? 'You are the last one standing' : `${name(view.winnerId)} wins the table`}</p>}
        </div>
        {view.phase === 'reveal' && !roulette.active && <div className="flex w-36 shrink-0 flex-col items-stretch gap-2 text-center">
          <p role="timer" aria-live="off" className="text-xs font-semibold text-[#e5bd72]">{nextRoundLabel}</p>
          {view.youId === view.hostId && <Button disabled={disabled} variant="secondary" onMouseEnter={hover} onClick={() => act({ type: 'next_liars_deck_round' })}>Next round</Button>}
        </div>}
      </div>}
      {view.phase === 'reveal' && !view.lastReveal && <div role="status" className="pointer-events-auto rounded-3xl border border-[#d1af68]/30 bg-[#140f0b]/85 p-5 text-center backdrop-blur-md">
        <p className="text-sm text-white/85">A player resigned. The remaining players continue with a fresh round.</p>
        <p className="mt-2 text-xs font-semibold text-[#e5bd72]">{nextRoundLabel}</p>
        {view.youId === view.hostId && <Button className="mt-4" disabled={disabled} variant="secondary" onClick={() => act({ type: 'next_liars_deck_round' })}>Next round</Button>}
      </div>}
    </div>

    {view.phase === 'playing' && <div className="relative px-4 pb-4">
      {status && !view.forcedChallenge && <p role="status" className="mx-auto mb-2 w-fit rounded-full border border-white/10 bg-black/60 px-4 py-1.5 text-center text-sm font-semibold text-white/90 backdrop-blur-sm">{status}</p>}
      {view.forcedChallenge && <p role="status" className="mx-auto mb-2 w-fit rounded-full bg-black/60 px-4 py-1 text-center text-sm font-semibold text-[#f2d18a]">You hold the last hand. The previous claim must be challenged.</p>}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-[9rem] rounded-2xl border border-white/10 bg-black/55 px-3 py-2 text-xs text-white/80 backdrop-blur-sm">
          <p className="font-bold text-white">{you ? `${you.name} · you` : 'Spectating'}</p>
          {you && <p className="mt-0.5">{you.active ? `${you.pulls}/6 pulls taken` : 'Eliminated'}</p>}
        </div>
        <div className="flex flex-1 flex-col items-center">
          <div className="flex items-end justify-center" aria-label="Your private hand" style={{ minHeight: '7rem' }}>
            {view.yourHand.map((card, index) => {
              const offset = index - (handCount - 1) / 2;
              const chosen = selectedIds.includes(card.id);
              return <span key={card.id} className={`-mx-1 transition-transform duration-200 ease-out hover:-translate-y-2 ${introActive ? 'liars-deal-in' : ''}`} style={{ transform: `rotate(${offset * 5}deg) translateY(${Math.abs(offset) * 5 - (chosen ? 18 : 0)}px)`, animationDelay: introActive ? `${index * 140}ms` : undefined }}>
                <LiarsDeckCardFace card={card} selected={chosen} disabled={disabled || introActive || (selected.length >= 3 && !chosen && card.rank !== 'devil')} onClick={view.canPlay ? () => { playLiarsBarSfx('card-pick', 0.5); onToggle(card); } : undefined} />
              </span>;
            })}
            {handCount === 0 && <p className="rounded-full bg-black/55 px-4 py-2 text-sm text-white/75">{you?.active ? 'Your hand is empty. You sit out until the next round.' : 'You are spectating this match.'}</p>}
          </div>
          {view.canPlay && !introActive && <p className="mt-1 text-xs text-white/70">{selected.length}/3 selected · played face down</p>}
        </div>
        <div className="flex min-w-[9rem] flex-col items-stretch gap-2">
          {view.canAct && <>
            <Button disabled={disabled || introActive || !view.canPlay || selected.length < 1 || selected.length > 3} onMouseEnter={hover} onClick={() => act({ type: 'play_liars_deck', cardIds: selected.map((card) => card.id) })}>Play selected</Button>
            <Button variant="danger" disabled={disabled || introActive || !view.canChallenge} onMouseEnter={hover} onClick={() => act({ type: 'call_liars_deck' })}>Call Liar!</Button>
            {view.mode === 'devil' && <Button variant="secondary" disabled={disabled || introActive || !view.canDevilsDeal} onMouseEnter={hover} onClick={() => act({ type: 'devils_deal' })}>Devil&apos;s Deal</Button>}
          </>}
        </div>
      </div>
    </div>}
  </div>;
}
