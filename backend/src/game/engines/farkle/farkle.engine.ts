import { randomInt } from 'node:crypto';
import {
  FarkleAction,
  FarkleGameState,
  FarklePlayerView,
  FarkleResult,
} from '../../../shared';
import { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';

const ENTRY_SCORE = 500;
const TARGET_SCORE = 10_000;

export class FarkleEngine
  implements DistinctGameAdapter<FarkleGameState, FarkleAction, FarklePlayerView, FarkleResult>
{
  readonly key = 'farkle' as const;
  readonly rulesetId = 'farkle.standard-10000.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 8;

  constructor(private readonly rollDie: () => number = () => randomInt(1, 7)) {}

  initGame(playerIds: string[], playerNames: Record<string, string>): FarkleGameState {
    this.requirePlayers(playerIds);
    return {
      players: playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}` })),
      scores: Object.fromEntries(playerIds.map((id) => [id, 0])),
      entered: Object.fromEntries(playerIds.map((id) => [id, false])),
      currentTurnId: playerIds[0],
      dice: [],
      turnScore: 0,
      diceRemaining: 6,
      finalTriggerId: null,
      finalTurnsRemaining: null,
      phase: 'rolling',
      winnerId: null,
      isDraw: false,
      finishReason: null,
      lastEvent: 'Roll six dice',
    };
  }

  applyAction(
    state: FarkleGameState,
    playerId: string,
    action: FarkleAction,
  ): DistinctActionResult<FarkleResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    if (!action || typeof action !== 'object') return { valid: false, reason: 'Invalid action' };

    if (action.type === 'roll_farkle') {
      if (state.phase !== 'rolling') return { valid: false, reason: 'Select scoring dice first' };
      state.dice = Array.from({ length: state.diceRemaining }, () => this.rollDie());
      if (this.selectableIndices(state.dice).length === 0) {
        state.turnScore = 0;
        state.lastEvent = 'Farkle: turn score lost';
        return this.completeTurn(state, playerId);
      }
      state.phase = 'selecting';
      state.lastEvent = 'Select scoring dice';
      return { valid: true };
    }

    if (action.type === 'select_dice') {
      if (state.phase !== 'selecting') return { valid: false, reason: 'Roll before selecting dice' };
      if (!Array.isArray(action.indices) || action.indices.length < 1 || action.indices.length > state.dice.length || new Set(action.indices).size !== action.indices.length || action.indices.some((index) => !Number.isInteger(index) || index < 0 || index >= state.dice.length)) {
        return { valid: false, reason: 'Invalid dice selection' };
      }
      const values = action.indices.map((index) => state.dice[index]);
      const points = this.scoreSelection(values);
      if (points === null) return { valid: false, reason: 'Every selected die must score' };
      state.turnScore += points;
      state.diceRemaining -= action.indices.length;
      if (state.diceRemaining === 0) {
        state.diceRemaining = 6;
        state.lastEvent = 'Hot dice: roll all six again';
      } else {
        state.lastEvent = `${points} points set aside`;
      }
      state.dice = [];
      state.phase = 'rolling';
      return { valid: true };
    }

    if (action.type !== 'bank_farkle') return { valid: false, reason: 'Invalid action' };
    if (state.phase !== 'rolling' || state.turnScore <= 0) return { valid: false, reason: 'No turn score to bank' };
    if (!state.entered[playerId] && state.turnScore < ENTRY_SCORE) return { valid: false, reason: 'Five hundred points are required to enter' };
    state.entered[playerId] = true;
    state.scores[playerId] += state.turnScore;
    state.lastEvent = `${state.turnScore} points banked`;
    state.turnScore = 0;
    state.diceRemaining = 6;
    if (!state.finalTriggerId && state.scores[playerId] >= TARGET_SCORE) {
      state.finalTriggerId = playerId;
      state.finalTurnsRemaining = state.players.length - 1;
    }
    return this.completeTurn(state, playerId);
  }

  getPlayerView(state: FarkleGameState, playerId: string): FarklePlayerView {
    const canAct = state.phase !== 'finished' && state.currentTurnId === playerId;
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({ ...player })),
      youId: playerId,
      scores: { ...state.scores },
      entered: { ...state.entered },
      currentTurnId: state.currentTurnId,
      dice: [...state.dice],
      turnScore: state.turnScore,
      diceRemaining: state.diceRemaining,
      finalTriggerId: state.finalTriggerId,
      finalTurnsRemaining: state.finalTurnsRemaining,
      phase: state.phase,
      winnerId: state.winnerId,
      isDraw: state.isDraw,
      canAct,
      selectableIndices: canAct && state.phase === 'selecting' ? this.selectableIndices(state.dice) : [],
      canBank: canAct && state.phase === 'rolling' && state.turnScore > 0 && (state.entered[playerId] || state.turnScore >= ENTRY_SCORE),
      lastEvent: state.lastEvent,
    };
  }

  surrender(state: FarkleGameState, playerId: string): DistinctActionResult<FarkleResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    const index = state.players.findIndex((player) => player.id === playerId);
    if (index < 0) return { valid: false, reason: 'Player not found' };
    state.phase = 'finished';
    state.winnerId = state.players[(index + 1) % state.players.length].id;
    state.isDraw = false;
    state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: FarkleGameState): FarkleResult {
    if (!state.finishReason) throw new Error('Farkle game is not finished');
    return {
      gameKey: this.key,
      winnerId: state.winnerId,
      isDraw: state.isDraw,
      reason: state.finishReason,
      scores: { ...state.scores },
    };
  }

  private scoreSelection(values: number[]): number | null {
    if (values.length === 6) {
      const sorted = [...values].sort((left, right) => left - right);
      if (sorted.join('') === '123456') return 1500;
      const fullCounts = this.counts(values);
      const pairCounts = fullCounts.filter((count) => count === 2).length;
      if (pairCounts === 3) return 1500;
      if (fullCounts.filter((count) => count === 3).length === 2) return 2500;
    }
    const counts = this.counts(values);
    let score = 0;
    for (let face = 1; face <= 6; face += 1) {
      let count = counts[face];
      if (count >= 3) {
        score += count === 3
          ? face === 1 ? 1000 : face * 100
          : count === 4 ? 1000
            : count === 5 ? 2000
              : 3000;
        count = 0;
      }
      if (count > 0) {
        if (face === 1) score += count * 100;
        else if (face === 5) score += count * 50;
        else return null;
      }
    }
    return score > 0 ? score : null;
  }

  private selectableIndices(dice: number[]): number[] {
    if (dice.length === 6) {
      const sorted = [...dice].sort((left, right) => left - right);
      if (sorted.join('') === '123456' || this.counts(dice).filter((count) => count === 2).length === 3) {
        return dice.map((_, index) => index);
      }
    }
    const counts = this.counts(dice);
    return dice.flatMap((die, index) => die === 1 || die === 5 || counts[die] >= 3 ? [index] : []);
  }

  private counts(values: number[]): number[] {
    const counts = Array(7).fill(0) as number[];
    for (const value of values) counts[value] += 1;
    return counts;
  }

  private completeTurn(state: FarkleGameState, playerId: string): DistinctActionResult<FarkleResult> {
    state.dice = [];
    state.diceRemaining = 6;
    state.phase = 'rolling';
    if (state.finalTriggerId && playerId !== state.finalTriggerId && state.finalTurnsRemaining !== null) {
      state.finalTurnsRemaining -= 1;
      if (state.finalTurnsRemaining === 0) {
        this.finish(state);
        return { valid: true, result: this.getResult(state) };
      }
    }
    const index = state.players.findIndex((player) => player.id === playerId);
    state.currentTurnId = state.players[(index + 1) % state.players.length].id;
    return { valid: true };
  }

  private finish(state: FarkleGameState): void {
    const high = Math.max(...Object.values(state.scores));
    const leaders = state.players.filter((player) => state.scores[player.id] === high);
    state.phase = 'finished';
    state.winnerId = leaders.length === 1 ? leaders[0].id : null;
    state.isDraw = leaders.length > 1;
    state.finishReason = 'final_round';
  }

  private requirePlayers(playerIds: string[]): void {
    if (playerIds.length < this.minPlayers || playerIds.length > this.maxPlayers || new Set(playerIds).size !== playerIds.length) {
      throw new Error('Farkle requires two to eight distinct players');
    }
  }
}