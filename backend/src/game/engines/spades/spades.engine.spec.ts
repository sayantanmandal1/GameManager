import type { SpadesAction, SpadesGameState, StandardCard } from '../../../shared';
import { SpadesEngine } from './spades.engine';

describe('SpadesEngine', () => {
  const players = ['a', 'b', 'c', 'd'];
  const card = (suit: StandardCard['suit'], rank: StandardCard['rank']): StandardCard => ({ id: `c-${suit}-${rank}`, suit, rank });
  const game = () => {
    const engine = new SpadesEngine((cards) => cards);
    return { engine, state: engine.initGame(players, { a: 'A', b: 'B', c: 'C', d: 'D' }) };
  };
  const finishRound = (engine: SpadesEngine, state: SpadesGameState) => {
    state.phase = 'playing'; state.currentTurnId = 'd'; state.leaderId = 'a';
    state.hands = { a: [], b: [], c: [], d: [card('clubs', '4')] };
    state.trick = [
      { playerId: 'a', card: card('clubs', '2') }, { playerId: 'b', card: card('clubs', 'A') }, { playerId: 'c', card: card('clubs', '3') },
    ];
    return engine.applyAction(state, 'd', { type: 'play_card', cardId: 'c-clubs-4' });
  };

  it('deals thirteen cards each to four fixed partnership seats', () => {
    const { engine, state } = game();
    expect(engine.rulesetId).toBe('spades.partnership-500.v1');
    expect(players.map((id) => state.hands[id].length)).toEqual([13, 13, 13, 13]);
    expect(engine.getPlayerView(state, 'a').players.map((player) => player.team)).toEqual([0, 1, 0, 1]);
    expect(() => engine.initGame(['a', 'b'], {})).toThrow('exactly four');
  });

  it('enforces ordered bidding and bids from zero through thirteen', () => {
    const { engine, state } = game();
    expect(engine.applyAction(state, 'b', { type: 'bid_spades', bid: 2 })).toEqual({ valid: false, reason: 'Not your turn' });
    expect(engine.applyAction(state, 'a', { type: 'bid_spades', bid: 14 })).toEqual({ valid: false, reason: 'Invalid bid' });
    expect(engine.applyAction(state, 'a', { type: 'bid_spades', bid: 2, face: 3 } as unknown as SpadesAction)).toEqual({ valid: false, reason: 'Invalid bid' });
  });

  it('starts trick play after all four individual bids', () => {
    const { engine, state } = game();
    [2, 0, 4, 3].forEach((bid, index) => engine.applyAction(state, players[index], { type: 'bid_spades', bid }));
    expect(state).toMatchObject({ phase: 'playing', currentTurnId: 'a', bids: { a: 2, b: 0, c: 4, d: 3 } });
  });

  it('requires following suit and rejects foreign cards', () => {
    const { engine, state } = game();
    state.phase = 'playing'; state.currentTurnId = 'b'; state.trick = [{ playerId: 'a', card: card('clubs', '5') }];
    state.hands = { a: [], b: [card('clubs', 'K'), card('spades', '2')], c: [], d: [] };
    expect(engine.getPlayerView(state, 'b').legalCardIds).toEqual(['c-clubs-K']);
    expect(engine.applyAction(state, 'b', { type: 'play_card', cardId: 'c-spades-2' })).toEqual({ valid: false, reason: 'Card is not legal' });
    expect(engine.applyAction(state, 'b', { type: 'play_card', cardId: 'missing' })).toEqual({ valid: false, reason: 'Card not in hand' });
  });

  it('prevents a spade lead before breaking unless only spades remain', () => {
    const { engine, state } = game();
    state.phase = 'playing'; state.currentTurnId = 'a'; state.trick = [];
    state.hands = { a: [card('spades', 'A'), card('clubs', '3')], b: [], c: [], d: [] };
    expect(engine.getPlayerView(state, 'a').legalCardIds).toEqual(['c-clubs-3']);
    state.hands.a = [card('spades', 'A')];
    expect(engine.getPlayerView(state, 'a').legalCardIds).toEqual(['c-spades-A']);
  });

  it('uses the highest spade as trump and gives that player the next lead', () => {
    const { engine, state } = game();
    state.phase = 'playing'; state.currentTurnId = 'd'; state.tricksWon = { a: 0, b: 0, c: 0, d: 0 };
    state.trick = [
      { playerId: 'a', card: card('clubs', 'A') }, { playerId: 'b', card: card('spades', '2') }, { playerId: 'c', card: card('spades', 'K') },
    ];
    state.spadesBroken = true;
    state.hands = { a: [card('diamonds', '2')], b: [card('diamonds', '3')], c: [card('diamonds', '4')], d: [card('clubs', '2'), card('diamonds', '5')] };
    engine.applyAction(state, 'd', { type: 'play_card', cardId: 'c-clubs-2' });
    expect(state.tricksWon.c).toBe(1);
    expect(state.currentTurnId).toBe('c');
    expect(state.spadesBroken).toBe(true);
  });

  it('scores made contracts and overtrick bags by fixed team', () => {
    const { engine, state } = game();
    state.bids = { a: 3, b: 4, c: 2, d: 1 }; state.tricksWon = { a: 4, b: 5, c: 1, d: 2 };
    finishRound(engine, state);
    expect(state.teamScores).toEqual([50, 53]);
    expect(state.teamBags).toEqual([0, 3]);
  });

  it('awards successful nil while its tricks still count for the team contract', () => {
    const { engine, state } = game();
    state.bids = { a: 0, b: 4, c: 4, d: 4 }; state.tricksWon = { a: 0, b: 4, c: 5, d: 3 };
    finishRound(engine, state);
    expect(state.teamScores).toEqual([141, 80]);
    expect(state.teamBags[0]).toBe(1);
  });

  it('penalizes a failed nil bid', () => {
    const { engine, state } = game();
    state.bids = { a: 0, b: 4, c: 4, d: 4 }; state.tricksWon = { a: 1, b: 4, c: 4, d: 3 };
    finishRound(engine, state);
    expect(state.teamScores[0]).toBe(-59);
  });

  it('applies a 100-point penalty whenever bags reach ten', () => {
    const { engine, state } = game();
    state.teamBags = [9, 0]; state.bids = { a: 2, b: 4, c: 2, d: 4 }; state.tricksWon = { a: 3, b: 4, c: 2, d: 3 };
    finishRound(engine, state);
    expect(state.teamScores[0]).toBe(-59);
    expect(state.teamBags[0]).toBe(0);
  });

  it('ends when a team reaches 500 and identifies its partnership', () => {
    const { engine, state } = game();
    state.teamScores = [490, 0]; state.bids = { a: 1, b: 6, c: 1, d: 5 }; state.tricksWon = { a: 2, b: 6, c: 0, d: 4 };
    expect(finishRound(engine, state).result).toMatchObject({ winnerTeam: 0, winnerId: 'a', reason: 'score_limit' });
  });

  it('also ends when the opposing team falls to negative 200', () => {
    const { engine, state } = game();
    state.teamScores = [0, -190]; state.bids = { a: 1, b: 7, c: 1, d: 5 }; state.tricksWon = { a: 2, b: 5, c: 0, d: 5 };
    expect(finishRound(engine, state).result).toMatchObject({ winnerTeam: 0, winnerId: 'a' });
  });

  it('keeps every opponent hand private while exposing bids and counts', () => {
    const { engine, state } = game();
    const hiddenId = state.hands.b[0].id;
    const view = engine.getPlayerView(state, 'a');
    expect(JSON.stringify(view)).not.toContain(hiddenId);
    expect(view.players.find((player) => player.id === 'b')?.handCount).toBe(13);
    expect(view).not.toHaveProperty('hands');
  });

  it('awards surrender to the opposing team and rejects later actions', () => {
    const { engine, state } = game();
    expect(engine.surrender(state, 'c').result).toMatchObject({ winnerTeam: 1, winnerId: 'b', reason: 'surrender' });
    expect(engine.applyAction(state, 'b', { type: 'bid_spades', bid: 1 })).toEqual({ valid: false, reason: 'Game already finished' });
  });
});