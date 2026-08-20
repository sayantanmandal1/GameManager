import {
  HangmanAction,
  HangmanGameState,
  HangmanPlayerView,
  HangmanResult,
} from '../../../shared';
import { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';

const MAX_MISSES = 8;

export class HangmanEngine
  implements DistinctGameAdapter<HangmanGameState, HangmanAction, HangmanPlayerView, HangmanResult>
{
  readonly key = 'hangman' as const;
  readonly rulesetId = 'hangman.shared-eight-misses.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 8;

  initGame(playerIds: string[], playerNames: Record<string, string>): HangmanGameState {
    if (playerIds.length < this.minPlayers || playerIds.length > this.maxPlayers || new Set(playerIds).size !== playerIds.length) {
      throw new Error('Hangman requires two to eight distinct players');
    }
    return {
      players: playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}` })),
      hostId: playerIds[0],
      secretPhrase: null,
      guessedLetters: [],
      misses: 0,
      currentTurnId: playerIds[0],
      phase: 'setup',
      winnerId: null,
      finishReason: null,
    };
  }

  applyAction(
    state: HangmanGameState,
    playerId: string,
    action: HangmanAction,
  ): DistinctActionResult<HangmanResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (!state.players.some((player) => player.id === playerId)) return { valid: false, reason: 'Player not found' };
    if (!action || typeof action !== 'object') return { valid: false, reason: 'Invalid action' };

    if (state.phase === 'setup') {
      if (playerId !== state.hostId) return { valid: false, reason: 'Only the host can set the phrase' };
      if (action.type !== 'set_phrase') return { valid: false, reason: 'Set a phrase first' };
      const phrase = this.normalizePhrase(action.phrase);
      if (!phrase) return { valid: false, reason: 'Phrase must contain only letters and spaces' };
      state.secretPhrase = phrase;
      state.phase = 'playing';
      state.currentTurnId = this.guessers(state)[0].id;
      return { valid: true };
    }

    if (playerId === state.hostId) return { valid: false, reason: 'The host cannot guess' };
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    if (action.type === 'guess_letter') {
      const letter = typeof action.letter === 'string' ? action.letter.toUpperCase() : '';
      if (!/^[A-Z]$/.test(letter)) return { valid: false, reason: 'Invalid letter' };
      if (state.guessedLetters.includes(letter)) return { valid: false, reason: 'Letter already guessed' };
      state.guessedLetters.push(letter);
      if (!state.secretPhrase!.includes(letter)) state.misses += 1;
      if (!this.pattern(state).includes('_')) return this.finish(state, playerId, 'phrase_guessed');
    } else if (action.type === 'guess_phrase') {
      const guess = this.normalizePhrase(action.phrase);
      if (!guess) return { valid: false, reason: 'Invalid phrase guess' };
      if (guess === state.secretPhrase) return this.finish(state, playerId, 'phrase_guessed');
      state.misses += 1;
    } else {
      return { valid: false, reason: 'Invalid action' };
    }

    if (state.misses >= MAX_MISSES) return this.finish(state, state.hostId, 'miss_limit');
    state.currentTurnId = this.nextGuesser(state, playerId).id;
    return { valid: true };
  }

  getPlayerView(state: HangmanGameState, playerId: string): HangmanPlayerView {
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({ ...player })),
      hostId: state.hostId,
      youId: playerId,
      phase: state.phase,
      currentTurnId: state.currentTurnId,
      winnerId: state.winnerId,
      canAct:
        (state.phase === 'setup' && playerId === state.hostId) ||
        (state.phase === 'playing' && state.currentTurnId === playerId && playerId !== state.hostId),
      pattern: state.secretPhrase ? this.pattern(state) : '',
      guessedLetters: [...state.guessedLetters],
      misses: state.misses,
      maxMisses: MAX_MISSES,
      yourSecretPhrase: playerId === state.hostId ? state.secretPhrase : null,
      revealedPhrase: state.phase === 'finished' ? state.secretPhrase : null,
    };
  }

  surrender(state: HangmanGameState, playerId: string): DistinctActionResult<HangmanResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (!state.players.some((player) => player.id === playerId)) return { valid: false, reason: 'Player not found' };
    const winnerId = playerId === state.hostId ? this.guessers(state)[0].id : state.hostId;
    return this.finish(state, winnerId, 'surrender');
  }

  getResult(state: HangmanGameState): HangmanResult {
    if (!state.winnerId || !state.finishReason) throw new Error('Hangman game is not finished');
    return {
      gameKey: this.key,
      winnerId: state.winnerId,
      isDraw: false,
      reason: state.finishReason,
      phrase: state.secretPhrase ?? '',
      misses: state.misses,
    };
  }

  private finish(
    state: HangmanGameState,
    winnerId: string,
    reason: HangmanResult['reason'],
  ): DistinctActionResult<HangmanResult> {
    state.phase = 'finished';
    state.winnerId = winnerId;
    state.finishReason = reason;
    return { valid: true, result: this.getResult(state) };
  }

  private normalizePhrase(value: unknown): string | null {
    if (typeof value !== 'string' || value.length < 1 || value.length > 40 || !/^[A-Za-z ]+$/.test(value)) return null;
    const normalized = value.trim().replace(/\s+/g, ' ').toUpperCase();
    return /[A-Z]/.test(normalized) ? normalized : null;
  }

  private pattern(state: HangmanGameState): string {
    return state.secretPhrase!.split('').map(
      (character) => character === ' ' || state.guessedLetters.includes(character) ? character : '_',
    ).join('');
  }

  private guessers(state: HangmanGameState): HangmanGameState['players'] {
    return state.players.filter((player) => player.id !== state.hostId);
  }

  private nextGuesser(state: HangmanGameState, playerId: string): HangmanGameState['players'][0] {
    const guessers = this.guessers(state);
    const index = guessers.findIndex((player) => player.id === playerId);
    return guessers[(index + 1) % guessers.length];
  }
}