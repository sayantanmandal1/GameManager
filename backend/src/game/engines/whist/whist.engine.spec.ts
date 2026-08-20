import type { StandardCard, WhistGameState } from '../../../shared';
import { WhistEngine } from './whist.engine';

describe('WhistEngine', () => {
  const players = ['a', 'b', 'c', 'd'];
  const card = (suit: StandardCard['suit'], rank: StandardCard['rank']): StandardCard => ({ id: `c-${suit}-${rank}`, suit, rank });
  const game = () => {
    const engine = new WhistEngine((cards) => cards);
    const state = engine.initGame(players, { a: 'A', b: 'B', c: 'C', d: 'D' });
    return { engine, state };
  };
  const finishHand = (engine: WhistEngine, state: WhistGameState, priorTricks: [number, number]) => {
    state.phase = 'playing'; state.currentTurnId = 'd'; state.leaderId = 'a'; state.trumpSuit = 'hearts';
    state.teamTricks = priorTricks;
    state.trick = [
      { playerId: 'a', card: card('clubs', 'A') },
      { playerId: 'b', card: card('clubs', 'K') },
      { playerId: 'c', card: card('clubs', 'Q') },
    ];
    state.hands = { a: [], b: [], c: [], d: [card('clubs', 'J')] };
    return engine.applyAction(state, 'd', { type: 'play_whist_card', cardId: 'c-clubs-J' });
  };

  it('deals thirteen unique cards, exposes dealer last card as trump, and seats opposite teams', () => {
    const { engine, state } = game();
    expect(engine.rulesetId).toBe('whist.classic-short-five.v1');
    expect(players.map((id) => state.hands[id].length)).toEqual([13, 13, 13, 13]);
    expect(new Set(players.flatMap((id) => state.hands[id].map((entry) => entry.id))).size).toBe(52);
    expect(state.trumpCard).toEqual(state.hands.a[12]);
    expect(state.trumpSuit).toBe(state.trumpCard.suit);
    expect(state.currentTurnId).toBe('b');
    expect(state.players.map((player) => player.team)).toEqual([0, 1, 0, 1]);
    expect(() => engine.initGame(['a', 'b'], {})).toThrow('exactly four');
  });

  it('requires turn order, owned cards, exact action shape, and following suit', () => {
    const { engine, state } = game();
    state.currentTurnId = 'b';
    state.trick = [{ playerId: 'a', card: card('clubs', '5') }];
    state.hands.b = [card('clubs', 'K'), card('hearts', 'A')];
    expect(engine.applyAction(state, 'c', { type: 'play_whist_card', cardId: 'c-clubs-K' })).toEqual({ valid: false, reason: 'Not your turn' });
    expect(engine.applyAction(state, 'b', { type: 'play_whist_card', cardId: 'missing' })).toEqual({ valid: false, reason: 'Card not in hand' });
    expect(engine.getPlayerView(state, 'b').legalCardIds).toEqual(['c-clubs-K']);
    expect(engine.applyAction(state, 'b', { type: 'play_whist_card', cardId: 'c-hearts-A' })).toEqual({ valid: false, reason: 'Must follow suit' });
  });

  it('awards a trick to the highest trump and gives that player the next lead', () => {
    const { engine, state } = game();
    state.trumpSuit = 'hearts'; state.currentTurnId = 'd'; state.teamTricks = [0, 0];
    state.trick = [
      { playerId: 'a', card: card('clubs', 'A') },
      { playerId: 'b', card: card('hearts', '2') },
      { playerId: 'c', card: card('hearts', 'K') },
    ];
    state.hands = { a: [card('spades', '2')], b: [card('spades', '3')], c: [card('spades', '4')], d: [card('clubs', '2'), card('spades', '5')] };
    expect(engine.applyAction(state, 'd', { type: 'play_whist_card', cardId: 'c-clubs-2' })).toEqual({ valid: true });
    expect(state.teamTricks).toEqual([1, 0]);
    expect(state.currentTurnId).toBe('c');
    expect(state.leaderId).toBe('c');
  });

  it('scores only tricks above six for the winning partnership', () => {
    const { engine, state } = game();
    finishHand(engine, state, [7, 5]);
    expect(state).toMatchObject({ phase: 'hand_complete', gamePoints: [2, 0] });
    expect(state.lastHand).toEqual({ handNumber: 1, tricks: [8, 5], oddPoints: [2, 0] });
  });

  it('finishes when a team reaches five odd-trick points', () => {
    const { engine, state } = game();
    state.gamePoints = [4, 0];
    expect(finishHand(engine, state, [6, 6]).result).toMatchObject({
      gameKey: 'whist', winnerId: 'a', winnerTeam: 0, reason: 'five_points', gamePoints: [5, 0],
    });
  });

  it('lets only the host rotate dealer while preserving points', () => {
    const { engine, state } = game();
    state.phase = 'hand_complete'; state.gamePoints = [2, 1];
    expect(engine.applyAction(state, 'b', { type: 'next_whist_hand' })).toEqual({ valid: false, reason: 'Only the host can start the next hand' });
    expect(engine.applyAction(state, 'a', { type: 'next_whist_hand' })).toEqual({ valid: true });
    expect(state).toMatchObject({ dealerIndex: 1, handNumber: 2, currentTurnId: 'c', gamePoints: [2, 1] });
    expect(state.trumpCard).toEqual(state.hands.b[12]);
  });

  it('never projects an opponent hand beyond the public trump card', () => {
    const { engine, state } = game();
    const view = engine.getPlayerView(state, 'a');
    const serialized = JSON.stringify(view);
    for (const opponentId of ['b', 'c', 'd']) {
      for (const hiddenCard of state.hands[opponentId]) expect(serialized).not.toContain(`"${hiddenCard.id}"`);
    }
    expect(view.players.map((player) => player.handCount)).toEqual([13, 13, 13, 13]);
  });

  it('awards surrender to the opposing partnership', () => {
    const { engine, state } = game();
    expect(engine.surrender(state, 'c').result).toMatchObject({ winnerTeam: 1, winnerId: 'b', reason: 'surrender' });
  });
});