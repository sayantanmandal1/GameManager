import type { StandardCard } from '../../../shared';
import { PresidentEngine } from './president.engine';

describe('PresidentEngine', () => {
  const players = ['a', 'b', 'c', 'd'];
  const card = (suit: StandardCard['suit'], rank: StandardCard['rank']): StandardCard => ({ id: `c-${suit}-${rank}`, suit, rank });
  const game = () => {
    const engine = new PresidentEngine((cards) => cards);
    const state = engine.initGame(players, { a: 'A', b: 'B', c: 'C', d: 'D' });
    return { engine, state };
  };

  it('deals all cards once and gives the first turn to the three of clubs holder', () => {
    const { engine, state } = game();
    expect(engine.rulesetId).toBe('president.basic-eight-round.v1');
    expect(players.map((id) => state.hands[id].length)).toEqual([13, 13, 13, 13]);
    expect(new Set(players.flatMap((id) => state.hands[id].map((entry) => entry.id))).size).toBe(52);
    expect(state.hands[state.currentTurnId].some((entry) => entry.id === 'c-clubs-3')).toBe(true);
    expect(() => engine.initGame(['a', 'b'], {})).toThrow('three to eight');
  });

  it('requires owned same-rank groups and equal-count higher plays', () => {
    const { engine, state } = game();
    state.currentTurnId = 'a';
    state.hands.a = [card('clubs', '5'), card('diamonds', '5'), card('clubs', '6'), card('clubs', '2')];
    expect(engine.applyAction(state, 'a', { type: 'play_president_cards', cardIds: ['c-clubs-5', 'c-clubs-6'] })).toEqual({ valid: false, reason: 'Cards must share one rank' });
    state.pilePlay = { playerId: 'd', rank: '5', count: 2, cards: [card('hearts', '5'), card('spades', '5')] };
    expect(engine.applyAction(state, 'a', { type: 'play_president_cards', cardIds: ['c-clubs-6'] })).toEqual({ valid: false, reason: 'Play must match the count and beat the rank' });
    expect(engine.applyAction(state, 'a', { type: 'play_president_cards', cardIds: ['c-clubs-5', 'c-diamonds-5'] })).toEqual({ valid: false, reason: 'Play must match the count and beat the rank' });
  });

  it('ranks two above ace and exposes only legal group sizes', () => {
    const { engine, state } = game();
    state.currentTurnId = 'a'; state.pilePlay = { playerId: 'd', rank: 'A', count: 1, cards: [card('clubs', 'A')] };
    state.hands.a = [card('clubs', '2'), card('diamonds', 'K')];
    expect(engine.getPlayerView(state, 'a').legalPlays).toEqual([{ rank: '2', cardIds: ['c-clubs-2'] }]);
    expect(engine.applyAction(state, 'a', { type: 'play_president_cards', cardIds: ['c-clubs-2'] })).toEqual({ valid: true });
  });

  it('allows voluntary passes without locking players out and clears after everyone else passes', () => {
    const { engine, state } = game();
    state.currentTurnId = 'a'; state.pilePlay = { playerId: 'd', rank: '7', count: 1, cards: [card('clubs', '7')] };
    state.hands.a = [card('clubs', 'A')];
    expect(engine.applyAction(state, 'a', { type: 'pass_president' })).toEqual({ valid: true });
    expect(state.currentTurnId).toBe('b');
    expect(engine.getPlayerView(state, 'a').legalPlays).toEqual([]);
    engine.applyAction(state, 'b', { type: 'pass_president' });
    engine.applyAction(state, 'c', { type: 'pass_president' });
    expect(state.pilePlay).toBeNull();
    expect(state.currentTurnId).toBe('d');
    state.currentTurnId = 'a';
    expect(engine.getPlayerView(state, 'a').legalPlays).toContainEqual({ rank: 'A', cardIds: ['c-clubs-A'] });
  });

  it('clears to the next active seat when the last player to play has gone out', () => {
    const { engine, state } = game();
    state.activePlayerIds = ['a', 'b', 'c'];
    state.currentTurnId = 'a'; state.hands = { a: [card('clubs', '2')], b: [card('clubs', '3')], c: [card('clubs', '4')], d: [] };
    engine.applyAction(state, 'a', { type: 'play_president_cards', cardIds: ['c-clubs-2'] });
    expect(state.ranking).toEqual(['a']);
    engine.applyAction(state, 'b', { type: 'pass_president' });
    engine.applyAction(state, 'c', { type: 'pass_president' });
    expect(state.pilePlay).toBeNull();
    expect(state.currentTurnId).toBe('b');
  });

  it('records complete finishing order and awards president two and vice one', () => {
    const { engine, state } = game();
    state.activePlayerIds = ['a', 'b']; state.ranking = ['c', 'd'];
    state.currentTurnId = 'a'; state.hands = { a: [card('clubs', '2')], b: [card('clubs', '3')], c: [], d: [] };
    expect(engine.applyAction(state, 'a', { type: 'play_president_cards', cardIds: ['c-clubs-2'] })).toEqual({ valid: true });
    expect(state).toMatchObject({ phase: 'round_complete', previousRanking: ['c', 'd', 'a', 'b'], scores: { c: 2, d: 1 } });
  });

  it('automatically transfers the bottom player highest card, then president returns any card', () => {
    const { engine, state } = game();
    state.phase = 'round_complete'; state.previousRanking = ['a', 'b', 'c', 'd'];
    expect(engine.applyAction(state, 'a', { type: 'next_president_round' })).toEqual({ valid: true });
    expect(state).toMatchObject({ phase: 'exchange', currentTurnId: 'a', exchangeFromId: 'd', roundNumber: 2 });
    expect(state.hands.a.some((entry) => entry.rank === '2')).toBe(true);
    expect(state.hands.a).toHaveLength(14);
    expect(state.hands.d).toHaveLength(12);
    const returnedId = state.hands.a.find((entry) => entry.rank === '3')?.id ?? state.hands.a[0].id;
    expect(engine.applyAction(state, 'a', { type: 'return_president_card', cardId: returnedId })).toEqual({ valid: true });
    expect(state).toMatchObject({ phase: 'playing', currentTurnId: 'a', exchangeFromId: null });
    expect(state.hands.a).toHaveLength(13);
    expect(state.hands.d).toHaveLength(13);
  });

  it('finishes after eight rounds with unique high score or draw', () => {
    const winner = game();
    winner.state.roundNumber = 8; winner.state.activePlayerIds = ['a', 'b']; winner.state.ranking = ['c', 'd'];
    winner.state.scores = { a: 7, b: 1, c: 0, d: 0 };
    winner.state.currentTurnId = 'a'; winner.state.hands = { a: [card('clubs', '2')], b: [card('clubs', '3')], c: [], d: [] };
    expect(winner.engine.applyAction(winner.state, 'a', { type: 'play_president_cards', cardIds: ['c-clubs-2'] }).result).toMatchObject({ winnerId: 'a', isDraw: false, reason: 'eight_rounds' });

    const draw = game();
    draw.state.roundNumber = 8; draw.state.activePlayerIds = ['a', 'b']; draw.state.ranking = ['c', 'd'];
    draw.state.scores = { a: 4, b: 0, c: 2, d: 0 };
    draw.state.currentTurnId = 'a'; draw.state.hands = { a: [card('clubs', '2')], b: [card('clubs', '3')], c: [], d: [] };
    expect(draw.engine.applyAction(draw.state, 'a', { type: 'play_president_cards', cardIds: ['c-clubs-2'] }).result).toMatchObject({ winnerId: null, isDraw: true });
  });

  it('keeps opponent hands private while exposing counts and current play', () => {
    const { engine, state } = game();
    const view = engine.getPlayerView(state, 'a');
    const serialized = JSON.stringify(view);
    for (const opponentId of ['b', 'c', 'd']) for (const hiddenCard of state.hands[opponentId]) expect(serialized).not.toContain(`"${hiddenCard.id}"`);
  });

  it('awards surrender to the highest-scoring remaining player', () => {
    const { engine, state } = game(); state.scores = { a: 1, b: 5, c: 3, d: 2 };
    expect(engine.surrender(state, 'a').result).toMatchObject({ winnerId: 'b', reason: 'surrender' });
  });
});