import type { MemoryMatchAction } from '../../../shared';
import { MemoryMatchEngine } from './memory-match.engine';

describe('MemoryMatchEngine', () => {
  const game = () => {
    const engine = new MemoryMatchEngine((symbols) => symbols);
    return { engine, state: engine.initGame(['a', 'b'], { a: 'Alice', b: 'Bob' }) };
  };

  it('creates one shuffled 24-tile deck containing twelve pairs', () => {
    const { engine, state } = game();
    expect(engine.rulesetId).toBe('memory-match.standard-24-tile.v1');
    expect(state.tiles).toHaveLength(24);
    expect(new Set(state.tiles.map((tile) => tile.symbol).values()).size).toBe(12);
    expect(() => engine.initGame(['a'], {})).toThrow('two to four');
  });

  it('enforces turn ownership', () => {
    const { engine, state } = game();
    expect(engine.applyAction(state, 'b', { type: 'reveal_tile', tileIndex: 0 })).toEqual({ valid: false, reason: 'Not your turn' });
  });

  it('rejects invalid indices and extra action fields', () => {
    const { engine, state } = game();
    expect(engine.applyAction(state, 'a', { type: 'reveal_tile', tileIndex: 24 })).toEqual({ valid: false, reason: 'Invalid tile' });
    expect(engine.applyAction(state, 'a', { type: 'reveal_tile', tileIndex: 0, cardId: 'x' } as unknown as MemoryMatchAction)).toEqual({ valid: false, reason: 'Invalid tile' });
  });

  it('reveals only selected or matched symbols in player projections', () => {
    const { engine, state } = game();
    expect(engine.getPlayerView(state, 'a').tiles.every((tile) => tile.symbol === null)).toBe(true);
    engine.applyAction(state, 'a', { type: 'reveal_tile', tileIndex: 0 });
    const view = engine.getPlayerView(state, 'b');
    expect(view.tiles[0].symbol).toBe('Anchor');
    expect(view.tiles[1].symbol).toBeNull();
    expect(view).not.toHaveProperty('finishReason');
  });

  it('keeps a matched pair and grants the scorer an extra turn', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'reveal_tile', tileIndex: 0 });
    engine.applyAction(state, 'a', { type: 'reveal_tile', tileIndex: 12 });
    expect(state.scores.a).toBe(1);
    expect(state.tiles[0].matchedBy).toBe('a');
    expect(state.currentTurnId).toBe('a');
    expect(state.revealedIndices).toEqual([]);
  });

  it('shows a mismatch until the next player acknowledges it', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'reveal_tile', tileIndex: 0 });
    engine.applyAction(state, 'a', { type: 'reveal_tile', tileIndex: 1 });
    expect(state.phase).toBe('awaiting_ack');
    expect(state.currentTurnId).toBe('b');
    expect(engine.getPlayerView(state, 'b').tiles.slice(0, 2).map((tile) => tile.symbol)).toEqual(['Anchor', 'Bell']);
    expect(engine.applyAction(state, 'b', { type: 'reveal_tile', tileIndex: 2 })).toEqual({ valid: false, reason: 'Mismatch must be acknowledged' });
    engine.applyAction(state, 'b', { type: 'acknowledge_mismatch' });
    expect(engine.getPlayerView(state, 'b').tiles[0].symbol).toBeNull();
  });

  it('finishes and scores when the final pair is matched', () => {
    const { engine, state } = game();
    for (let index = 1; index < 12; index += 1) {
      state.tiles[index].matchedBy = 'b';
      state.tiles[index + 12].matchedBy = 'b';
      state.scores.b += 1;
    }
    engine.applyAction(state, 'a', { type: 'reveal_tile', tileIndex: 0 });
    const outcome = engine.applyAction(state, 'a', { type: 'reveal_tile', tileIndex: 12 });
    expect(outcome.result).toMatchObject({ winnerId: 'b', reason: 'all_pairs', scores: { a: 1, b: 11 } });
  });

  it('rejects actions after the game finishes', () => {
    const { engine, state } = game();
    state.phase = 'finished';
    state.finishReason = 'all_pairs';
    expect(engine.applyAction(state, 'a', { type: 'reveal_tile', tileIndex: 0 })).toEqual({ valid: false, reason: 'Game already finished' });
  });

  it('awards surrender to a remaining player', () => {
    const { engine, state } = game();
    expect(engine.surrender(state, 'a').result).toMatchObject({ winnerId: 'b', reason: 'surrender' });
  });
});