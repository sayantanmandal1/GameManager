'use client';

import { useEffect, useRef, useState } from 'react';
import { LIARS_DECK_ROULETTE_TIMING, type LiarsDeckPlayerView, type LiarsDeckShot } from '@/shared';
import { playLiarsBarHeartbeat, playLiarsBarSfx, stopLiarsBarHeartbeat } from './liarsBarAssets';
import { LiarsCharacterAvatar } from './LiarsCharacterAvatar';

export type RouletteStep = 'intro' | 'spin' | 'trigger' | 'result';
export interface RouletteProgress {
  active: boolean;
  shotIndex: number;
  step: RouletteStep;
  /** Number of shots whose outcome may be shown. */
  resolvedCount: number;
}

const STEP_ORDER: RouletteStep[] = ['spin', 'trigger', 'result'];
const STEP_MS: Record<RouletteStep, number> = {
  intro: LIARS_DECK_ROULETTE_TIMING.introMs,
  spin: LIARS_DECK_ROULETTE_TIMING.spinMs,
  trigger: LIARS_DECK_ROULETTE_TIMING.triggerMs,
  result: LIARS_DECK_ROULETTE_TIMING.resultMs,
};

function revealKeyOf(view: LiarsDeckPlayerView): string | null {
  const reveal = view.lastReveal;
  if (!reveal || (view.phase !== 'reveal' && view.phase !== 'finished')) return null;
  const shots = (reveal.shots ?? []).map((shot) => `${shot.playerId}.${shot.pull}`).join(',');
  return `${view.round}:${reveal.kind}:${reveal.callerId}:${reveal.claimantId}:${shots}`;
}

/**
 * Drives the trigger-pull sequence for the latest reveal. Reveals already on screen when the
 * table mounts (reload, late join) are shown settled so finished games never replay.
 * With `gunAudio` off the 3D stage plays cock/shot/click itself, synced to the original clips.
 */
export function useLiarsRoulette(view: LiarsDeckPlayerView, { gunAudio = true }: { gunAudio?: boolean } = {}): RouletteProgress {
  const revealKey = revealKeyOf(view);
  const shots = view.lastReveal?.shots ?? [];
  const [mountedKey] = useState(revealKey);
  const [progress, setProgress] = useState<{ key: string | null; step: number }>({ key: null, step: 0 });
  const animate = !!revealKey && revealKey !== mountedKey && shots.length > 0;
  const totalSteps = animate ? 1 + shots.length * STEP_ORDER.length : 0;
  const step = progress.key === revealKey ? progress.step : 0;
  const active = animate && step < totalSteps;
  const shotIndex = step === 0 ? 0 : Math.floor((step - 1) / STEP_ORDER.length);
  const stepName: RouletteStep = step === 0 ? 'intro' : STEP_ORDER[(step - 1) % STEP_ORDER.length];
  const firedAtCurrent = shots[shotIndex]?.fired ?? false;

  useEffect(() => {
    if (!active || !revealKey) return;
    if (stepName === 'intro') {
      if (gunAudio) playLiarsBarSfx('roulette-sting', 0.55);
    } else if (gunAudio && stepName === 'trigger') playLiarsBarSfx('revolver-cock', 0.55);
    else if (gunAudio && stepName === 'result') playLiarsBarSfx(firedAtCurrent ? 'gunshot' : 'dry-fire', firedAtCurrent ? 0.72 : 0.8);
    const timer = setTimeout(() => setProgress({ key: revealKey, step: step + 1 }), STEP_MS[stepName]);
    return () => clearTimeout(timer);
  }, [active, firedAtCurrent, gunAudio, revealKey, step, stepName]);

  // The original game has no roulette heartbeat (its CountDown loop is the turn timer), so the 3D stage skips it.
  useEffect(() => {
    if (gunAudio && active && (stepName === 'spin' || stepName === 'trigger')) playLiarsBarHeartbeat();
    else stopLiarsBarHeartbeat();
  }, [active, gunAudio, stepName]);

  useEffect(() => () => stopLiarsBarHeartbeat(), []);

  let resolvedCount = shots.length;
  if (active) resolvedCount = stepName === 'result' ? shotIndex + 1 : shotIndex;
  return { active, shotIndex, step: stepName, resolvedCount };
}

/** Hides outcomes of trigger pulls that have not been animated yet. */
export function withPendingShotsHidden(players: LiarsDeckPlayerView['players'], shots: LiarsDeckShot[], resolvedCount: number) {
  const pending = new Set(shots.slice(resolvedCount).map((shot) => shot.playerId));
  if (pending.size === 0) return players;
  return players.map((player) => (pending.has(player.id) ? { ...player, pulls: Math.max(0, player.pulls - 1), active: true } : player));
}

