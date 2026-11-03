import { randomInt } from 'node:crypto';
import {
  LiarsDiceAction,
  LiarsDiceGameState,
  LiarsDicePlayerView,
  LiarsDiceResult,
} from '../../../shared';
import { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';
import type { DistinctAutomaticAction } from '../distinct-game.adapter';
import { hasExactActionShape } from '../action-shape';

export class LiarsDiceEngine
  implements DistinctGameAdapter<LiarsDiceGameState, LiarsDiceAction, LiarsDicePlayerView, LiarsDiceResult>
{
  readonly key = 'liars-dice' as const;
  readonly rulesetId = 'liars-dice.classic-traditional-poison.v2';
  readonly minPlayers = 2;
  readonly maxPlayers = 4;

  constructor(private readonly rollDie: () => number = () => randomInt(1, 7)) {}

  initGame(playerIds: string[], playerNames: Record<string, string>): LiarsDiceGameState {
    this.requirePlayers(playerIds);
    return {
      players: playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}` })),
      hostId: playerIds[0],
      mode: null,
      penalties: Object.fromEntries(playerIds.map((id) => [id, 0])),
      dice: Object.fromEntries(playerIds.map((id) => [id, []])),
      currentTurnId: playerIds[0],
      currentBid: null,
      round: 0,
      phase: 'setup',
      winnerId: null,
      finishReason: null,
      lastResolution: null,
      lastReveal: null,
    };
  }

  applyAction(
    state: LiarsDiceGameState,
    playerId: string,
    action: LiarsDiceAction,
  ): DistinctActionResult<LiarsDiceResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (!state.players.some((player) => player.id === playerId)) return { valid: false, reason: 'Player not found' };
    if (!action || typeof action !== 'object' || Array.isArray(action)) return { valid: false, reason: 'Invalid action' };

    if (action.type === 'select_liars_dice_mode') {
      if (!hasExactActionShape(action, 'select_liars_dice_mode', ['mode'])
        || (action.mode !== 'classic' && action.mode !== 'traditional')) return { valid: false, reason: 'Invalid mode' };
      if (state.phase !== 'setup' || playerId !== state.hostId) return { valid: false, reason: 'Only the host can choose the mode before play' };
      state.mode = action.mode;
      this.startRound(state);
      return { valid: true };
    }
    if (action.type === 'next_liars_dice_round') {
      if (!hasExactActionShape(action, 'next_liars_dice_round', [])
        || state.phase !== 'reveal' || playerId !== state.hostId) return { valid: false, reason: 'Only the host can advance a revealed round' };
      this.startRound(state);
      return { valid: true };
    }
    if (state.phase !== 'playing') return { valid: false, reason: 'Wait for the next round' };
    if (state.currentTurnId !== playerId || state.penalties[playerId] >= 2) return { valid: false, reason: 'Not your turn' };

    if (action.type === 'bid') {
      const totalDice = this.totalDice(state);
      if (!hasExactActionShape(action, 'bid', ['quantity', 'face']) || !Number.isInteger(action.quantity) || action.quantity < 1 || action.quantity > totalDice || !Number.isInteger(action.face) || action.face < 1 || action.face > 6) {
        return { valid: false, reason: 'Invalid bid' };
      }
      const previous = state.currentBid;
      if (previous && action.quantity <= previous.quantity) {
        return { valid: false, reason: 'Bid quantity must increase' };
      }
      state.currentBid = { quantity: action.quantity, face: action.face, bidderId: playerId };
      state.currentTurnId = this.nextActive(state, playerId).id;
      return { valid: true };
    }

    if ((action.type !== 'challenge' && action.type !== 'spot_on')
      || !hasExactActionShape(action, action.type, [])) return { valid: false, reason: 'Invalid action' };
    if (action.type === 'spot_on' && state.mode !== 'traditional') return { valid: false, reason: 'Spot on is available only in Traditional mode' };
    if (!state.currentBid) return { valid: false, reason: 'There is no bid to challenge' };
    const bid = state.currentBid;
    const actual = this.activePlayers(state).flatMap((player) => state.dice[player.id])
      .filter((die) => die === bid.face || (state.mode === 'traditional' && die === 1)).length;
    const successful = action.type === 'spot_on' ? actual === bid.quantity : actual < bid.quantity;
    const penalizedIds = action.type === 'spot_on'
      ? successful ? this.activePlayers(state).filter((player) => player.id !== playerId).map((player) => player.id) : [playerId]
      : [successful ? bid.bidderId : playerId];
    state.lastReveal = {
      bid: { ...bid }, callerId: playerId, kind: action.type,
      dice: Object.fromEntries(this.activePlayers(state).map((player) => [player.id, [...state.dice[player.id]]])),
      actual, successful, penalizedIds: [...penalizedIds],
    };
    for (const id of penalizedIds) {
      state.penalties[id] += 1;
      if (state.penalties[id] >= 2) state.dice[id] = [];
    }
    state.lastResolution = `${bid.quantity} × ${bid.face}: ${actual} found. ${penalizedIds.map((id) => state.players.find((player) => player.id === id)!.name).join(', ')} received a poison penalty.`;
    const survivors = this.activePlayers(state);
    if (survivors.length === 1) {
      state.phase = 'finished';
      state.winnerId = survivors[0].id;
      state.finishReason = 'last_player';
      return { valid: true, result: this.getResult(state) };
    }
    const starterId = action.type === 'spot_on' && successful ? playerId : penalizedIds[0];
    state.currentTurnId = state.penalties[starterId] < 2 ? starterId : this.nextActive(state, starterId).id;
    state.phase = 'reveal';
    return { valid: true };
  }

  getPlayerView(state: LiarsDiceGameState, playerId: string): LiarsDicePlayerView {
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({ ...player, diceCount: state.dice[player.id].length })),
      hostId: state.hostId,
      mode: state.mode,
      penalties: { ...state.penalties },
      youId: playerId,
      yourDice: [...(state.dice[playerId] ?? [])],
      currentTurnId: state.currentTurnId,
      currentBid: state.currentBid ? { ...state.currentBid } : null,
      round: state.round,
      phase: state.phase,
      winnerId: state.winnerId,
      canAct: state.phase === 'setup' ? playerId === state.hostId
        : state.phase === 'playing' && state.currentTurnId === playerId && state.penalties[playerId] < 2,
      totalDice: this.totalDice(state),
      lastResolution: state.lastResolution,
      lastReveal: state.lastReveal ? {
        ...state.lastReveal, bid: { ...state.lastReveal.bid },
        dice: Object.fromEntries(Object.entries(state.lastReveal.dice).map(([id, dice]) => [id, [...dice]])),
        penalizedIds: [...state.lastReveal.penalizedIds],
      } : null,
      canChallenge: state.phase === 'playing' && state.currentTurnId === playerId && !!state.currentBid && state.penalties[playerId] < 2,
      canSpotOn: state.mode === 'traditional' && state.phase === 'playing' && state.currentTurnId === playerId && !!state.currentBid && state.penalties[playerId] < 2,
    };
  }

  getAutomaticAction(state: LiarsDiceGameState): DistinctAutomaticAction | null {
    return state.phase === 'reveal'
      ? { playerId: state.hostId, action: { type: 'next_liars_dice_round' }, delayMs: 5_000 }
      : null;
  }

  surrender(state: LiarsDiceGameState, playerId: string): DistinctActionResult<LiarsDiceResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (!state.players.some((player) => player.id === playerId)) return { valid: false, reason: 'Player not found' };
    if (state.penalties[playerId] >= 2) return { valid: false, reason: 'Player already eliminated' };
    state.penalties[playerId] = 2;
    state.dice[playerId] = [];
    const survivors = this.activePlayers(state);
    if (survivors.length === 1) {
      state.phase = 'finished';
      state.winnerId = survivors[0].id;
      state.finishReason = 'surrender';
      return { valid: true, result: this.getResult(state) };
    }
    if (state.hostId === playerId) state.hostId = survivors[0].id;
    if (state.currentTurnId === playerId) state.currentTurnId = this.nextActive(state, playerId).id;
    if (state.phase === 'playing') {
      state.phase = 'reveal';
      state.currentBid = null;
      state.lastReveal = null;
      state.lastResolution = `${state.players.find((player) => player.id === playerId)!.name} resigned. The remaining players continue.`;
    }
    return { valid: true };
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
    return state.players.filter((player) => state.penalties[player.id] < 2);
  }

  private nextActive(state: LiarsDiceGameState, playerId: string): LiarsDiceGameState['players'][0] {
    const start = state.players.findIndex((player) => player.id === playerId);
    for (let offset = 1; offset <= state.players.length; offset += 1) {
      const candidate = state.players[(Math.max(start, 0) + offset) % state.players.length];
      if (state.penalties[candidate.id] < 2) return candidate;
    }
    throw new Error('No active player');
  }

  private requirePlayers(playerIds: string[]): void {
    if (playerIds.length < this.minPlayers || playerIds.length > this.maxPlayers || new Set(playerIds).size !== playerIds.length) {
      throw new Error("Liar's Dice requires two to four distinct players");
    }
  }

  private startRound(state: LiarsDiceGameState): void {
    for (const player of this.activePlayers(state)) state.dice[player.id] = this.rollDice(5);
    state.round += 1;
    state.currentBid = null;
    state.phase = 'playing';
  }
}