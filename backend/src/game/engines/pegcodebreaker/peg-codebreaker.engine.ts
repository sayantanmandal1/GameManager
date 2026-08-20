import {
  PEG_CODE_COLORS,
  PegCodeAction,
  PegCodeColor,
  PegCodePlayerView,
  PegCodeResult,
  PegCodebreakerGameState,
} from '../../../shared';
import { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';

const CODE_LENGTH = 4;
const MAX_GUESSES = 10;

export class PegCodebreakerEngine
  implements DistinctGameAdapter<PegCodebreakerGameState, PegCodeAction, PegCodePlayerView, PegCodeResult>
{
  readonly key = 'peg-codebreaker' as const;
  readonly rulesetId = 'peg-codebreaker.four-peg-six-color.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 2;

  initGame(playerIds: string[], playerNames: Record<string, string>): PegCodebreakerGameState {
    if (playerIds.length !== 2 || new Set(playerIds).size !== 2) {
      throw new Error('Peg Codebreaker requires exactly two distinct players');
    }
    return {
      players: [
        { id: playerIds[0], name: playerNames[playerIds[0]] || 'Codemaker' },
        { id: playerIds[1], name: playerNames[playerIds[1]] || 'Codebreaker' },
      ],
      makerId: playerIds[0],
      breakerId: playerIds[1],
      secret: null,
      guesses: [],
      phase: 'coding',
      winnerId: null,
      finishReason: null,
    };
  }

  applyAction(
    state: PegCodebreakerGameState,
    playerId: string,
    action: PegCodeAction,
  ): DistinctActionResult<PegCodeResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (!action || typeof action !== 'object') return { valid: false, reason: 'Invalid action' };

    if (state.phase === 'coding') {
      if (playerId !== state.makerId) return { valid: false, reason: 'Only the codemaker can set the code' };
      if (action.type !== 'set_code' || !this.validColors(action.colors)) {
        return { valid: false, reason: 'Invalid secret code' };
      }
      state.secret = [...action.colors];
      state.phase = 'guessing';
      return { valid: true };
    }

    if (playerId !== state.breakerId) return { valid: false, reason: 'Only the codebreaker can guess' };
    if (action.type !== 'guess_code' || !this.validColors(action.colors)) {
      return { valid: false, reason: 'Invalid guess' };
    }
    const feedback = this.feedback(state.secret!, action.colors);
    state.guesses.push({ colors: [...action.colors], ...feedback });
    if (feedback.exact === CODE_LENGTH) {
      state.phase = 'finished';
      state.winnerId = state.breakerId;
      state.finishReason = 'cracked';
      return { valid: true, result: this.getResult(state) };
    }
    if (state.guesses.length === MAX_GUESSES) {
      state.phase = 'finished';
      state.winnerId = state.makerId;
      state.finishReason = 'attempts_exhausted';
      return { valid: true, result: this.getResult(state) };
    }
    return { valid: true };
  }

  getPlayerView(state: PegCodebreakerGameState, playerId: string): PegCodePlayerView {
    const terminal = state.phase === 'finished';
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({ ...player })) as PegCodebreakerGameState['players'],
      youId: playerId,
      makerId: state.makerId,
      breakerId: state.breakerId,
      currentTurnId: state.phase === 'coding' ? state.makerId : state.phase === 'guessing' ? state.breakerId : null,
      phase: state.phase,
      winnerId: state.winnerId,
      canAct:
        (state.phase === 'coding' && playerId === state.makerId) ||
        (state.phase === 'guessing' && playerId === state.breakerId),
      guesses: state.guesses.map((guess) => ({ ...guess, colors: [...guess.colors] })),
      yourSecret: playerId === state.makerId && state.secret ? [...state.secret] : null,
      revealedSecret: terminal && state.secret ? [...state.secret] : null,
      attemptsRemaining: MAX_GUESSES - state.guesses.length,
    };
  }

  surrender(state: PegCodebreakerGameState, playerId: string): DistinctActionResult<PegCodeResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (playerId !== state.makerId && playerId !== state.breakerId) return { valid: false, reason: 'Player not found' };
    state.phase = 'finished';
    state.winnerId = playerId === state.makerId ? state.breakerId : state.makerId;
    state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: PegCodebreakerGameState): PegCodeResult {
    if (!state.winnerId || !state.finishReason) throw new Error('Peg Codebreaker game is not finished');
    return {
      gameKey: this.key,
      winnerId: state.winnerId,
      isDraw: false,
      reason: state.finishReason,
      attempts: state.guesses.length,
      secret: state.secret ? [...state.secret] : [],
    };
  }

  private validColors(colors: unknown): colors is PegCodeColor[] {
    return Array.isArray(colors) && colors.length === CODE_LENGTH && colors.every(
      (color) => typeof color === 'string' && PEG_CODE_COLORS.includes(color as PegCodeColor),
    );
  }

  private feedback(secret: PegCodeColor[], guess: PegCodeColor[]): { exact: number; colorOnly: number } {
    let exact = 0;
    const secretRemainder: PegCodeColor[] = [];
    const guessRemainder: PegCodeColor[] = [];
    for (let index = 0; index < CODE_LENGTH; index += 1) {
      if (secret[index] === guess[index]) exact += 1;
      else {
        secretRemainder.push(secret[index]);
        guessRemainder.push(guess[index]);
      }
    }
    let colorOnly = 0;
    for (const color of guessRemainder) {
      const match = secretRemainder.indexOf(color);
      if (match >= 0) {
        colorOnly += 1;
        secretRemainder.splice(match, 1);
      }
    }
    return { exact, colorOnly };
  }
}