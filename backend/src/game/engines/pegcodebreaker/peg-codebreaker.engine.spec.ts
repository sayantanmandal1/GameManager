import { PegCodebreakerEngine } from './peg-codebreaker.engine';

describe('PegCodebreakerEngine', () => {
  const game = () => {
    const engine = new PegCodebreakerEngine();
    return { engine, state: engine.initGame(['a', 'b'], { a: 'Alice', b: 'Bob' }) };
  };
  const secret = ['red', 'red', 'blue', 'green'] as const;

  it('assigns the first player as maker and second as breaker', () => {
    const { state } = game();
    expect(state).toMatchObject({ makerId: 'a', breakerId: 'b', phase: 'coding', guesses: [] });
  });

  it('allows only the maker to submit the private code', () => {
    const { engine, state } = game();
    expect(engine.applyAction(state, 'b', { type: 'set_code', colors: [...secret] })).toEqual({
      valid: false,
      reason: 'Only the codemaker can set the code',
    });
  });

  it('rejects an invalid color or code length', () => {
    const { engine, state } = game();
    expect(engine.applyAction(state, 'a', { type: 'set_code', colors: ['red'] } as never).valid).toBe(false);
    expect(engine.applyAction(state, 'a', {
      type: 'set_code', colors: ['red', 'blue', 'green', 'cyan'],
    } as never).valid).toBe(false);
  });

  it('scores exact and color-only pegs without double-counting duplicates', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'set_code', colors: [...secret] });
    engine.applyAction(state, 'b', {
      type: 'guess_code', colors: ['red', 'blue', 'red', 'yellow'],
    });
    expect(state.guesses[0]).toEqual({
      colors: ['red', 'blue', 'red', 'yellow'], exact: 1, colorOnly: 2,
    });
  });

  it('allows only the breaker to guess', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'set_code', colors: [...secret] });
    expect(engine.applyAction(state, 'a', { type: 'guess_code', colors: [...secret] })).toEqual({
      valid: false,
      reason: 'Only the codebreaker can guess',
    });
  });

  it('redacts the secret from the breaker until terminal state', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'set_code', colors: [...secret] });
    expect(engine.getPlayerView(state, 'a').yourSecret).toEqual(secret);
    expect(engine.getPlayerView(state, 'b')).toMatchObject({ yourSecret: null, revealedSecret: null });
  });

  it('finishes immediately when the breaker cracks the code', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'set_code', colors: [...secret] });
    const result = engine.applyAction(state, 'b', { type: 'guess_code', colors: [...secret] });
    expect(result.result).toMatchObject({ winnerId: 'b', reason: 'cracked', attempts: 1, secret });
    expect(engine.getPlayerView(state, 'b').revealedSecret).toEqual(secret);
  });

  it('awards the maker after ten failed guesses', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'set_code', colors: [...secret] });
    let result;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      result = engine.applyAction(state, 'b', {
        type: 'guess_code', colors: ['yellow', 'yellow', 'yellow', 'yellow'],
      });
    }
    expect(result?.result).toMatchObject({ winnerId: 'a', reason: 'attempts_exhausted', attempts: 10 });
  });

  it('awards surrender to the other role', () => {
    const { engine, state } = game();
    expect(engine.surrender(state, 'b').result).toMatchObject({ winnerId: 'a', reason: 'surrender' });
  });
});