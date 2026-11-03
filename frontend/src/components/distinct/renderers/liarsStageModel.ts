import type { LiarsDeckPlayerView } from '@/shared';
import type { RouletteProgress } from './LiarsRoulette';
import { getLiarsBarCharacter, type LiarsBarCharacterId } from './liarsBarAssets';

export type StageBase = 'lobby' | 'idle' | 'look' | 'nocard' | 'dead' | 'win';
export type StageCardRank = 'A' | 'K' | 'Q' | 'joker' | 'devil';

export interface StageSeat {
  id: string;
  character: LiarsBarCharacterId;
  you: boolean;
}

export interface StageSnapshot {
  base: Record<string, StageBase>;
  hands: Record<string, number>;
  pile: number;
  focusId: string | null;
  reveal: StageCardRank[] | null;
  revealKey: string | null;
}

export const STAGE_TABLE_TOP = 0.83;

/** Round table sized for the player count; each seat sits just behind the rim, facing the centre. */
export function stageTableRadius(players: number) {
  return players > 4 ? 1.12 : 0.95;
}

export function stageSeatRadius(players: number) {
  return stageTableRadius(players) + 0.36;
}

/** Seat angles (radians, 0 = toward the camera / +Z) with the local player's seat in front. */
export function stageSeatAngles(players: number, youIndex: number) {
  const anchor = youIndex >= 0 ? youIndex : 0;
  return Array.from({ length: players }, (_, index) => (((index - anchor + players) % players) * Math.PI * 2) / players);
}

export function stageSeats(view: Pick<LiarsDeckPlayerView, 'players' | 'youId'>): StageSeat[] {
  return view.players.map((player, index) => ({ id: player.id, character: getLiarsBarCharacter(index).id, you: player.id === view.youId }));
}

export function stageSnapshot(view: LiarsDeckPlayerView, players: LiarsDeckPlayerView['players'], introActive: boolean, roulette: RouletteProgress): StageSnapshot {
  const base: Record<string, StageBase> = {};
  const hands: Record<string, number> = {};
  for (const player of players) {
    hands[player.id] = view.phase === 'setup' ? 0 : player.active ? player.handCount : 0;
    if (view.phase === 'setup') base[player.id] = 'lobby';
    else if (!player.active) base[player.id] = 'dead';
    else if (view.phase === 'finished' && view.winnerId === player.id) base[player.id] = 'win';
    else if (view.phase === 'playing' && !introActive && view.currentTurnId === player.id && player.handCount > 0) base[player.id] = 'look';
    else if (view.phase === 'playing' && !introActive && player.handCount === 0) base[player.id] = 'nocard';
    else base[player.id] = 'idle';
  }
  const reveal = view.lastReveal && (view.phase === 'reveal' || view.phase === 'finished') ? view.lastReveal : null;
  const shots = reveal?.shots ?? [];
  let focusId: string | null = null;
  if (view.phase === 'playing' && !introActive) focusId = view.currentTurnId;
  else if (reveal && roulette.active && roulette.step !== 'intro') focusId = shots[roulette.shotIndex]?.playerId ?? null;
  else if (reveal && roulette.active) focusId = reveal.callerId;
  else if (view.phase === 'finished') focusId = view.winnerId;
  return {
    base,
    hands,
    pile: view.phase === 'playing' ? view.pileCount : 0,
    focusId,
    reveal: reveal ? reveal.cards.map((card) => card.rank) : null,
    revealKey: reveal ? `${view.round}:${reveal.kind}:${reveal.callerId}:${reveal.cards.map((card) => card.id).join(',')}` : null,
  };
}
