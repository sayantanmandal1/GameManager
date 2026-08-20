import type { OhHellGameState, StandardCard } from '../../../shared';
import { OhHellEngine } from './oh-hell.engine';

describe('OhHellEngine', () => {
  const players = ['a', 'b', 'c', 'd'];
  const card = (suit: StandardCard['suit'], rank: StandardCard['rank']): StandardCard => ({ id: `c-${suit}-${rank}`, suit, rank });
  const game = (ids = players) => {
    const engine = new OhHellEngine((cards) => cards);
    const state = engine.initGame(ids, Object.fromEntries(ids.map((id) => [id, id.toUpperCase()])));
    return { engine, state };
  };
  const bidAll = (engine: OhHellEngine, state: OhHellGameState, bids: Record<string, number>) => {
    const order = state.players.map((_, offset) => state.players[(state.dealerIndex + 1 + offset) % state.players.length].id);
    for (const playerId of order) engine.applyAction(state, playerId, { type: 'bid_oh_hell', bid: bids[playerId] });
  };
  const finishDeal = (engine: OhHellEngine, state: OhHellGameState, priorTricks: Record<string, number>) => {
    state.phase = 'playing'; state.currentTurnId = 'd'; state.leaderId = 'a'; state.trumpSuit = 'hearts';
    state.tricksWon = { ...priorTricks };
    state.trick = [
      { playerId: 'a', card: card('clubs', 'A') }, { playerId: 'b', card: card('clubs', 'K') },
      { playerId: 'c', card: card('clubs', 'Q') },
    ];
    state.hands = { a: [], b: [], c: [], d: [card('clubs', 'J')] };
    return engine.applyAction(state, 'd', { type: 'play_oh_hell_card', cardId: 'c-clubs-J' });
  };

  it('deals seven cards plus a public trump and supports three to seven players', () => {
    const { engine, state } = game();
    expect(engine.rulesetId).toBe('oh-hell.contract-whist-7-1-7.v1');
    expect(players.map((id) => state.hands[id].length)).toEqual([7, 7, 7, 7]);
    expect(state).toMatchObject({ dealNumber: 1, handSize: 7, currentTurnId: 'b', dealerIndex: 0 });
    expect(new Set([...players.flatMap((id) => state.hands[id]), state.trumpCard].map((entry) => entry.id)).size).toBe(29);
    const seven = game(['a', 'b', 'c', 'd', 'e', 'f', 'g']).state;
    expect(Object.values(seven.hands).map((hand) => hand.length)).toEqual([7, 7, 7, 7, 7, 7, 7]);
    expect(new Set([...Object.values(seven.hands).flat(), seven.trumpCard].map((entry) => entry.id)).size).toBe(50);
    expect(() => engine.initGame(['a', 'b'], {})).toThrow('three to seven');
  });

  it('follows the exact seven-down-and-up hand schedule', () => {
    const { engine, state } = game();
    const observed = [state.handSize];
    for (let deal = 1; deal < 13; deal += 1) {
      state.phase = 'deal_complete'; state.currentTurnId = state.hostId;
      engine.applyAction(state, state.hostId, { type: 'next_oh_hell_deal' });
      observed.push(state.handSize);
    }
    expect(observed).toEqual([7, 6, 5, 4, 3, 2, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('enforces clockwise bidding and bids from zero through hand size', () => {
    const { engine, state } = game();
    expect(engine.applyAction(state, 'c', { type: 'bid_oh_hell', bid: 1 })).toEqual({ valid: false, reason: 'Not your turn' });
    expect(engine.applyAction(state, 'b', { type: 'bid_oh_hell', bid: 8 })).toEqual({ valid: false, reason: 'Invalid bid' });
    expect(engine.getPlayerView(state, 'b').legalBids).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(engine.applyAction(state, 'b', { type: 'bid_oh_hell', bid: 1 })).toEqual({ valid: true });
    expect(state.currentTurnId).toBe('c');
  });

  it('applies the dealer hook only to the last bid', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'b', { type: 'bid_oh_hell', bid: 1 });
    engine.applyAction(state, 'c', { type: 'bid_oh_hell', bid: 2 });
    engine.applyAction(state, 'd', { type: 'bid_oh_hell', bid: 0 });
    expect(engine.getPlayerView(state, 'a').legalBids).toEqual([0, 1, 2, 3, 5, 6, 7]);
    expect(engine.applyAction(state, 'a', { type: 'bid_oh_hell', bid: 4 })).toEqual({
      valid: false,
      reason: 'Dealer bid cannot make the total equal available tricks',
    });
    expect(engine.applyAction(state, 'a', { type: 'bid_oh_hell', bid: 3 })).toEqual({ valid: true });
    expect(state).toMatchObject({ phase: 'playing', currentTurnId: 'b', leaderId: 'b' });
  });

  it('requires following suit and awards the trick to highest trump', () => {
    const { engine, state } = game();
    bidAll(engine, state, { a: 1, b: 1, c: 1, d: 1 });
    state.trumpSuit = 'hearts'; state.currentTurnId = 'd'; state.tricksWon = { a: 0, b: 0, c: 0, d: 0 };
    state.trick = [
      { playerId: 'a', card: card('clubs', 'A') }, { playerId: 'b', card: card('hearts', '2') },
      { playerId: 'c', card: card('hearts', 'K') },
    ];
    state.hands = { a: [card('spades', '2')], b: [card('spades', '3')], c: [card('spades', '4')], d: [card('clubs', '2'), card('hearts', 'A')] };
    expect(engine.getPlayerView(state, 'd').legalCardIds).toEqual(['c-clubs-2']);
    expect(engine.applyAction(state, 'd', { type: 'play_oh_hell_card', cardId: 'c-hearts-A' })).toEqual({ valid: false, reason: 'Must follow suit' });
    engine.applyAction(state, 'd', { type: 'play_oh_hell_card', cardId: 'c-clubs-2' });
    expect(state.currentTurnId).toBe('c');
    expect(state.tricksWon.c).toBe(1);
  });

  it('awards every trick plus ten only for an exact bid', () => {
    const { engine, state } = game();
    state.bids = { a: 2, b: 1, c: 0, d: 2 };
    finishDeal(engine, state, { a: 1, b: 1, c: 0, d: 3 });
    expect(state.scores).toEqual({ a: 12, b: 11, c: 10, d: 3 });
    expect(state.lastDeal).toMatchObject({
      handSize: 7, bids: { a: 2, b: 1, c: 0, d: 2 }, tricks: { a: 2, b: 1, c: 0, d: 3 },
      points: { a: 12, b: 11, c: 10, d: 3 },
    });
  });

  it('lets only the host rotate dealer and preserves scores', () => {
    const { engine, state } = game();
    state.phase = 'deal_complete'; state.scores = { a: 12, b: 3, c: 5, d: 7 };
    expect(engine.applyAction(state, 'b', { type: 'next_oh_hell_deal' })).toEqual({ valid: false, reason: 'Only the host can start the next deal' });
    expect(engine.applyAction(state, 'a', { type: 'next_oh_hell_deal' })).toEqual({ valid: true });
    expect(state).toMatchObject({ dealerIndex: 1, dealNumber: 2, handSize: 6, currentTurnId: 'c', scores: { a: 12 } });
  });

  it('finishes after deal thirteen with a unique leader or draw', () => {
    const winner = game();
    winner.state.dealNumber = 13; winner.state.handSize = 7;
    winner.state.bids = { a: 1, b: 1, c: 1, d: 1 };
    winner.state.scores = { a: 20, b: 5, c: 4, d: 3 };
    expect(finishDeal(winner.engine, winner.state, { a: 0, b: 1, c: 0, d: 5 }).result).toMatchObject({
      gameKey: 'oh-hell', winnerId: 'a', isDraw: false, reason: 'schedule_complete',
    });

    const draw = game();
    draw.state.dealNumber = 13; draw.state.handSize = 7;
    draw.state.bids = { a: 1, b: 1, c: 1, d: 1 };
    draw.state.scores = { a: 10, b: 21, c: 0, d: 0 };
    expect(finishDeal(draw.engine, draw.state, { a: 0, b: 0, c: 0, d: 6 }).result).toMatchObject({ winnerId: null, isDraw: true });
  });

  it('never projects an opponent hand beyond the public trump card', () => {
    const { engine, state } = game();
    const view = engine.getPlayerView(state, 'a');
    const serialized = JSON.stringify(view);
    for (const opponentId of ['b', 'c', 'd']) for (const hiddenCard of state.hands[opponentId]) expect(serialized).not.toContain(`"${hiddenCard.id}"`);
    expect(view.players.map((player) => player.handCount)).toEqual([7, 7, 7, 7]);
  });

  it('awards surrender to the highest-scoring remaining player or draw', () => {
    const { engine, state } = game();
    state.scores = { a: 5, b: 9, c: 2, d: 7 };
    expect(engine.surrender(state, 'a').result).toMatchObject({ winnerId: 'b', reason: 'surrender' });
  });
});