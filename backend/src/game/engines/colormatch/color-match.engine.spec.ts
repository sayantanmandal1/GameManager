import type { ColorMatchCard, ColorMatchColor } from '../../../shared';
import { ColorMatchEngine } from './color-match.engine';

describe('ColorMatchEngine', () => {
  const players = ['a', 'b'];
  const colorCard = (color: ColorMatchColor, value: number): ColorMatchCard => ({ id: `cm-${color}-${value}`, color, value });
  const game = () => {
    const engine = new ColorMatchEngine((cards) => cards, (colors) => colors);
    const state = engine.initGame(players, { a: 'A', b: 'B' });
    return { engine, state };
  };

  it('deals six private cards from a unique 36-card color deck', () => {
    const { engine, state } = game();
    expect(engine.rulesetId).toBe('color-match.simultaneous-six-round.v1');
    expect(state.hands.a).toHaveLength(6);
    expect(state.hands.b).toHaveLength(6);
    expect(new Set([...state.hands.a, ...state.hands.b, ...state.deck].map((card) => card.id)).size).toBe(36);
    expect(state.targets).toEqual(['red', 'red', 'red']);
    expect(() => engine.initGame(['a'], {})).toThrow('two to six');
  });

  it('requires exactly three distinct owned cards and locks one commitment', () => {
    const { engine, state } = game();
    const ids = state.hands.a.slice(0, 3).map((card) => card.id);
    expect(engine.applyAction(state, 'a', { type: 'commit_color_match', cardIds: ids.slice(0, 2) })).toEqual({ valid: false, reason: 'Commit exactly three distinct cards' });
    expect(engine.applyAction(state, 'a', { type: 'commit_color_match', cardIds: [ids[0], ids[0], ids[1]] })).toEqual({ valid: false, reason: 'Commit exactly three distinct cards' });
    expect(engine.applyAction(state, 'a', { type: 'commit_color_match', cardIds: [state.hands.b[0].id, ids[1], ids[2]] })).toEqual({ valid: false, reason: 'Card not in hand' });
    expect(engine.applyAction(state, 'a', { type: 'commit_color_match', cardIds: ids })).toEqual({ valid: true });
    expect(engine.applyAction(state, 'a', { type: 'commit_color_match', cardIds: ids })).toEqual({ valid: false, reason: 'Commitment already locked' });
  });

  it('reveals no opponent hand or committed card before everyone locks', () => {
    const { engine, state } = game();
    const committed = state.hands.a.slice(0, 3).map((card) => card.id);
    engine.applyAction(state, 'a', { type: 'commit_color_match', cardIds: committed });
    const betaView = engine.getPlayerView(state, 'b');
    const serialized = JSON.stringify(betaView);
    expect(betaView.players.find((player) => player.id === 'a')?.committed).toBe(true);
    expect(betaView.yourCommitment).toBeNull();
    for (const card of state.hands.a) expect(serialized).not.toContain(`"${card.id}"`);
  });

  it('scores exact colors, adjacent wheel colors, and unique high exact values', () => {
    const { engine, state } = game();
    state.targets = ['red', 'yellow', 'blue'];
    state.hands.a = [colorCard('red', 5), colorCard('orange', 2), colorCard('green', 4)];
    state.hands.b = [colorCard('red', 3), colorCard('yellow', 6), colorCard('purple', 1)];
    engine.applyAction(state, 'a', { type: 'commit_color_match', cardIds: state.hands.a.map((card) => card.id) });
    expect(engine.applyAction(state, 'b', { type: 'commit_color_match', cardIds: state.hands.b.map((card) => card.id) })).toEqual({ valid: true });
    expect(state.scores).toEqual({ a: 7, b: 9 });
    expect(state.lastReveal).toMatchObject({ roundNumber: 1, points: { a: 7, b: 9 } });
    expect(state.roundNumber).toBe(2);
  });

  it('does not award the value bonus when exact high values tie', () => {
    const { engine, state } = game();
    state.targets = ['red', 'yellow', 'blue'];
    state.hands.a = [colorCard('red', 5), colorCard('yellow', 1), colorCard('blue', 1)];
    state.hands.b = [{ ...colorCard('red', 5), id: 'cm-red-5-b' }, colorCard('yellow', 2), colorCard('blue', 2)];
    engine.applyAction(state, 'a', { type: 'commit_color_match', cardIds: state.hands.a.map((card) => card.id) });
    engine.applyAction(state, 'b', { type: 'commit_color_match', cardIds: state.hands.b.map((card) => card.id) });
    expect(state.lastReveal?.points.a).toBe(9);
    expect(state.lastReveal?.points.b).toBe(13);
  });

  it('reveals all commitments atomically, replenishes hands, and clears the next plan', () => {
    const { engine, state } = game();
    const aIds = state.hands.a.slice(0, 3).map((card) => card.id);
    const bIds = state.hands.b.slice(0, 3).map((card) => card.id);
    const deckBefore = state.deck.length;
    engine.applyAction(state, 'a', { type: 'commit_color_match', cardIds: aIds });
    engine.applyAction(state, 'b', { type: 'commit_color_match', cardIds: bIds });
    expect(state.lastReveal?.commitments.a.map((card) => card.id)).toEqual(aIds);
    expect(state.hands.a).toHaveLength(6);
    expect(state.hands.b).toHaveLength(6);
    expect(state.deck).toHaveLength(deckBefore - 6);
    expect(state.commitments).toEqual({ a: null, b: null });
  });

  it('finishes after round six with a unique high score or draw', () => {
    const winner = game();
    winner.state.roundNumber = 6; winner.state.scores = { a: 20, b: 0 };
    winner.state.targets = ['red', 'yellow', 'blue'];
    winner.state.hands.a = [colorCard('red', 1), colorCard('yellow', 1), colorCard('blue', 1)];
    winner.state.hands.b = [colorCard('green', 1), colorCard('green', 2), colorCard('green', 3)];
    winner.engine.applyAction(winner.state, 'a', { type: 'commit_color_match', cardIds: winner.state.hands.a.map((card) => card.id) });
    expect(winner.engine.applyAction(winner.state, 'b', { type: 'commit_color_match', cardIds: winner.state.hands.b.map((card) => card.id) }).result).toMatchObject({ winnerId: 'a', isDraw: false, reason: 'six_rounds' });

    const draw = game();
    draw.state.roundNumber = 6; draw.state.scores = { a: 0, b: 0 };
    draw.state.targets = ['red', 'yellow', 'blue'];
    draw.state.hands.a = [colorCard('green', 1), colorCard('purple', 1), colorCard('red', 1)];
    draw.state.hands.b = [{ ...colorCard('green', 1), id: 'b1' }, { ...colorCard('purple', 1), id: 'b2' }, { ...colorCard('red', 1), id: 'b3' }];
    draw.engine.applyAction(draw.state, 'a', { type: 'commit_color_match', cardIds: draw.state.hands.a.map((card) => card.id) });
    expect(draw.engine.applyAction(draw.state, 'b', { type: 'commit_color_match', cardIds: draw.state.hands.b.map((card) => card.id) }).result).toMatchObject({ winnerId: null, isDraw: true });
  });

  it('awards surrender to the highest-scoring remaining player', () => {
    const engine = new ColorMatchEngine((cards) => cards, (colors) => colors);
    const state = engine.initGame(['a', 'b', 'c'], {});
    state.scores = { a: 1, b: 8, c: 3 };
    expect(engine.surrender(state, 'a').result).toMatchObject({ winnerId: 'b', reason: 'surrender' });
  });
});