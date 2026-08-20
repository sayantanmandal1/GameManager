import { randomInt } from 'node:crypto';
import {
  ShutTheBoxAction,
  ShutTheBoxGameState,
  ShutTheBoxPlayerView,
  ShutTheBoxResult,
} from '../../../shared';
import { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';

export class ShutTheBoxEngine
  implements DistinctGameAdapter<ShutTheBoxGameState, ShutTheBoxAction, ShutTheBoxPlayerView, ShutTheBoxResult>
{
  readonly key = 'shut-the-box' as const;
  readonly rulesetId = 'shut-the-box.tiles-1-9-one-round.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 4;

  constructor(private readonly rollDie: () => number = () => randomInt(1, 7)) {}

  initGame(playerIds: string[], playerNames: Record<string, string>): ShutTheBoxGameState {
    this.requirePlayers(playerIds);
    return {
      players: playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}` })),
      openTiles: Object.fromEntries(playerIds.map((id) => [id, [1, 2, 3, 4, 5, 6, 7, 8, 9]])),
      scores: Object.fromEntries(playerIds.map((id) => [id, null])),
      currentTurnId: playerIds[0],
      roll: [],
      phase: 'rolling',
      winnerId: null,
      isDraw: false,
      finishReason: null,
    };
  }

  applyAction(
    state: ShutTheBoxGameState,
    playerId: string,
    action: ShutTheBoxAction,
  ): DistinctActionResult<ShutTheBoxResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    if (!action || typeof action !== 'object') return { valid: false, reason: 'Invalid action' };

    if (action.type === 'roll_box') {
      if (state.phase !== 'rolling') return { valid: false, reason: 'Close tiles before rolling again' };
      const tileSum = state.openTiles[playerId].reduce((sum, tile) => sum + tile, 0);
      const diceCount = tileSum <= 6 ? 1 : 2;
      state.roll = Array.from({ length: diceCount }, () => this.rollDie());
      if (this.legalCombinations(state).length === 0) return this.finishPersonalTurn(state, playerId);
      state.phase = 'closing';
      return { valid: true };
    }

    if (action.type !== 'close_tiles' || state.phase !== 'closing') {
      return { valid: false, reason: 'Roll before closing tiles' };
    }
    if (!Array.isArray(action.tiles) || action.tiles.length < 1 || action.tiles.length > 9 || new Set(action.tiles).size !== action.tiles.length || action.tiles.some((tile) => !Number.isInteger(tile) || tile < 1 || tile > 9)) {
      return { valid: false, reason: 'Invalid tile selection' };
    }
    const selected = [...action.tiles].sort((left, right) => left - right);
    const legal = this.legalCombinations(state).some((combination) => combination.length === selected.length && combination.every((tile, index) => tile === selected[index]));
    if (!legal) return { valid: false, reason: 'Tiles must be open and total the roll' };
    const selectedSet = new Set(selected);
    state.openTiles[playerId] = state.openTiles[playerId].filter((tile) => !selectedSet.has(tile));
    state.roll = [];
    if (state.openTiles[playerId].length === 0) return this.finishPersonalTurn(state, playerId);
    state.phase = 'rolling';
    return { valid: true };
  }

  getPlayerView(state: ShutTheBoxGameState, playerId: string): ShutTheBoxPlayerView {
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({ ...player })),
      youId: playerId,
      openTiles: Object.fromEntries(state.players.map((player) => [player.id, [...state.openTiles[player.id]]])),
      scores: { ...state.scores },
      currentTurnId: state.currentTurnId,
      roll: [...state.roll],
      phase: state.phase,
      winnerId: state.winnerId,
      isDraw: state.isDraw,
      canAct: state.phase !== 'finished' && state.currentTurnId === playerId,
      legalCombinations: state.phase === 'closing' && state.currentTurnId === playerId ? this.legalCombinations(state) : [],
    };
  }

  surrender(state: ShutTheBoxGameState, playerId: string): DistinctActionResult<ShutTheBoxResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    const index = state.players.findIndex((player) => player.id === playerId);
    if (index < 0) return { valid: false, reason: 'Player not found' };
    state.phase = 'finished';
    state.winnerId = state.players[(index + 1) % state.players.length].id;
    state.isDraw = false;
    state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: ShutTheBoxGameState): ShutTheBoxResult {
    if (!state.finishReason) throw new Error('Shut the Box game is not finished');
    return {
      gameKey: this.key,
      winnerId: state.winnerId,
      isDraw: state.isDraw,
      reason: state.finishReason,
      scores: Object.fromEntries(state.players.map((player) => [
        player.id,
        state.scores[player.id] ?? state.openTiles[player.id].reduce((sum, tile) => sum + tile, 0),
      ])),
    };
  }

  private legalCombinations(state: ShutTheBoxGameState): number[][] {
    const tiles = state.openTiles[state.currentTurnId];
    const target = state.roll.reduce((sum, die) => sum + die, 0);
    const combinations: number[][] = [];
    for (let mask = 1; mask < 1 << tiles.length; mask += 1) {
      const combination = tiles.filter((_, index) => (mask & (1 << index)) !== 0);
      if (combination.reduce((sum, tile) => sum + tile, 0) === target) combinations.push(combination);
    }
    return combinations;
  }

  private finishPersonalTurn(state: ShutTheBoxGameState, playerId: string): DistinctActionResult<ShutTheBoxResult> {
    state.scores[playerId] = state.openTiles[playerId].reduce((sum, tile) => sum + tile, 0);
    state.roll = [];
    const start = state.players.findIndex((player) => player.id === playerId);
    for (let offset = 1; offset <= state.players.length; offset += 1) {
      const candidate = state.players[(start + offset) % state.players.length];
      if (state.scores[candidate.id] === null) {
        state.currentTurnId = candidate.id;
        state.phase = 'rolling';
        return { valid: true };
      }
    }
    const numericScores = Object.fromEntries(state.players.map((player) => [player.id, state.scores[player.id]!])) as Record<string, number>;
    const low = Math.min(...Object.values(numericScores));
    const leaders = state.players.filter((player) => numericScores[player.id] === low);
    state.phase = 'finished';
    state.winnerId = leaders.length === 1 ? leaders[0].id : null;
    state.isDraw = leaders.length > 1;
    state.finishReason = 'round_complete';
    return { valid: true, result: this.getResult(state) };
  }

  private requirePlayers(playerIds: string[]): void {
    if (playerIds.length < this.minPlayers || playerIds.length > this.maxPlayers || new Set(playerIds).size !== playerIds.length) {
      throw new Error('Shut the Box requires two to four distinct players');
    }
  }
}