import type { GolfGameState, StandardCard } from '../../../shared';
import { SixCardGolfEngine } from './six-card-golf.engine';

describe('SixCardGolfEngine', () => {
  const players = ['a', 'b'];
  const card = (suit: StandardCard['suit'], rank: StandardCard['rank'], suffix = ''): StandardCard => ({ id: `c-${suit}-${rank}${suffix}`, suit, rank });
  const game = () => {
    const engine = new SixCardGolfEngine((cards) => cards);
    const state = engine.initGame(players, { a: 'A', b: 'B' });
    return { engine, state };
  };
  const finishSetup = (engine: SixCardGolfEngine, state: GolfGameState) => {
    engine.applyAction(state, 'a', { type: 'reveal_golf_cards', indices: [0, 1] });
    engine.applyAction(state, 'b', { type: 'reveal_golf_cards', indices: [0, 1] });
  };

  it('deals hidden two-by-three grids, one discard, and a unique deck', () => {
    const { engine, state } = game();
    expect(engine.rulesetId).toBe('six-card-golf.standard-nine-hole.v1');
    expect(state.grids.a).toHaveLength(6);
    expect(state.grids.b).toHaveLength(6);
    expect(state.grids.a.every((entry) => !entry.faceUp)).toBe(true);
    expect(state.discardPile).toHaveLength(1);
    expect(new Set([...state.grids.a, ...state.grids.b].map((entry) => entry.card).concat(state.stock, state.discardPile).map((entry) => entry.id)).size).toBe(52);
    expect(() => engine.initGame(['a'], {})).toThrow('two to four');
  });

  it('reveals exactly two setup positions per player before play starts', () => {
    const { engine, state } = game();
    expect(engine.applyAction(state, 'a', { type: 'reveal_golf_cards', indices: [0] })).toEqual({ valid: false, reason: 'Reveal exactly two distinct grid cards' });
    expect(engine.applyAction(state, 'a', { type: 'reveal_golf_cards', indices: [0, 0] })).toEqual({ valid: false, reason: 'Reveal exactly two distinct grid cards' });
    expect(engine.applyAction(state, 'a', { type: 'reveal_golf_cards', indices: [0, 5] })).toEqual({ valid: true });
    expect(state.phase).toBe('setup');
    expect(engine.applyAction(state, 'b', { type: 'reveal_golf_cards', indices: [1, 4] })).toEqual({ valid: true });
    expect(state).toMatchObject({ phase: 'drawing', currentTurnId: 'b' });
  });

  it('never exposes any face-down grid identity, including to its owner', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'reveal_golf_cards', indices: [0, 1] });
    const view = engine.getPlayerView(state, 'a');
    expect(view.yourGrid[0].card?.id).toBe(state.grids.a[0].card.id);
    expect(view.yourGrid[2]).toEqual({ card: null, faceUp: false });
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain(`"${state.grids.a[2].card.id}"`);
    expect(serialized).not.toContain(`"${state.grids.b[0].card.id}"`);
  });

  it('keeps a stock draw private to its drawer', () => {
    const { engine, state } = game();
    finishSetup(engine, state);
    const drawnId = state.stock[0].id;
    expect(engine.applyAction(state, 'b', { type: 'draw_golf_card', source: 'stock' })).toEqual({ valid: true });
    expect(engine.getPlayerView(state, 'b').drawnCard?.id).toBe(drawnId);
    expect(engine.getPlayerView(state, 'a').drawnCard).toBeNull();
    expect(JSON.stringify(engine.getPlayerView(state, 'a'))).not.toContain(`"${drawnId}"`);
  });

  it('forces a discard-pile draw to replace a grid card', () => {
    const { engine, state } = game();
    finishSetup(engine, state);
    const drawnId = state.discardPile.at(-1)!.id;
    engine.applyAction(state, 'b', { type: 'draw_golf_card', source: 'discard' });
    expect(engine.applyAction(state, 'b', { type: 'discard_golf_draw', revealIndex: null })).toEqual({ valid: false, reason: 'A discard-pile draw must replace a grid card' });
    const replacedId = state.grids.b[2].card.id;
    expect(engine.applyAction(state, 'b', { type: 'replace_golf_card', index: 2 })).toEqual({ valid: true });
    expect(state.grids.b[2]).toMatchObject({ card: { id: drawnId }, faceUp: true });
    expect(state.discardPile.at(-1)?.id).toBe(replacedId);
  });

  it('allows a stock draw to be discarded and optionally reveal one hidden card', () => {
    const { engine, state } = game();
    finishSetup(engine, state);
    engine.applyAction(state, 'b', { type: 'draw_golf_card', source: 'stock' });
    expect(engine.applyAction(state, 'b', { type: 'discard_golf_draw', revealIndex: 2 })).toEqual({ valid: true });
    expect(state.grids.b[2].faceUp).toBe(true);
    expect(state.phase).toBe('drawing');
    expect(state.currentTurnId).toBe('a');
  });

  it('scores matching columns zero and applies standard card values', () => {
    const { engine, state } = game();
    state.phase = 'placing'; state.currentTurnId = 'a';
    state.grids.a = [
      { card: card('clubs', 'K'), faceUp: true }, { card: card('clubs', 'A'), faceUp: true },
      { card: card('clubs', '2'), faceUp: true }, { card: card('diamonds', 'K'), faceUp: true },
      { card: card('clubs', 'Q'), faceUp: true }, { card: card('clubs', '4'), faceUp: false },
    ];
    state.grids.b = [
      { card: card('clubs', '5'), faceUp: true }, { card: card('diamonds', '6'), faceUp: true },
      { card: card('hearts', '7'), faceUp: true }, { card: card('diamonds', '5'), faceUp: true },
      { card: card('hearts', '6'), faceUp: true }, { card: card('spades', '7'), faceUp: true },
    ];
    state.drawn = { playerId: 'a', card: card('hearts', '3'), source: 'stock' };
    expect(engine.applyAction(state, 'a', { type: 'replace_golf_card', index: 5 })).toEqual({ valid: true });
    expect(state.phase).toBe('hole_complete');
    expect(state.lastHole?.scores).toEqual({ a: 12, b: 0 });
    expect(state.totalScores).toEqual({ a: 12, b: 0 });
  });

  it('rotates dealer through host-only next holes while preserving totals', () => {
    const { engine, state } = game();
    state.phase = 'hole_complete'; state.totalScores = { a: 12, b: 0 };
    expect(engine.applyAction(state, 'b', { type: 'next_golf_hole' })).toEqual({ valid: false, reason: 'Only the host can start the next hole' });
    expect(engine.applyAction(state, 'a', { type: 'next_golf_hole' })).toEqual({ valid: true });
    expect(state).toMatchObject({ dealerIndex: 1, holeNumber: 2, phase: 'setup', totalScores: { a: 12, b: 0 } });
  });

  it('finishes hole nine with the lowest total or a draw', () => {
    const winner = game();
    winner.state.holeNumber = 9; winner.state.totalScores = { a: 20, b: 5 };
    winner.state.phase = 'placing'; winner.state.currentTurnId = 'a';
    for (const id of players) winner.state.grids[id].forEach((entry) => { entry.faceUp = true; });
    winner.state.grids.a[5].faceUp = false;
    winner.state.drawn = { playerId: 'a', card: card('clubs', 'K', '-new'), source: 'stock' };
    expect(winner.engine.applyAction(winner.state, 'a', { type: 'replace_golf_card', index: 5 }).result).toMatchObject({ winnerId: 'b', isDraw: false, reason: 'nine_holes' });

    const draw = game();
    draw.state.holeNumber = 9; draw.state.totalScores = { a: 0, b: 0 };
    draw.state.phase = 'placing'; draw.state.currentTurnId = 'a';
    const allPairs = [card('clubs', 'K'), card('clubs', 'Q'), card('clubs', '2'), card('diamonds', 'K'), card('diamonds', 'Q'), card('diamonds', '2')];
    draw.state.grids.a = allPairs.map((entry) => ({ card: entry, faceUp: true }));
    draw.state.grids.b = allPairs.map((entry) => ({ card: { ...entry, id: `${entry.id}-b` }, faceUp: true }));
    draw.state.grids.a[5].faceUp = false;
    draw.state.drawn = { playerId: 'a', card: card('diamonds', '2', '-new'), source: 'stock' };
    expect(draw.engine.applyAction(draw.state, 'a', { type: 'replace_golf_card', index: 5 }).result).toMatchObject({ winnerId: null, isDraw: true });
  });

  it('awards surrender to the lowest-scoring remaining player', () => {
    const engine = new SixCardGolfEngine((cards) => cards);
    const state = engine.initGame(['a', 'b', 'c'], {});
    state.totalScores = { a: 1, b: 8, c: 3 };
    expect(engine.surrender(state, 'a').result).toMatchObject({ winnerId: 'c', reason: 'surrender' });
  });
});