/** Narration for the current trigger pull, or the final outcome once every pull has been shown. */
export function rouletteHeadline(view: LiarsDeckPlayerView, progress: RouletteProgress) {
  const shots = view.lastReveal?.shots ?? [];
  const name = (id: string) => view.players.find((player) => player.id === id)?.name ?? 'Player';
  const current = progress.active && progress.step !== 'intro' ? shots[progress.shotIndex] : null;
  if (current) {
    const who = current.playerId === view.youId ? 'You' : name(current.playerId);
    if (progress.step === 'spin') return `${who} spin${who === 'You' ? '' : 's'} the cylinder`;
    if (progress.step === 'trigger') return `${who} pull${who === 'You' ? '' : 's'} the trigger…`;
    return current.fired ? `BANG — ${name(current.playerId)} is out` : `Click — ${name(current.playerId)} survives`;
  }
  if (!progress.active) {
    const eliminated = shots.filter((shot) => shot.fired).map((shot) => name(shot.playerId));
    return eliminated.length ? `Eliminated: ${eliminated.join(', ')}` : 'Every chamber was empty. Everyone survives.';
  }
  return `${shots.length === 1 ? name(shots[0].playerId) : `${shots.length} players`} must face the revolver`;
}

function Cylinder({ spinning, chamberLit, fired }: Readonly<{ spinning: boolean; chamberLit: boolean; fired: boolean }>) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" className={`h-28 w-28 sm:h-36 sm:w-36 ${spinning ? 'liars-cylinder-spin' : ''}`}>
      <defs>
        <radialGradient id="liars-steel" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#d9d4cb" />
          <stop offset="55%" stopColor="#7d766d" />
          <stop offset="100%" stopColor="#2d2924" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="54" fill="url(#liars-steel)" stroke="#1b1814" strokeWidth="3" />
      {Array.from({ length: 6 }, (_, index) => {
        const angle = (index * Math.PI) / 3 - Math.PI / 2;
        const top = index === 0;
        let fill = '#141210';
        if (top && chamberLit) fill = fired ? '#e2492f' : '#3b342c';
        return <circle key={index} cx={60 + Math.cos(angle) * 31} cy={60 + Math.sin(angle) * 31} r="12" fill={fill} stroke="#0b0a09" strokeWidth="2" />;
      })}
      <circle cx="60" cy="60" r="8" fill="#2b2622" stroke="#0b0a09" strokeWidth="2" />
    </svg>
  );
}

export function LiarsRouletteStage({ view, progress }: Readonly<{ view: LiarsDeckPlayerView; progress: RouletteProgress }>) {
  const stageRef = useRef<HTMLDivElement>(null);
  const startedSequence = progress.active && progress.step === 'intro';
  useEffect(() => {
    const stage = stageRef.current;
    if (!startedSequence || !stage) return;
    const bounds = stage.getBoundingClientRect();
    if (bounds.top >= 0 && bounds.bottom <= window.innerHeight) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    stage.scrollIntoView?.({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
  }, [startedSequence]);
  const reveal = view.lastReveal;
  const shots = reveal?.shots ?? [];
  if (!reveal || shots.length === 0) return null;
  const name = (id: string) => view.players.find((player) => player.id === id)?.name ?? 'Player';
  const seat = (id: string) => view.players.findIndex((player) => player.id === id);
  const current = progress.active && progress.step !== 'intro' ? shots[progress.shotIndex] : null;
  const showOutcome = progress.step === 'result';
  const headline = rouletteHeadline(view, progress);

  return (
    <div ref={stageRef} className="relative mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/35 px-3 py-4 sm:px-5" data-roulette-step={progress.active ? progress.step : 'done'}>
      {current && showOutcome && current.fired && <div aria-hidden="true" className="liars-muzzle-flash pointer-events-none absolute inset-0" />}
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-6">
        {current && <div className={`flex flex-col items-center gap-1 ${progress.step === 'trigger' ? 'liars-trigger-tension' : ''}`}>
          <LiarsCharacterAvatar playerIndex={seat(current.playerId)} playerName={name(current.playerId)} />
          <p className="text-xs font-bold text-white/80">Pull {current.pull} of 6</p>
        </div>}
        <Cylinder spinning={progress.step === 'spin' && !!current} chamberLit={!!current && showOutcome} fired={!!current?.fired} />
      </div>
      <p aria-live="assertive" className={`mt-3 text-center text-base font-bold sm:text-lg ${current && showOutcome ? (current.fired ? 'text-red-300' : 'text-emerald-200') : 'text-[#f2d18a]'}`}>{headline}</p>
      <ol className="mt-3 flex flex-wrap justify-center gap-2" aria-label="Trigger pulls">
        {shots.map((shot, index) => {
          const done = index < progress.resolvedCount;
          let label = 'Waiting';
          if (done) label = shot.fired ? 'Shot' : 'Click';
          return <li key={shot.playerId} className={`rounded-full border px-3 py-1 text-xs font-semibold ${done ? (shot.fired ? 'border-red-400/50 bg-red-500/15 text-red-200' : 'border-emerald-300/40 bg-emerald-400/10 text-emerald-100') : 'border-white/15 text-white/60'}`}>
            {name(shot.playerId)} · pull {shot.pull}/6 · {label}
          </li>;
        })}
      </ol>
    </div>
  );
}
