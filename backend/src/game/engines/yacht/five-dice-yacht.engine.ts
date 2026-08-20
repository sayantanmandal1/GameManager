import { randomInt } from 'node:crypto';
import {
  YACHT_CATEGORIES,
  YachtAction,
  YachtCategory,
  YachtGameState,
  YachtPlayerView,
  YachtResult,
  YachtScorecard,
} from '../../../shared';
import { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';

export class FiveDiceYachtEngine
  implements DistinctGameAdapter<YachtGameState, YachtAction, YachtPlayerView, YachtResult>
{
  readonly key = 'five-dice-yacht' as const;
  readonly rulesetId = 'five-dice-yacht.thirteen-category.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 8;

  constructor(private readonly rollDie: () => number = () => randomInt(1, 7)) {}

  initGame(playerIds: string[], playerNames: Record<string, string>): YachtGameState {
    this.requirePlayers(playerIds);
    return {
      players: playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}` })),
      scorecards: Object.fromEntries(playerIds.map((id) => [id, this.emptyScorecard()])),
      currentTurnId: playerIds[0],
      dice: [],
      rollsUsed: 0,
      phase: 'playing',
      winnerId: null,
      isDraw: false,
      finishReason: null,
    };
  }

  applyAction(
    state: YachtGameState,
    playerId: string,
    action: YachtAction,
  ): DistinctActionResult<YachtResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    if (!action || typeof action !== 'object') return { valid: false, reason: 'Invalid action' };

    if (action.type === 'roll_dice') {
      if (state.rollsUsed >= 3) return { valid: false, reason: 'No rolls remaining' };
      if (!Array.isArray(action.heldIndices) || action.heldIndices.length > 5 || new Set(action.heldIndices).size !== action.heldIndices.length) {
        return { valid: false, reason: 'Invalid held dice' };
      }
      if (action.heldIndices.some((index) => !Number.isInteger(index) || index < 0 || index >= state.dice.length)) {
        return { valid: false, reason: 'Invalid held dice' };
      }
      const held = action.heldIndices.map((index) => state.dice[index]);
      state.dice = [...held, ...Array.from({ length: 5 - held.length }, () => this.rollDie())];
      state.rollsUsed += 1;
      return { valid: true };
    }

    if (action.type !== 'score_category' || !YACHT_CATEGORIES.includes(action.category as YachtCategory)) {
      return { valid: false, reason: 'Invalid category' };
    }
    if (state.dice.length !== 5) return { valid: false, reason: 'Roll before scoring' };
    if (state.scorecards[playerId][action.category] !== null) return { valid: false, reason: 'Category already used' };
    state.scorecards[playerId][action.category] = this.score(action.category, state.dice);
    state.dice = [];
    state.rollsUsed = 0;
    if (state.players.every((player) => YACHT_CATEGORIES.every((category) => state.scorecards[player.id][category] !== null))) {
      this.finish(state);
      return { valid: true, result: this.getResult(state) };
    }
    this.advanceTurn(state, playerId);
    return { valid: true };
  }

  getPlayerView(state: YachtGameState, playerId: string): YachtPlayerView {
    const canAct = state.phase === 'playing' && state.currentTurnId === playerId;
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({ ...player })),
      youId: playerId,
      scorecards: Object.fromEntries(state.players.map((player) => [player.id, { ...state.scorecards[player.id] }])),
      totals: this.totals(state),
      currentTurnId: state.currentTurnId,
      dice: [...state.dice],
      rollsUsed: state.rollsUsed,
      phase: state.phase,
      winnerId: state.winnerId,
      isDraw: state.isDraw,
      canAct,
      possibleScores: canAct && state.dice.length === 5
        ? Object.fromEntries(YACHT_CATEGORIES.filter((category) => state.scorecards[playerId][category] === null).map((category) => [category, this.score(category, state.dice)]))
        : {},
    };
  }

  surrender(state: YachtGameState, playerId: string): DistinctActionResult<YachtResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    const index = state.players.findIndex((player) => player.id === playerId);
    if (index < 0) return { valid: false, reason: 'Player not found' };
    state.phase = 'finished';
    state.winnerId = state.players[(index + 1) % state.players.length].id;
    state.isDraw = false;
    state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: YachtGameState): YachtResult {
    if (!state.finishReason) throw new Error('Five-Dice Yacht game is not finished');
    return {
      gameKey: this.key,
      winnerId: state.winnerId,
      isDraw: state.isDraw,
      reason: state.finishReason,
      totals: this.totals(state),
    };
  }

  private score(category: YachtCategory, dice: number[]): number {
    const counts = Array(7).fill(0) as number[];
    for (const die of dice) counts[die] += 1;
    const sum = dice.reduce((total, die) => total + die, 0);
    const upperIndex = YACHT_CATEGORIES.indexOf(category);
    if (upperIndex >= 0 && upperIndex < 6) return counts[upperIndex + 1] * (upperIndex + 1);
    if (category === 'three_kind') return counts.some((count) => count >= 3) ? sum : 0;
    if (category === 'four_kind') return counts.some((count) => count >= 4) ? sum : 0;
    if (category === 'full_house') return counts.includes(3) && counts.includes(2) ? 25 : 0;
    const unique = [...new Set(dice)].sort((left, right) => left - right);
    if (category === 'small_straight') {
      const text = unique.join('');
      return text.includes('1234') || text.includes('2345') || text.includes('3456') ? 30 : 0;
    }
    if (category === 'large_straight') return unique.join('') === '12345' || unique.join('') === '23456' ? 40 : 0;
    if (category === 'yacht') return counts.includes(5) ? 50 : 0;
    return sum;
  }

  private emptyScorecard(): YachtScorecard {
    return Object.fromEntries(YACHT_CATEGORIES.map((category) => [category, null])) as YachtScorecard;
  }

  private totals(state: YachtGameState): Record<string, number> {
    return Object.fromEntries(state.players.map((player) => {
      const scorecard = state.scorecards[player.id];
      const categoryTotal = Object.values(scorecard).reduce<number>(
        (total, score) => total + (score ?? 0),
        0,
      );
      const upperTotal = YACHT_CATEGORIES.slice(0, 6).reduce(
        (total, category) => total + (scorecard[category] ?? 0),
        0,
      );
      return [player.id, categoryTotal + (upperTotal >= 63 ? 35 : 0)];
    }));
  }

  private finish(state: YachtGameState): void {
    const totals = this.totals(state);
    const high = Math.max(...Object.values(totals));
    const leaders = state.players.filter((player) => totals[player.id] === high);
    state.phase = 'finished';
    state.winnerId = leaders.length === 1 ? leaders[0].id : null;
    state.isDraw = leaders.length > 1;
    state.finishReason = 'scorecards_complete';
  }

  private advanceTurn(state: YachtGameState, playerId: string): void {
    const index = state.players.findIndex((player) => player.id === playerId);
    state.currentTurnId = state.players[(index + 1) % state.players.length].id;
  }

  private requirePlayers(playerIds: string[]): void {
    if (playerIds.length < this.minPlayers || playerIds.length > this.maxPlayers || new Set(playerIds).size !== playerIds.length) {
      throw new Error('Five-Dice Yacht requires two to eight distinct players');
    }
  }
}