import { StandardCard } from '../../../shared';
import { GoFishEngine } from './go-fish.engine';

describe('GoFishEngine', () => {
  const card = (suit: StandardCard['suit'], rank: StandardCard['rank']): StandardCard => ({
    id: `c-${suit}-${rank}`, suit, rank,
  });
  const game = () => {
    const engine = new GoFishEngine((cards) => cards);
    return { engine, state: engine.initGame(['a', 'b'], { a: 'Alice', b: 'Bob' }) };
  };

  it('deals seven private cards each from a 52-card server deck', () => {
    const { state } = game();
    expect(state.hands.a).toHaveLength(7);
    expect(state.hands.b).toHaveLength(7);
    expect(state.deck).toHaveLength(38);
    expect(new Set([...state.hands.a, ...state.hands.b, ...state.deck].map((entry) => entry.id)).size).toBe(52);
  });

  it('enforces turn ownership', () => {
    const { engine, state } = game();
    expect(engine.applyAction(state, 'b', { type: 'ask', targetPlayerId: 'a', rank: 'Q' })).toEqual({
      valid: false,
      reason: 'Not your turn',
    });
  });

  it('requires a valid opponent and a rank held by the asker', () => {
    const { engine, state } = game();
    expect(engine.applyAction(state, 'a', { type: 'ask', targetPlayerId: 'a', rank: 'K' })).toEqual({ valid: false, reason: 'Invalid target' });
    expect(engine.applyAction(state, 'a', { type: 'ask', targetPlayerId: 'b', rank: 'Q' })).toEqual({ valid: false, reason: 'You must hold the requested rank' });
  });

  it('transfers every matching rank and keeps the successful asker turn', () => {
    const { engine, state } = game();
    state.hands.a = [card('clubs', 'A')];
    state.hands.b = [card('diamonds', 'A'), card('hearts', 'A'), card('clubs', 'K')];
    expect(engine.applyAction(state, 'a', { type: 'ask', targetPlayerId: 'b', rank: 'A' }).valid).toBe(true);
    expect(state.hands.a.map((entry) => entry.id)).toEqual(['c-clubs-A', 'c-diamonds-A', 'c-hearts-A']);
    expect(state.hands.b.map((entry) => entry.rank)).not.toContain('A');
    expect(state.currentTurnId).toBe('a');
  });

  it('draws from the server deck and keeps the turn on a lucky rank', () => {
    const { engine, state } = game();
    state.hands.a = [card('clubs', 'A')];
    state.hands.b = [card('clubs', 'K')];
    state.deck = [card('spades', 'A')];
    engine.applyAction(state, 'a', { type: 'ask', targetPlayerId: 'b', rank: 'A' });
    expect(state.hands.a).toContainEqual(card('spades', 'A'));
    expect(state.currentTurnId).toBe('a');
  });

  it('completes a four-card book automatically', () => {
    const { engine, state } = game();
    state.hands.a = [card('clubs', 'K')];
    state.hands.b = [card('diamonds', 'K'), card('hearts', 'K'), card('spades', 'K'), card('clubs', 'A')];
    engine.applyAction(state, 'a', { type: 'ask', targetPlayerId: 'b', rank: 'K' });
    expect(state.books.a).toContain('K');
    expect(state.hands.a.some((entry) => entry.rank === 'K')).toBe(false);
  });

  it('redacts opponents hands while exposing counts and books', () => {
    const { engine, state } = game();
    const view = engine.getPlayerView(state, 'a');
    expect(view.yourHand).toEqual(state.hands.a);
    expect(view.players.find((player) => player.id === 'b')?.handCount).toBe(7);
    expect(JSON.stringify(view)).not.toContain('c-spades-Q');
    expect(Object.prototype.hasOwnProperty.call(view.players[1], 'hand')).toBe(false);
  });

  it('finishes with the highest book score when deck and hands are exhausted', () => {
    const { engine, state } = game();
    state.deck = [];
    state.books.a = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q'];
    state.books.b = [];
    state.hands.a = [card('clubs', 'K')];
    state.hands.b = [card('diamonds', 'K'), card('hearts', 'K'), card('spades', 'K')];
    const result = engine.applyAction(state, 'a', { type: 'ask', targetPlayerId: 'b', rank: 'K' });
    expect(result.result).toMatchObject({ winnerId: 'a', reason: 'all_books', scores: { a: 13, b: 0 } });
  });

  it('awards surrender to the next player', () => {
    const { engine, state } = game();
    expect(engine.surrender(state, 'a').result).toMatchObject({ winnerId: 'b', reason: 'surrender' });
  });
});