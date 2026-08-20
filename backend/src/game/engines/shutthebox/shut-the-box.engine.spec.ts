import { ShutTheBoxEngine } from './shut-the-box.engine';

describe('ShutTheBoxEngine', () => {
  const game = (rolls = [3, 4]) => {
    const values = [...rolls];
    const engine = new ShutTheBoxEngine(() => values.shift() ?? 1);
    return { engine, state: engine.initGame(['a', 'b'], { a: 'Alice', b: 'Bob' }) };
  };

  it('sets up tiles one through nine for every player', () => {
    const { state } = game();
    expect(state.openTiles).toEqual({ a: [1, 2, 3, 4, 5, 6, 7, 8, 9], b: [1, 2, 3, 4, 5, 6, 7, 8, 9] });
    expect(state).toMatchObject({ scores: { a: null, b: null }, currentTurnId: 'a', phase: 'rolling' });
  });

  it('enforces turn ownership', () => {
    const { engine, state } = game();
    expect(engine.applyAction(state, 'b', { type: 'roll_box' })).toEqual({ valid: false, reason: 'Not your turn' });
  });

  it('rolls two server dice while the open tile sum exceeds six', () => {
    const { engine, state } = game([3, 4]);
    engine.applyAction(state, 'a', { type: 'roll_box', dice: [6, 6] } as never);
    expect(state.roll).toEqual([3, 4]);
    expect(state.phase).toBe('closing');
    expect(engine.getPlayerView(state, 'a').legalCombinations).toContainEqual([3, 4]);
  });

  it('uses one die when the remaining open tile sum is six or less', () => {
    const { engine, state } = game([6, 2]);
    state.openTiles.a = [1, 2, 3];
    engine.applyAction(state, 'a', { type: 'roll_box' });
    expect(state.roll).toEqual([6]);
    expect(state.phase).toBe('closing');
  });

  it('closes a unique open combination that exactly totals the roll', () => {
    const { engine, state } = game([3, 4]);
    engine.applyAction(state, 'a', { type: 'roll_box' });
    expect(engine.applyAction(state, 'a', { type: 'close_tiles', tiles: [4, 3] }).valid).toBe(true);
    expect(state.openTiles.a).toEqual([1, 2, 5, 6, 7, 8, 9]);
    expect(state.phase).toBe('rolling');
  });

  it('rejects duplicate, closed, or wrong-sum tile selections', () => {
    const { engine, state } = game([3, 4]);
    engine.applyAction(state, 'a', { type: 'roll_box' });
    expect(engine.applyAction(state, 'a', { type: 'close_tiles', tiles: [3, 3] })).toEqual({ valid: false, reason: 'Invalid tile selection' });
    expect(engine.applyAction(state, 'a', { type: 'close_tiles', tiles: [1, 2] })).toEqual({ valid: false, reason: 'Tiles must be open and total the roll' });
  });

  it('ends a personal turn and records open tile sum when no combination exists', () => {
    const { engine, state } = game([1, 1]);
    state.openTiles.a = [9];
    expect(engine.applyAction(state, 'a', { type: 'roll_box' }).valid).toBe(true);
    expect(state).toMatchObject({ scores: { a: 9, b: null }, currentTurnId: 'b', phase: 'rolling' });
  });

  it('returns an isolated public tile projection', () => {
    const { engine, state } = game([3, 4]);
    engine.applyAction(state, 'a', { type: 'roll_box' });
    const view = engine.getPlayerView(state, 'a');
    view.openTiles.a.splice(0, 1);
    view.roll[0] = 6;
    expect(state.openTiles.a[0]).toBe(1);
    expect(state.roll[0]).toBe(3);
  });

  it('finishes after every player turn and awards the lowest score', () => {
    const { engine, state } = game([1, 1]);
    state.scores.a = 5;
    state.currentTurnId = 'b';
    state.openTiles.b = [9];
    const result = engine.applyAction(state, 'b', { type: 'roll_box' });
    expect(result.result).toMatchObject({ winnerId: 'a', reason: 'round_complete', scores: { a: 5, b: 9 } });
  });

  it('awards surrender to the next player', () => {
    const { engine, state } = game();
    expect(engine.surrender(state, 'a').result).toMatchObject({ winnerId: 'b', reason: 'surrender' });
  });
});