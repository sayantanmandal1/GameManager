import type { MorrisAction } from '../../../shared';
import { MORRIS_ADJACENCY, MORRIS_MILLS, NineMensMorrisEngine } from './nine-mens-morris.engine';

describe('NineMensMorrisEngine', () => {
  const game = () => {
    const engine = new NineMensMorrisEngine();
    return { engine, state: engine.initGame(['a', 'b'], { a: 'Alice', b: 'Bob' }) };
  };

  it('creates the standard 24-node graph and sixteen mills', () => {
    const { engine, state } = game();
    expect(engine.rulesetId).toBe('nine-mens-morris.standard-24-node.v1');
    expect(state.board).toHaveLength(24);
    expect(MORRIS_ADJACENCY).toHaveLength(24);
    expect(MORRIS_MILLS).toHaveLength(16);
    expect(() => engine.initGame(['a'], {})).toThrow('exactly two');
  });

  it('enforces turn ownership and placement phase', () => {
    const { engine, state } = game();
    expect(engine.applyAction(state, 'b', { type: 'place_stone', node: 0 })).toEqual({ valid: false, reason: 'Not your turn' });
    expect(engine.applyAction(state, 'a', { type: 'move_stone', from: 0, to: 1 })).toEqual({ valid: false, reason: 'Invalid placement' });
  });

  it('alternates legal placements and rejects occupied or extra-field actions', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'place_stone', node: 0 });
    expect(state.currentTurnId).toBe('b');
    expect(engine.applyAction(state, 'b', { type: 'place_stone', node: 0 })).toEqual({ valid: false, reason: 'Node is occupied' });
    expect(engine.applyAction(state, 'b', { type: 'place_stone', node: 1, rogue: true } as unknown as MorrisAction)).toEqual({ valid: false, reason: 'Invalid placement' });
  });

  it('forming a mill grants a constrained removal before the turn advances', () => {
    const { engine, state } = game();
    state.board[0] = 'a';
    state.board[1] = 'a';
    state.board[3] = 'b';
    state.stonesPlaced = { a: 2, b: 1 };
    engine.applyAction(state, 'a', { type: 'place_stone', node: 2 });
    expect(state.phase).toBe('removing');
    expect(state.currentTurnId).toBe('a');
    expect(engine.getPlayerView(state, 'a').removableNodes).toEqual([3]);
    engine.applyAction(state, 'a', { type: 'remove_stone', node: 3 });
    expect(state.currentTurnId).toBe('b');
  });

  it('protects stones in mills while an outside stone is available', () => {
    const { engine, state } = game();
    state.phase = 'removing';
    state.resumePhase = 'placement';
    state.board[3] = state.board[4] = state.board[5] = 'b';
    state.board[6] = 'b';
    expect(engine.getPlayerView(state, 'a').removableNodes).toEqual([6]);
    expect(engine.applyAction(state, 'a', { type: 'remove_stone', node: 3 })).toEqual({ valid: false, reason: 'Stone cannot be removed' });
  });

  it('requires adjacency above three stones and permits flying with three', () => {
    const { engine, state } = game();
    state.phase = 'movement';
    state.board[0] = state.board[1] = state.board[2] = state.board[9] = 'a';
    state.board[3] = state.board[4] = state.board[5] = state.board[6] = 'b';
    expect(engine.applyAction(state, 'a', { type: 'move_stone', from: 0, to: 23 })).toEqual({ valid: false, reason: 'Stones must move to an adjacent node' });
    state.board[9] = null;
    expect(engine.getPlayerView(state, 'a').canFly).toBe(true);
    expect(engine.applyAction(state, 'a', { type: 'move_stone', from: 0, to: 23 }).valid).toBe(true);
  });

  it('ends movement when a mill removal leaves the opponent below three stones', () => {
    const { engine, state } = game();
    state.phase = 'removing';
    state.resumePhase = 'movement';
    state.board[0] = state.board[1] = state.board[2] = 'a';
    state.board[3] = state.board[4] = state.board[6] = 'b';
    const outcome = engine.applyAction(state, 'a', { type: 'remove_stone', node: 6 });
    expect(outcome.result).toMatchObject({ winnerId: 'a', reason: 'fewer_than_three', stoneCounts: { a: 3, b: 2 } });
  });

  it('projects a defensive public board and phase-specific legal actions', () => {
    const { engine, state } = game();
    const view = engine.getPlayerView(state, 'a');
    expect(view.legalPlacements).toHaveLength(24);
    expect(view).not.toHaveProperty('resumePhase');
    view.board[0] = 'a';
    expect(state.board[0]).toBeNull();
  });

  it('rejects actions after finish and awards surrender to the opponent', () => {
    const { engine, state } = game();
    expect(engine.surrender(state, 'a').result).toMatchObject({ winnerId: 'b', reason: 'surrender' });
    expect(engine.applyAction(state, 'b', { type: 'place_stone', node: 0 })).toEqual({ valid: false, reason: 'Game already finished' });
  });
});