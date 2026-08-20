import type { GinRummyAction, GinRummyGameState, StandardCard } from '../../../shared';
import { analyzeGinHand, deadwoodAfterLayoff } from './gin-rummy.analysis';
import { GinRummyEngine } from './gin-rummy.engine';

describe('GinRummyEngine', () => {
  const card = (suit: StandardCard['suit'], rank: StandardCard['rank']): StandardCard => ({ id: `c-${suit}-${rank}`, suit, rank });
  const game = () => {
    const engine = new GinRummyEngine((cards) => cards);
    return { engine, state: engine.initGame(['a', 'b'], { a: 'Alice', b: 'Bob' }) };
  };
  const ginHand = () => [
    card('hearts', 'A'), card('hearts', '2'), card('hearts', '3'), card('hearts', '4'),
    card('clubs', '7'), card('diamonds', '7'), card('spades', '7'),
    card('clubs', 'K'), card('diamonds', 'K'), card('spades', 'K'),
  ];
  const opponentHand = () => [
    card('clubs', 'A'), card('diamonds', '3'), card('hearts', '5'), card('spades', '7'), card('clubs', '9'),
    card('diamonds', 'J'), card('hearts', 'Q'), card('spades', 'K'), card('clubs', '4'), card('diamonds', '6'),
  ];
  const setDiscarding = (state: GinRummyGameState, hand: StandardCard[], opponent = opponentHand()) => {
    state.hands = { a: hand, b: opponent };
    state.currentTurnId = 'a'; state.phase = 'discarding'; state.drawSource = 'stock'; state.drawnCardId = hand.at(-1)!.id;
    state.stock = [card('clubs', '2'), card('clubs', '3'), card('clubs', '4')];
    state.discardPile = [card('diamonds', '2')];
  };

  it('deals ten private cards each with one discard and a 31-card stock', () => {
    const { engine, state } = game();
    expect(engine.rulesetId).toBe('gin-rummy.standard-100.v1');
    expect(state.hands.a).toHaveLength(10);
    expect(state.hands.b).toHaveLength(10);
    expect(state.stock).toHaveLength(31);
    expect(state.discardPile).toHaveLength(1);
    expect(() => engine.initGame(['a', 'b', 'c'], {})).toThrow('exactly two');
  });

  it('finds the optimal non-overlapping meld set and minimum deadwood', () => {
    const analysis = analyzeGinHand([...ginHand(), card('diamonds', 'Q')]);
    expect(analysis.deadwood).toEqual([card('diamonds', 'Q')]);
    expect(analysis.deadwoodValue).toBe(10);
    expect(analysis.melds.flatMap((meld) => meld.cards)).toHaveLength(10);
  });

  it('lays deadwood onto both ends of runs and onto incomplete sets', () => {
    const melds = analyzeGinHand([
      card('hearts', '3'), card('hearts', '4'), card('hearts', '5'), card('clubs', '7'), card('diamonds', '7'), card('spades', '7'),
    ]).melds;
    expect(deadwoodAfterLayoff([card('hearts', '2'), card('hearts', '6'), card('hearts', '7')], melds)).toBe(0);
  });

  it('enforces turn ownership, phase, and exact action shapes', () => {
    const { engine, state } = game();
    expect(engine.applyAction(state, 'b', { type: 'gin_draw', source: 'stock' })).toEqual({ valid: false, reason: 'Not your turn' });
    expect(engine.applyAction(state, 'a', { type: 'gin_discard', cardId: state.hands.a[0].id, knock: false })).toEqual({ valid: false, reason: 'Invalid draw' });
    expect(engine.applyAction(state, 'a', { type: 'gin_draw', source: 'stock', knock: false } as unknown as GinRummyAction)).toEqual({ valid: false, reason: 'Invalid draw' });
  });

  it('draws one server stock card then requires a discard', () => {
    const { engine, state } = game();
    const top = state.stock.at(-1)!;
    engine.applyAction(state, 'a', { type: 'gin_draw', source: 'stock' });
    expect(state.hands.a).toContainEqual(top);
    expect(state.phase).toBe('discarding');
    expect(state.stock).toHaveLength(30);
  });

  it('allows drawing the discard but not immediately returning that same card', () => {
    const { engine, state } = game();
    const top = state.discardPile.at(-1)!;
    engine.applyAction(state, 'a', { type: 'gin_draw', source: 'discard' });
    expect(engine.getPlayerView(state, 'a').topDiscard).toBeNull();
    expect(engine.applyAction(state, 'a', { type: 'gin_discard', cardId: top.id, knock: false })).toEqual({ valid: false, reason: 'Cannot return the picked-up discard' });
  });

  it('rejects foreign cards and malformed discard payloads', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'gin_draw', source: 'stock' });
    expect(engine.applyAction(state, 'a', { type: 'gin_discard', cardId: 'missing', knock: false })).toEqual({ valid: false, reason: 'Card not in hand' });
    expect(engine.applyAction(state, 'a', { type: 'gin_discard', cardId: state.hands.a[0].id, knock: false, bid: 1 } as unknown as GinRummyAction)).toEqual({ valid: false, reason: 'Invalid discard' });
  });

  it('passes the turn after a normal draw and discard', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'gin_draw', source: 'stock' });
    engine.applyAction(state, 'a', { type: 'gin_discard', cardId: state.hands.a[0].id, knock: false });
    expect(state).toMatchObject({ currentTurnId: 'b', phase: 'drawing' });
    expect(state.hands.a).toHaveLength(10);
  });

  it('rejects a knock above ten deadwood without mutating the hand', () => {
    const { engine, state } = game();
    const hand = [...opponentHand(), card('clubs', 'Q')];
    setDiscarding(state, hand);
    const before = state.hands.a.map((entry) => entry.id);
    expect(engine.applyAction(state, 'a', { type: 'gin_discard', cardId: 'c-clubs-Q', knock: true })).toEqual({ valid: false, reason: 'Deadwood is too high to knock' });
    expect(state.hands.a.map((entry) => entry.id)).toEqual(before);
  });

  it('scores gin as opponent deadwood plus a 25-point bonus', () => {
    const { engine, state } = game();
    setDiscarding(state, [...ginHand(), card('diamonds', 'Q')]);
    engine.applyAction(state, 'a', { type: 'gin_discard', cardId: 'c-diamonds-Q', knock: true });
    expect(state.lastRound).toMatchObject({ winnerId: 'a', knockerId: 'a', gin: true, undercut: false });
    expect(state.lastRound!.points).toBe(state.lastRound!.deadwood.b + 25);
    expect(state.scores.a).toBe(state.lastRound!.points);
  });

  it('allows layoffs against a non-gin knocker before scoring deadwood', () => {
    const { engine, state } = game();
    const knocker = [
      card('hearts', '3'), card('hearts', '4'), card('hearts', '5'),
      card('clubs', '7'), card('diamonds', '7'), card('spades', '7'),
      card('clubs', 'K'), card('diamonds', 'K'), card('spades', 'K'), card('clubs', 'A'), card('diamonds', 'Q'),
    ];
    const opponent = [
      card('clubs', '2'), card('diamonds', '2'), card('spades', '2'),
      card('clubs', '8'), card('clubs', '9'), card('clubs', '10'),
      card('hearts', '2'), card('spades', 'Q'), card('diamonds', '4'), card('spades', '6'),
    ];
    setDiscarding(state, knocker, opponent);
    engine.applyAction(state, 'a', { type: 'gin_discard', cardId: 'c-diamonds-Q', knock: true });
    expect(state.lastRound).toMatchObject({ winnerId: 'a', gin: false, undercut: false, deadwood: { a: 1, b: 20 } });
    expect(state.lastRound?.points).toBe(19);
  });

  it('awards an undercut bonus when defender deadwood is not higher', () => {
    const { engine, state } = game();
    const knocker = [
      ...ginHand().filter((entry) => entry.id !== 'c-hearts-4'),
      card('clubs', '5'), card('diamonds', 'Q'),
    ];
    const opponent = [
      card('clubs', 'A'), card('clubs', '2'), card('clubs', '3'),
      card('diamonds', '4'), card('diamonds', '5'), card('diamonds', '6'),
      card('spades', '8'), card('spades', '9'), card('spades', '10'), card('hearts', '4'),
    ];
    setDiscarding(state, knocker, opponent);
    engine.applyAction(state, 'a', { type: 'gin_discard', cardId: 'c-diamonds-Q', knock: true });
    expect(state.lastRound).toMatchObject({ winnerId: 'b', undercut: true });
    expect(state.lastRound!.points).toBeGreaterThanOrEqual(25);
  });

  it('starts a fresh alternating round when neither score has reached 100', () => {
    const { engine, state } = game();
    setDiscarding(state, [...ginHand(), card('diamonds', 'Q')]);
    engine.applyAction(state, 'a', { type: 'gin_discard', cardId: 'c-diamonds-Q', knock: true });
    expect(state).toMatchObject({ roundNumber: 2, currentTurnId: 'b', phase: 'drawing' });
    expect(state.hands.a).toHaveLength(10);
  });

  it('ends at 100 points with the round winner', () => {
    const { engine, state } = game();
    state.scores.a = 90;
    setDiscarding(state, [...ginHand(), card('diamonds', 'Q')]);
    expect(engine.applyAction(state, 'a', { type: 'gin_discard', cardId: 'c-diamonds-Q', knock: true }).result).toMatchObject({ winnerId: 'a', reason: 'score_limit' });
  });

  it('redeals a blocked round when the stock reaches two cards', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'gin_draw', source: 'stock' });
    state.stock = [card('clubs', '2'), card('clubs', '3')];
    engine.applyAction(state, 'a', { type: 'gin_discard', cardId: state.hands.a[0].id, knock: false });
    expect(state.roundNumber).toBe(2);
    expect(state.phase).toBe('drawing');
  });

  it('projects only the viewer hand and opponent count', () => {
    const { engine, state } = game();
    const hiddenId = state.hands.b[0].id;
    const view = engine.getPlayerView(state, 'a');
    expect(JSON.stringify(view)).not.toContain(hiddenId);
    expect(view.players.find((player) => player.id === 'b')?.handCount).toBe(10);
    expect(view).not.toHaveProperty('stock');
  });

  it('awards surrender to the opponent and rejects later actions', () => {
    const { engine, state } = game();
    expect(engine.surrender(state, 'a').result).toMatchObject({ winnerId: 'b', reason: 'surrender' });
    expect(engine.applyAction(state, 'b', { type: 'gin_draw', source: 'stock' })).toEqual({ valid: false, reason: 'Game already finished' });
  });
});