import type { HexAction } from '../../../shared';
import { HexEngine } from './hex.engine';

describe('HexEngine', () => {
  const game = () => {
    const engine = new HexEngine();
    return { engine, state: engine.initGame(['a', 'b'], { a: 'Alice', b: 'Bob' }) };
  };

  it('creates an empty 11 by 11 board for exactly two players', () => {
    const { engine, state } = game();
    expect(engine.rulesetId).toBe('hex.standard-11x11.v1');
    expect(state.board).toHaveLength(121);
    expect(state.board.every((cell) => cell === null)).toBe(true);
    expect(() => engine.initGame(['a'], {})).toThrow('exactly two');
  });

  it('enforces turn ownership', () => {
    const { engine, state } = game();
    expect(engine.applyAction(state, 'b', { type: 'place_hex', cell: 0 })).toEqual({ valid: false, reason: 'Not your turn' });
  });

  it('rejects out-of-range, occupied, and extra-field placements', () => {
    const { engine, state } = game();
    expect(engine.applyAction(state, 'a', { type: 'place_hex', cell: 121 })).toEqual({ valid: false, reason: 'Invalid placement' });
    expect(engine.applyAction(state, 'a', { type: 'place_hex', cell: 0, rogue: true } as unknown as HexAction)).toEqual({ valid: false, reason: 'Invalid placement' });
    engine.applyAction(state, 'a', { type: 'place_hex', cell: 0 });
    expect(engine.applyAction(state, 'b', { type: 'place_hex', cell: 0 })).toEqual({ valid: false, reason: 'Cell is occupied' });
  });

  it('alternates vertical and horizontal stones', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'place_hex', cell: 0 });
    engine.applyAction(state, 'b', { type: 'place_hex', cell: 1 });
    expect(state.board.slice(0, 2)).toEqual(['vertical', 'horizontal']);
    expect(state.currentTurnId).toBe('a');
  });

  it('projects only the public board and a defensive legal-cell list', () => {
    const { engine, state } = game();
    const view = engine.getPlayerView(state, 'a');
    expect(view).not.toHaveProperty('finishReason');
    expect(view.yourStone).toBe('vertical');
    expect(view.legalCells).toHaveLength(121);
    view.board[0] = 'vertical';
    expect(state.board[0]).toBeNull();
  });

  it('detects a top-to-bottom connection through hex neighbors', () => {
    const { engine, state } = game();
    for (let row = 0; row < 10; row += 1) state.board[row * 11] = 'vertical';
    const outcome = engine.applyAction(state, 'a', { type: 'place_hex', cell: 110 });
    expect(outcome.result).toEqual({ gameKey: 'hex', winnerId: 'a', isDraw: false, reason: 'connection' });
  });

  it('detects a left-to-right connection for the second player', () => {
    const { engine, state } = game();
    state.currentTurnId = 'b';
    for (let column = 0; column < 10; column += 1) state.board[55 + column] = 'horizontal';
    expect(engine.applyAction(state, 'b', { type: 'place_hex', cell: 65 }).result?.winnerId).toBe('b');
  });

  it('rejects moves after a terminal connection', () => {
    const { engine, state } = game();
    state.phase = 'finished';
    state.winnerId = 'a';
    state.finishReason = 'connection';
    expect(engine.applyAction(state, 'a', { type: 'place_hex', cell: 0 })).toEqual({ valid: false, reason: 'Game already finished' });
  });

  it('awards surrender to the opponent', () => {
    const { engine, state } = game();
    expect(engine.surrender(state, 'a').result).toEqual({ gameKey: 'hex', winnerId: 'b', isDraw: false, reason: 'surrender' });
  });
});