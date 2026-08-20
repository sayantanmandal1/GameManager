import { StandardCard } from '../../../shared';
import { CrazyEightsEngine } from './crazy-eights.engine';

describe('CrazyEightsEngine', () => {
  const card = (suit: StandardCard['suit'], rank: StandardCard['rank']): StandardCard => ({
    id: `c-${suit}-${rank}`, suit, rank,
  });
  const game = () => {
    const engine = new CrazyEightsEngine((cards) => cards);
    return { engine, state: engine.initGame(['a', 'b'], { a: 'Alice', b: 'Bob' }) };
  };

  it('deals private hands and starts a non-eight discard', () => {
    const { state } = game();
    expect(state.hands.a).toHaveLength(7);
    expect(state.hands.b).toHaveLength(7);
    expect(state.discardPile).toHaveLength(1);
    expect(state.discardPile[0].rank).not.toBe('8');
    expect(state.currentTurnId).toBe('a');
  });

  it('enforces turn ownership', () => {
    const { engine, state } = game();
    expect(engine.applyAction(state, 'b', { type: 'draw_card' })).toEqual({ valid: false, reason: 'Not your turn' });
  });

  it('plays a matching suit or rank and advances the turn', () => {
    const { engine, state } = game();
    state.discardPile = [card('hearts', '4')];
    state.activeSuit = 'hearts';
    state.hands.a = [card('hearts', 'K'), card('clubs', '2')];
    expect(engine.applyAction(state, 'a', { type: 'play_card', cardId: 'c-hearts-K' }).valid).toBe(true);
    expect(state.discardPile.at(-1)).toEqual(card('hearts', 'K'));
    expect(state.currentTurnId).toBe('b');
  });

  it('requires an eight to choose a valid active suit', () => {
    const { engine, state } = game();
    state.discardPile = [card('hearts', '4')];
    state.activeSuit = 'hearts';
    state.hands.a = [card('clubs', '8'), card('clubs', '2')];
    expect(engine.applyAction(state, 'a', { type: 'play_card', cardId: 'c-clubs-8' })).toEqual({ valid: false, reason: 'An eight must choose a suit' });
    expect(engine.applyAction(state, 'a', { type: 'play_card', cardId: 'c-clubs-8', chosenSuit: 'spades' }).valid).toBe(true);
    expect(state.activeSuit).toBe('spades');
  });

  it('rejects a mismatched card and drawing while a legal card exists', () => {
    const { engine, state } = game();
    state.discardPile = [card('hearts', '4')];
    state.activeSuit = 'hearts';
    state.hands.a = [card('clubs', '2'), card('hearts', 'K')];
    expect(engine.applyAction(state, 'a', { type: 'play_card', cardId: 'c-clubs-2' })).toEqual({ valid: false, reason: 'Card does not match suit or rank' });
    expect(engine.applyAction(state, 'a', { type: 'draw_card' })).toEqual({ valid: false, reason: 'A legal card must be played' });
  });

  it('draws only from the server pile when no card is playable', () => {
    const { engine, state } = game();
    state.discardPile = [card('hearts', '4')];
    state.activeSuit = 'hearts';
    state.hands.a = [card('clubs', '2')];
    state.drawPile = [card('diamonds', '9')];
    expect(engine.applyAction(state, 'a', { type: 'draw_card' }).valid).toBe(true);
    expect(state.hands.a).toContainEqual(card('diamonds', '9'));
    expect(state.currentTurnId).toBe('b');
  });

  it('redacts every opponent card from the player projection', () => {
    const { engine, state } = game();
    const view = engine.getPlayerView(state, 'a');
    expect(view.yourHand).toEqual(state.hands.a);
    expect(view.players[1].handCount).toBe(7);
    expect(Object.prototype.hasOwnProperty.call(view.players[1], 'hand')).toBe(false);
    for (const opponentCard of state.hands.b) expect(JSON.stringify(view)).not.toContain(opponentCard.id);
  });

  it('wins immediately when a legal play empties the hand', () => {
    const { engine, state } = game();
    state.discardPile = [card('hearts', '4')];
    state.activeSuit = 'hearts';
    state.hands.a = [card('hearts', 'A')];
    const result = engine.applyAction(state, 'a', { type: 'play_card', cardId: 'c-hearts-A' });
    expect(result.result).toMatchObject({ winnerId: 'a', reason: 'empty_hand' });
  });

  it('awards surrender to the next player', () => {
    const { engine, state } = game();
    expect(engine.surrender(state, 'a').result).toMatchObject({ winnerId: 'b', reason: 'surrender' });
  });
});