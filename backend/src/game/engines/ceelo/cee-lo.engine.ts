import { randomInt } from 'node:crypto';
import type { CeeLoAction, CeeLoGameState, CeeLoPlayerView, CeeLoResult, CeeLoRoll } from '../../../shared';
import { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';
import { hasExactActionShape } from '../action-shape';

type DieRoller = () => number;

export class CeeLoEngine implements DistinctGameAdapter<CeeLoGameState, CeeLoAction, CeeLoPlayerView, CeeLoResult> {
  readonly key = 'cee-lo' as const;
  readonly rulesetId = 'cee-lo.traditional-banker.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 8;

  constructor(
    private readonly rollDie: DieRoller = () => randomInt(1, 7),
    private readonly roundsToPlay = 1,
  ) {
    if (!Number.isInteger(roundsToPlay) || roundsToPlay < 1 || roundsToPlay > 8) throw new Error('Cee-lo rounds must be between one and eight');
  }

  initGame(playerIds: string[], playerNames: Record<string, string>): CeeLoGameState {
    this.requirePlayers(playerIds);
    const players = playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}` }));
    return {
      players,
      roundsToPlay: this.roundsToPlay,
      currentRound: 1,
      bankerIndex: 0,
      bankerId: playerIds[0],
      challengerIds: playerIds.slice(1),
      currentChallengerIndex: 0,
      currentTurnId: playerIds[0],
      bankerRoll: null,
      challengerRolls: {},
      outcomes: {},
      scores: Object.fromEntries(playerIds.map((id) => [id, 0])),
      phase: 'banker_roll',
      winnerId: null,
      isDraw: false,
      finishReason: null,
    };
  }

  applyAction(state: CeeLoGameState, playerId: string, action: CeeLoAction): DistinctActionResult<CeeLoResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    if (!hasExactActionShape(action, 'roll_ceelo', [])) return { valid: false, reason: 'Invalid roll action' };
    const roll = this.rollQualifying();
    if (!roll) return { valid: false, reason: 'Unable to produce a qualifying roll' };

    if (state.phase === 'banker_roll') {
      state.bankerRoll = roll;
      state.phase = 'challenger_roll';
      state.currentTurnId = state.challengerIds[0];
      return { valid: true };
    }
    state.challengerRolls[playerId] = roll;
    this.scoreChallenge(state, playerId, roll);
    state.currentChallengerIndex += 1;
    if (state.currentChallengerIndex < state.challengerIds.length) {
      state.currentTurnId = state.challengerIds[state.currentChallengerIndex];
      return { valid: true };
    }
    if (state.currentRound >= state.roundsToPlay) {
      this.finishTable(state);
      return { valid: true, result: this.getResult(state) };
    }
    this.startNextRound(state);
    return { valid: true };
  }

  getPlayerView(state: CeeLoGameState, playerId: string): CeeLoPlayerView {
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({ ...player })),
      youId: playerId,
      roundsToPlay: state.roundsToPlay,
      currentRound: state.currentRound,
      bankerId: state.bankerId,
      currentTurnId: state.currentTurnId,
      bankerRoll: state.bankerRoll ? { ...state.bankerRoll, dice: [...state.bankerRoll.dice] as CeeLoRoll['dice'] } : null,
      challengerRolls: Object.fromEntries(Object.entries(state.challengerRolls).map(([id, roll]) => [id, { ...roll, dice: [...roll.dice] }])),
      outcomes: { ...state.outcomes },
      scores: { ...state.scores },
      phase: state.phase,
      winnerId: state.winnerId,
      isDraw: state.isDraw,
      canAct: state.phase !== 'finished' && state.currentTurnId === playerId,
    };
  }

  surrender(state: CeeLoGameState, playerId: string): DistinctActionResult<CeeLoResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (!state.players.some((player) => player.id === playerId)) return { valid: false, reason: 'Player not found' };
    const remaining = state.players.filter((player) => player.id !== playerId);
    const highScore = Math.max(...remaining.map((player) => state.scores[player.id]));
    state.scores[playerId] = Math.min(...remaining.map((player) => state.scores[player.id])) - 1;
    state.phase = 'finished';
    state.winnerId = remaining.find((player) => state.scores[player.id] === highScore)!.id;
    state.isDraw = false;
    state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: CeeLoGameState): CeeLoResult {
    if (!state.finishReason) throw new Error('Cee-lo game is not finished');
    return {
      gameKey: this.key,
      winnerId: state.winnerId,
      isDraw: state.isDraw,
      reason: state.finishReason,
      scores: { ...state.scores },
      ranking: this.ranking(state),
    };
  }

  private rollQualifying(): CeeLoRoll | null {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const dice = [this.rollDie(), this.rollDie(), this.rollDie()] as CeeLoRoll['dice'];
      if (!dice.every((die) => Number.isInteger(die) && die >= 1 && die <= 6)) return null;
      const roll = this.classify(dice);
      if (roll) return roll;
    }
    return null;
  }

  private classify(dice: CeeLoRoll['dice']): CeeLoRoll | null {
    const sorted = [...dice].sort((left, right) => left - right);
    if (sorted.join(',') === '1,2,3') return { dice, category: 'automatic_loss', rank: 0 };
    if (sorted.join(',') === '4,5,6') return { dice, category: 'automatic_win', rank: 1000 };
    if (sorted[0] === sorted[2]) return { dice, category: 'triple', rank: 900 + sorted[0] };
    if (sorted[0] === sorted[1]) return { dice, category: 'point', rank: sorted[2] };
    if (sorted[1] === sorted[2]) return { dice, category: 'point', rank: sorted[0] };
    return null;
  }

  private scoreChallenge(state: CeeLoGameState, challengerId: string, roll: CeeLoRoll): void {
    const bankerRank = state.bankerRoll!.rank;
    if (roll.rank > bankerRank) {
      state.outcomes[challengerId] = 'challenger';
      state.scores[challengerId] += 1;
    } else if (roll.rank < bankerRank) {
      state.outcomes[challengerId] = 'banker';
      state.scores[state.bankerId] += 1;
    } else {
      state.outcomes[challengerId] = 'tie';
    }
  }

  private startNextRound(state: CeeLoGameState): void {
    state.currentRound += 1;
    state.bankerIndex = (state.bankerIndex + 1) % state.players.length;
    state.bankerId = state.players[state.bankerIndex].id;
    state.challengerIds = state.players.filter((player) => player.id !== state.bankerId).map((player) => player.id);
    state.currentChallengerIndex = 0;
    state.currentTurnId = state.bankerId;
    state.bankerRoll = null;
    state.challengerRolls = {};
    state.outcomes = {};
    state.phase = 'banker_roll';
  }

  private finishTable(state: CeeLoGameState): void {
    const ranking = this.ranking(state);
    const highScore = state.scores[ranking[0]];
    const leaders = ranking.filter((id) => state.scores[id] === highScore);
    state.phase = 'finished';
    state.winnerId = leaders.length === 1 ? leaders[0] : null;
    state.isDraw = leaders.length > 1;
    state.finishReason = 'table_complete';
  }

  private ranking(state: CeeLoGameState): string[] {
    return state.players.map((player) => player.id).sort((left, right) => state.scores[right] - state.scores[left]);
  }

  private requirePlayers(playerIds: string[]): void {
    if (playerIds.length < 2 || playerIds.length > 8 || new Set(playerIds).size !== playerIds.length) {
      throw new Error('Cee-lo requires two to eight distinct players');
    }
  }
}