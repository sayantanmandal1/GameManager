import { randomInt } from 'node:crypto';
import {
  LiarsDiceAction,
  LiarsDiceGameState,
  LiarsDicePlayerView,
  LiarsDiceResult,
} from '../../../shared';
import { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';

export class LiarsDiceEngine
  implements DistinctGameAdapter<LiarsDiceGameState, LiarsDiceAction, LiarsDicePlayerView, LiarsDiceResult>
{
  readonly key = 'liars-dice' as const;
  readonly rulesetId = 'liars-dice.five-dice-ascending-bids.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 6;

  constructor(private readonly rollDie: () => number = () => randomInt(1, 7)) {}

  initGame(playerIds: string[], playerNames: Record<string, string>): LiarsDiceGameState {
    this.requirePlayers(playerIds);
    return {
      players: playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}` })),
      dice: Object.fromEntries(playerIds.map((id) => [id, this.rollDice(5)])),
      currentTurnId: playerIds[0],
      currentBid: null,
      round: 1,
      phase: 'playing',
      winnerId: null,
      finishReason: null,
      lastResolution: null,
    };
  }

  applyAction(
    state: LiarsDiceGameState,
    playerId: string,
    action: LiarsDiceAction,
  ): DistinctActionResult<LiarsDiceResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    if (!action || typeof action !== 'object') return { valid: false, reason: 'Invalid action' };

    if (action.type === 'bid') {
      const totalDice = this.totalDice(state);
      if (!Number.isInteger(action.quantity) || action.quantity < 1 || action.quantity > totalDice || !Number.isInteger(action.face) || action.face < 1 || action.face > 6) {
        return { valid: false, reason: 'Invalid bid' };
      }
      const previous = state.currentBid;
      if (previous && (action.quantity < previous.quantity || (action.quantity === previous.quantity && action.face <= previous.face))) {
        return { valid: false, reason: 'Bid must increase' };
      }
      state.currentBid = { quantity: action.quantity, face: action.face, bidderId: playerId };
      state.currentTurnId = this.nextActive(state, playerId).id;
      return { valid: true };
    }

    if (action.type !== 'challenge') return { valid: false, reason: 'Invalid action' };
    if (!state.currentBid) return { valid: false, reason: 'There is no bid to challenge' };
    const actual = Object.values(state.dice).flat().filter((die) => die === state.currentBid!.face).length;
    const loserId = actual >= state.currentBid.quantity ? playerId : state.currentBid.bidderId;
    state.dice[loserId].pop();
    state.lastResolution = `${state.currentBid.quantity} x ${state.currentBid.face}: ${actual} found; ${loserId} lost a die`;
    const survivors = this.activePlayers(state);
    if (survivors.length === 1) {
      state.phase = 'finished';
      state.winnerId = survivors[0].id;
      state.finishReason = 'last_player';
      return { valid: true, result: this.getResult(state) };
    }
    for (const survivor of survivors) state.dice[survivor.id] = this.rollDice(state.dice[survivor.id].length);
    state.round += 1;
    state.currentBid = null;
    state.currentTurnId = state.dice[loserId].length > 0 ? loserId : this.nextActive(state, loserId).id;
    return { valid: true };
  }

  getPlayerView(state: LiarsDiceGameState, playerId: string): LiarsDicePlayerView {
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({ ...player, diceCount: state.dice[player.id].length })),
      youId: playerId,
      yourDice: [...(state.dice[playerId] ?? [])],
      currentTurnId: state.currentTurnId,
      currentBid: state.currentBid ? { ...state.currentBid } : null,
      round: state.round,
      phase: state.phase,
      winnerId: state.winnerId,
      canAct: state.phase === 'playing' && state.currentTurnId === playerId && (state.dice[playerId]?.length ?? 0) > 0,
      totalDice: this.totalDice(state),
      lastResolution: state.lastResolution,
    };
  }

  surrender(state: LiarsDiceGameState, playerId: string): DistinctActionResult<LiarsDiceResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (!state.players.some((player) => player.id === playerId)) return { valid: false, reason: 'Player not found' };
    state.phase = 'finished';
    state.winnerId = this.nextActive(state, playerId).id;
    state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: LiarsDiceGameState): LiarsDiceResult {
    if (!state.winnerId || !state.finishReason) throw new Error("Liar's Dice game is not finished");
    return { gameKey: this.key, winnerId: state.winnerId, isDraw: false, reason: state.finishReason, rounds: state.round };
  }

  private rollDice(count: number): number[] {
    return Array.from({ length: count }, () => this.rollDie());
  }

  private totalDice(state: LiarsDiceGameState): number {
    return Object.values(state.dice).reduce((total, dice) => total + dice.length, 0);
  }

  private activePlayers(state: LiarsDiceGameState): LiarsDiceGameState['players'] {
    return state.players.filter((player) => state.dice[player.id].length > 0);
  }

  private nextActive(state: LiarsDiceGameState, playerId: string): LiarsDiceGameState['players'][0] {
    const start = state.players.findIndex((player) => player.id === playerId);
    for (let offset = 1; offset <= state.players.length; offset += 1) {
      const candidate = state.players[(Math.max(start, 0) + offset) % state.players.length];
      if (state.dice[candidate.id].length > 0) return candidate;
    }
    throw new Error('No active player');
  }

  private requirePlayers(playerIds: string[]): void {
    if (playerIds.length < this.minPlayers || playerIds.length > this.maxPlayers || new Set(playerIds).size !== playerIds.length) {
      throw new Error("Liar's Dice requires two to six distinct players");
    }
  }
}