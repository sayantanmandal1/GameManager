import { Domino, PlacedDomino } from '../../../shared';
import { DrawDominoesEngine } from './draw-dominoes.engine';

describe('DrawDominoesEngine', () => {
  const domino = (a: number, b: number): Domino => ({ id: `d-${a}-${b}`, a, b });
  const placed = (a: number, b: number, left = a, right = b): PlacedDomino => ({ ...domino(a, b), left, right });
  const game = () => {
    const engine = new DrawDominoesEngine((dominoes) => dominoes);
    return { engine, state: engine.initGame(['a', 'b'], { a: 'Alice', b: 'Bob' }) };
  };

  it('deals seven private double-six tiles and leaves a fourteen-tile boneyard', () => {
    const { state } = game();
    expect(state.hands.a).toHaveLength(7);
    expect(state.hands.b).toHaveLength(7);
    expect(state.boneyard).toHaveLength(14);
    expect(new Set([...state.hands.a, ...state.hands.b, ...state.boneyard].map((entry) => entry.id)).size).toBe(28);
  });

  it('enforces turn ownership', () => {
    const { engine, state } = game();
    expect(engine.applyAction(state, 'b', { type: 'draw_domino' })).toEqual({ valid: false, reason: 'Not your turn' });
  });

  it('allows any owned domino to open the chain with explicit orientation', () => {
    const { engine, state } = game();
    const opening = state.hands.a[0];
    expect(engine.applyAction(state, 'a', { type: 'play_domino', dominoId: opening.id, end: 'right', flip: true }).valid).toBe(true);
    expect(state.chain[0]).toMatchObject({ id: opening.id, left: opening.b, right: opening.a });
    expect(state.currentTurnId).toBe('b');
  });

  it('matches an oriented tile against the selected open end', () => {
    const { engine, state } = game();
    state.chain = [placed(2, 5)];
    state.hands.a = [domino(1, 2), domino(5, 6)];
    engine.applyAction(state, 'a', { type: 'play_domino', dominoId: 'd-1-2', end: 'left', flip: false });
    expect(state.chain[0]).toMatchObject({ left: 1, right: 2 });
    state.currentTurnId = 'a';
    engine.applyAction(state, 'a', { type: 'play_domino', dominoId: 'd-5-6', end: 'right', flip: false });
    expect(state.chain.at(-1)).toMatchObject({ left: 5, right: 6 });
  });

  it('rejects a mismatched orientation and drawing while a play exists', () => {
    const { engine, state } = game();
    state.chain = [placed(2, 5)];
    state.hands.a = [domino(1, 2)];
    expect(engine.applyAction(state, 'a', { type: 'play_domino', dominoId: 'd-1-2', end: 'right', flip: false })).toEqual({ valid: false, reason: 'Domino does not match the right end' });
    expect(engine.applyAction(state, 'a', { type: 'draw_domino' })).toEqual({ valid: false, reason: 'A playable domino must be used' });
  });

  it('draws repeatedly until a playable tile appears and keeps the turn', () => {
    const { engine, state } = game();
    state.chain = [placed(2, 5)];
    state.hands.a = [domino(0, 1)];
    state.boneyard = [domino(3, 4), domino(1, 5)];
    engine.applyAction(state, 'a', { type: 'draw_domino' });
    expect(state.hands.a).toContainEqual(domino(1, 5));
    expect(state.currentTurnId).toBe('a');
    expect(engine.getPlayerView(state, 'a').canDraw).toBe(false);
  });

  it('redacts every opponent tile while exposing hand and boneyard counts', () => {
    const { engine, state } = game();
    const view = engine.getPlayerView(state, 'a');
    expect(view.yourHand).toEqual(state.hands.a);
    expect(view.players[1].handCount).toBe(7);
    expect(view.boneyardCount).toBe(14);
    expect(Object.prototype.hasOwnProperty.call(view.players[1], 'hand')).toBe(false);
    for (const hidden of state.hands.b) expect(JSON.stringify(view)).not.toContain(hidden.id);
  });

  it('wins immediately when a legal play empties the hand', () => {
    const { engine, state } = game();
    state.chain = [placed(2, 5)];
    state.hands.a = [domino(1, 2)];
    const result = engine.applyAction(state, 'a', { type: 'play_domino', dominoId: 'd-1-2', end: 'left', flip: false });
    expect(result.result).toMatchObject({ winnerId: 'a', reason: 'empty_hand', pipSums: { a: 0 } });
  });

  it('ends a blocked game with the lowest remaining pip sum', () => {
    const { engine, state } = game();
    state.chain = [placed(2, 3)];
    state.hands.a = [domino(0, 0)];
    state.hands.b = [domino(1, 1)];
    state.boneyard = [];
    engine.applyAction(state, 'a', { type: 'draw_domino' });
    const result = engine.applyAction(state, 'b', { type: 'draw_domino' });
    expect(result.result).toMatchObject({ winnerId: 'a', reason: 'blocked', pipSums: { a: 0, b: 2 } });
  });

  it('awards surrender to the next player', () => {
    const { engine, state } = game();
    expect(engine.surrender(state, 'a').result).toMatchObject({ winnerId: 'b', reason: 'surrender' });
  });
});