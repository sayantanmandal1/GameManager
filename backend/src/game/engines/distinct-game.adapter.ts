import type { DistinctGameKey } from '../../shared';

export enum DistinctGamePhase {
  PLAYING = 'playing',
  FINISHED = 'finished',
}

export interface DistinctGameResult {
  winnerId: string | null;
  isDraw: boolean;
  reason: string;
}

export interface DistinctActionResult<Result extends DistinctGameResult> {
  valid: boolean;
  reason?: string;
  result?: Result;
}

export interface DistinctAutomaticAction {
  playerId: string;
  action: object;
  delayMs: number;
}

export interface DistinctGameAdapter<
  State,
  Action,
  View,
  Result extends DistinctGameResult,
  Key extends string = DistinctGameKey,
> {
  readonly key: Key;
  readonly rulesetId: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;

  initGame(playerIds: string[], playerNames: Record<string, string>): State;
  applyAction(state: State, playerId: string, action: Action): DistinctActionResult<Result>;
  getPlayerView(state: State, playerId: string): View;
  getAutomaticAction?(state: State): DistinctAutomaticAction | null;
  surrender(state: State, playerId: string): DistinctActionResult<Result>;
  getResult(state: State): Result;
}

export interface RuntimeDistinctGameAdapter {
  readonly key: DistinctGameKey;
  readonly rulesetId: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;

  initGame(playerIds: string[], playerNames: Record<string, string>): object;
  applyAction(
    state: object,
    playerId: string,
    action: object,
  ): DistinctActionResult<DistinctGameResult>;
  getPlayerView(state: object, playerId: string): object;
  getAutomaticAction?(state: object): DistinctAutomaticAction | null;
  surrender(
    state: object,
    playerId: string,
  ): DistinctActionResult<DistinctGameResult>;
}

export function asRuntimeDistinctGameAdapter<State, Action, View, Result extends DistinctGameResult>(
  adapter: DistinctGameAdapter<State, Action, View, Result>,
): RuntimeDistinctGameAdapter {
  return adapter as unknown as RuntimeDistinctGameAdapter;
}