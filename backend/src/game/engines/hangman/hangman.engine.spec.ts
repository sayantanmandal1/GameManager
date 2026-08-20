import { HangmanEngine } from './hangman.engine';

describe('HangmanEngine', () => {
  const game = () => {
    const engine = new HangmanEngine();
    return { engine, state: engine.initGame(['a', 'b', 'c'], { a: 'Alice', b: 'Bob', c: 'Cara' }) };
  };

  it('sets up the host with the phrase still unset', () => {
    const { state } = game();
    expect(state).toMatchObject({ hostId: 'a', phase: 'setup', secretPhrase: null, misses: 0, currentTurnId: 'a' });
  });

  it('allows only the host to submit a validated phrase', () => {
    const { engine, state } = game();
    expect(engine.applyAction(state, 'b', { type: 'set_phrase', phrase: 'HELLO' })).toEqual({
      valid: false,
      reason: 'Only the host can set the phrase',
    });
    expect(engine.applyAction(state, 'a', { type: 'set_phrase', phrase: 'bad 123' }).valid).toBe(false);
  });

  it('normalizes the phrase and starts with the first non-host player', () => {
    const { engine, state } = game();
    expect(engine.applyAction(state, 'a', { type: 'set_phrase', phrase: 'hello   world' }).valid).toBe(true);
    expect(state).toMatchObject({ secretPhrase: 'HELLO WORLD', phase: 'playing', currentTurnId: 'b' });
  });

  it('enforces turn order and prevents the host from guessing', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'set_phrase', phrase: 'HELLO' });
    expect(engine.applyAction(state, 'c', { type: 'guess_letter', letter: 'H' })).toEqual({ valid: false, reason: 'Not your turn' });
    expect(engine.applyAction(state, 'a', { type: 'guess_letter', letter: 'H' })).toEqual({ valid: false, reason: 'The host cannot guess' });
  });

  it('reveals matching letters and rejects duplicate guesses', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'set_phrase', phrase: 'HELLO' });
    engine.applyAction(state, 'b', { type: 'guess_letter', letter: 'l' });
    expect(engine.getPlayerView(state, 'c').pattern).toBe('__LL_');
    expect(engine.applyAction(state, 'c', { type: 'guess_letter', letter: 'L' })).toEqual({
      valid: false,
      reason: 'Letter already guessed',
    });
  });

  it('redacts the phrase from guessers until the game ends', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'set_phrase', phrase: 'SECRET WORD' });
    expect(engine.getPlayerView(state, 'a').yourSecretPhrase).toBe('SECRET WORD');
    expect(engine.getPlayerView(state, 'b')).toMatchObject({ yourSecretPhrase: null, revealedPhrase: null });
    expect(JSON.stringify(engine.getPlayerView(state, 'b'))).not.toContain('SECRET WORD');
  });

  it('finishes for the player who solves the full phrase', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'set_phrase', phrase: 'HELLO WORLD' });
    const result = engine.applyAction(state, 'b', { type: 'guess_phrase', phrase: 'hello world' });
    expect(result.result).toMatchObject({ winnerId: 'b', reason: 'phrase_guessed', phrase: 'HELLO WORLD' });
    expect(engine.getPlayerView(state, 'c').revealedPhrase).toBe('HELLO WORLD');
  });

  it('awards the host when the shared eighth miss is spent', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'set_phrase', phrase: 'HELLO' });
    state.misses = 7;
    const result = engine.applyAction(state, 'b', { type: 'guess_letter', letter: 'Z' });
    expect(result.result).toMatchObject({ winnerId: 'a', reason: 'miss_limit', misses: 8 });
  });

  it('awards surrender to the opposing side', () => {
    const { engine, state } = game();
    expect(engine.surrender(state, 'b').result).toMatchObject({ winnerId: 'a', reason: 'surrender' });
  });
});