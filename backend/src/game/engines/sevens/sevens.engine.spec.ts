import type { StandardCard } from '../../../shared';
import { SevensEngine } from './sevens.engine';

describe('SevensEngine', () => {
  const players = ['a', 'b', 'c', 'd'];
  const card = (suit: StandardCard['suit'], rank: StandardCard['rank']): StandardCard => ({
    id: `c-${suit}-${rank}`,
    suit,
    rank,
  });
  const game = () => {
    const engine = new SevensEngine((cards) => cards);
    const state = engine.initGame(players, { a: 'A', b: 'B', c: 'C', d: 'D' });
    return { engine, state };
  };

  it('deals every card once and starts with the holder of seven of hearts', () => {
    const { engine, state } = game();
    expect(engine.rulesetId).toBe('sevens.hearts-seven-mandatory-100.v1');
    expect(players.map((id) => state.hands[id].length)).toEqual([13, 13, 13, 13]);
    expect(new Set(players.flatMap((id) => state.hands[id].map((entry) => entry.id))).size).toBe(52);
    expect(state.hands[state.currentTurnId].some((entry) => entry.id === 'c-hearts-7')).toBe(true);
    state.hands[state.currentTurnId].push(card('clubs', '7'), card('spades', '7'));
    expect(engine.getPlayerView(state, state.currentTurnId).legalCardIds).toEqual(['c-hearts-7']);
    expect(() => engine.initGame(['a', 'b'], {})).toThrow('three to eight');
  });

  it('requires seven of hearts first and grows each suit only by adjacent rank', () => {
    const { engine, state } = game();
    const opener = state.currentTurnId;
    expect(engine.applyAction(state, opener, { type: 'play_sevens_card', cardId: 'c-hearts-7' })).toEqual({ valid: true });
    expect(state.layout.hearts).toEqual({ low: '7', high: '7' });

    state.currentTurnId = 'a';
    state.hands.a = [card('hearts', '6'), card('hearts', '8'), card('hearts', '5'), card('clubs', '8')];
    expect(engine.getPlayerView(state, 'a').legalCardIds).toEqual(['c-hearts-6', 'c-hearts-8']);
    expect(engine.applyAction(state, 'a', { type: 'play_sevens_card', cardId: 'c-hearts-5' })).toEqual({
      valid: false,
      reason: 'Card is not adjacent to the layout',
    });
    expect(engine.applyAction(state, 'a', { type: 'play_sevens_card', cardId: 'c-clubs-8' })).toEqual({
      valid: false,
      reason: 'Card is not adjacent to the layout',
    });
  });

  it('allows a new suit only with its seven', () => {
    const { engine, state } = game();
    state.layout.hearts = { low: '7', high: '7' };
    state.currentTurnId = 'a';
    state.hands.a = [card('clubs', '7'), card('diamonds', '6')];
    expect(engine.getPlayerView(state, 'a').legalCardIds).toEqual(['c-clubs-7']);
    engine.applyAction(state, 'a', { type: 'play_sevens_card', cardId: 'c-clubs-7' });
    expect(state.layout.clubs).toEqual({ low: '7', high: '7' });
  });

  it('rejects a voluntary pass and allows pass only with no legal card', () => {
    const { engine, state } = game();
    state.layout.hearts = { low: '7', high: '7' };
    state.currentTurnId = 'a';
    state.hands.a = [card('clubs', '7')];
    expect(engine.applyAction(state, 'a', { type: 'pass_sevens' })).toEqual({
      valid: false,
      reason: 'A legal card must be played',
    });
    state.hands.a = [card('clubs', '8')];
    expect(engine.applyAction(state, 'a', { type: 'pass_sevens' })).toEqual({ valid: true });
    expect(state.currentTurnId).toBe('b');
  });

  it('keeps every opponent hand private while exposing counts and layout', () => {
    const { engine, state } = game();
    const view = engine.getPlayerView(state, 'a');
    const serialized = JSON.stringify(view);
    expect(view.yourHand).toHaveLength(13);
    for (const opponentId of ['b', 'c', 'd']) {
      for (const hiddenCard of state.hands[opponentId]) expect(serialized).not.toContain(`"${hiddenCard.id}"`);
    }
    expect(view.players.map((player) => player.handCount)).toEqual([13, 13, 13, 13]);
  });

  it('scores all remaining pip values for the round winner', () => {
    const { engine, state } = game();
    state.currentTurnId = 'a';
    state.layout.clubs = { low: '7', high: '7' };
    state.hands = {
      a: [card('clubs', '6')],
      b: [card('clubs', 'A')],
      c: [card('diamonds', 'Q')],
      d: [card('spades', 'K')],
    };
    expect(engine.applyAction(state, 'a', { type: 'play_sevens_card', cardId: 'c-clubs-6' })).toEqual({ valid: true });
    expect(state).toMatchObject({ phase: 'round_complete', scores: { a: 26 } });
    expect(state.lastRound).toMatchObject({ winnerId: 'a', points: 26, handPoints: { a: 0, b: 1, c: 12, d: 13 } });
  });

  it('lets only the host start the next round and rotates the dealer', () => {
    const { engine, state } = game();
    state.phase = 'round_complete';
    state.currentTurnId = 'a';
    expect(engine.applyAction(state, 'b', { type: 'next_sevens_round' })).toEqual({
      valid: false,
      reason: 'Only the host can start the next round',
    });
    expect(engine.applyAction(state, 'a', { type: 'next_sevens_round' })).toEqual({ valid: true });
    expect(state).toMatchObject({ dealerIndex: 1, roundNumber: 2, phase: 'playing' });
    expect(players.flatMap((id) => state.hands[id])).toHaveLength(52);
  });

  it('finishes when the round winner reaches one hundred points', () => {
    const { engine, state } = game();
    state.scores.a = 99;
    state.currentTurnId = 'a';
    state.layout.clubs = { low: '7', high: '7' };
    state.hands = {
      a: [card('clubs', '6')],
      b: [card('clubs', 'A')],
      c: [],
      d: [],
    };
    expect(engine.applyAction(state, 'a', { type: 'play_sevens_card', cardId: 'c-clubs-6' }).result).toMatchObject({
      gameKey: 'sevens', winnerId: 'a', reason: 'target_score', scores: { a: 100 },
    });
  });

  it('awards surrender to the highest-scoring remaining player', () => {
    const { engine, state } = game();
    state.scores = { a: 5, b: 20, c: 10, d: 15 };
    expect(engine.surrender(state, 'c').result).toMatchObject({ winnerId: 'b', reason: 'surrender' });
    expect(engine.applyAction(state, 'a', { type: 'pass_sevens' })).toEqual({ valid: false, reason: 'Game already finished' });
  });
});