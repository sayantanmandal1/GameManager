import { randomInt } from 'node:crypto';
import {
  PigAction,
  PigGameState,
  PigPlayerView,
  PigResult,
} from '../../../shared';
import {
  DistinctActionResult,
  DistinctGameAdapter,
  DistinctGamePhase,
} from '../distinct-game.adapter';

const TARGET_SCORE = 100;

export class PigEngine
  implements
    DistinctGameAdapter<PigGameState, PigAction, PigPlayerView, PigResult>
{
  readonly key = 'pig' as const;
  readonly rulesetId = 'pig.standard-100.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 2;

  constructor(private readonly rollDie: () => number = () => randomInt(1, 7)) {}

  initGame(
    playerIds: string[],
    playerNames: Record<string, string>,
  ): PigGameState {
    if (playerIds.length !== 2 || new Set(playerIds).size !== 2) {
      throw new Error('Pig requires exactly two distinct players');
    }

    return {
      players: [
        { id: playerIds[0], name: playerNames[playerIds[0]] || 'Player 1' },
        { id: playerIds[1], name: playerNames[playerIds[1]] || 'Player 2' },
      ],
      scores: { [playerIds[0]]: 0, [playerIds[1]]: 0 },
      currentTurnId: playerIds[0],
      turnTotal: 0,
      lastRoll: null,
      phase: DistinctGamePhase.PLAYING,
      winnerId: null,
      isDraw: false,
      finishReason: null,
    };
  }

  applyAction(
    state: PigGameState,
    playerId: string,
    action: PigAction,
  ): DistinctActionResult<PigResult> {
    if (state.phase !== DistinctGamePhase.PLAYING) {
      return { valid: false, reason: 'Game already finished' };
    }
    if (state.currentTurnId !== playerId) {
      return { valid: false, reason: 'Not your turn' };
    }
    if (!action || (action.type !== 'roll' && action.type !== 'hold')) {
      return { valid: false, reason: 'Invalid action' };
    }

    if (action.type === 'roll') {
      // SECURITY_NOTE: the die value is generated exclusively by node:crypto;
      // no client field is read or trusted as a roll result.
      const roll = this.rollDie();
      state.lastRoll = roll;
      if (roll === 1) {
        state.turnTotal = 0;
        state.currentTurnId = this.otherPlayer(state, playerId).id;
      } else {
        state.turnTotal += roll;
      }
      return { valid: true };
    }

    if (state.turnTotal === 0) {
      return { valid: false, reason: 'Nothing to hold' };
    }
    state.scores[playerId] += state.turnTotal;
    state.turnTotal = 0;
    if (state.scores[playerId] >= TARGET_SCORE) {
      state.phase = DistinctGamePhase.FINISHED;
      state.winnerId = playerId;
      state.finishReason = 'target_reached';
      return { valid: true, result: this.getResult(state) };
    }

    state.currentTurnId = this.otherPlayer(state, playerId).id;
    return { valid: true };
  }

  getPlayerView(state: PigGameState, playerId: string): PigPlayerView {
    const isPlayer = state.players.some((candidate) => candidate.id === playerId);
    const canAct =
      state.phase === DistinctGamePhase.PLAYING &&
      state.currentTurnId === playerId &&
      isPlayer;
    return {
      players: state.players.map((candidate) => ({ ...candidate })) as [
        PigGameState['players'][0],
        PigGameState['players'][1],
      ],
      scores: { ...state.scores },
      currentTurnId: state.currentTurnId,
      turnTotal: state.turnTotal,
      lastRoll: state.lastRoll,
      phase: state.phase,
      winnerId: state.winnerId,
      isDraw: false,
      youId: playerId,
      canAct,
      canRoll: canAct,
      canHold: canAct && state.turnTotal > 0,
      targetScore: TARGET_SCORE,
    };
  }

  surrender(
    state: PigGameState,
    playerId: string,
  ): DistinctActionResult<PigResult> {
    if (state.phase !== DistinctGamePhase.PLAYING) {
      return { valid: false, reason: 'Game already finished' };
    }
    if (!state.players.some((candidate) => candidate.id === playerId)) {
      return { valid: false, reason: 'Player not found' };
    }
    state.phase = DistinctGamePhase.FINISHED;
    state.winnerId = this.otherPlayer(state, playerId).id;
    state.finishReason = 'surrender';
    state.turnTotal = 0;
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: PigGameState): PigResult {
    if (!state.finishReason || !state.winnerId) {
      throw new Error('Pig game is not finished');
    }
    return {
      winnerId: state.winnerId,
      isDraw: false,
      reason: state.finishReason,
      scores: { ...state.scores },
    };
  }

  private otherPlayer(state: PigGameState, playerId: string): PigGameState['players'][0] {
    return state.players.find((candidate) => candidate.id !== playerId)!;
  }
}