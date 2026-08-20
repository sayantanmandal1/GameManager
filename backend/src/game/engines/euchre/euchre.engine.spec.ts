import type { CardSuit, EuchreGameState, StandardCard } from '../../../shared';
import { EuchreEngine } from './euchre.engine';

describe('EuchreEngine', () => {
  const players = ['a', 'b', 'c', 'd'];
  const card = (suit: StandardCard['suit'], rank: StandardCard['rank']): StandardCard => ({ id: `c-${suit}-${rank}`, suit, rank });
  const game = () => {
    const engine = new EuchreEngine((cards) => cards);
    const state = engine.initGame(players, { a: 'A', b: 'B', c: 'C', d: 'D' });
    return { engine, state };
  };
  const pass = (engine: EuchreEngine, state: EuchreGameState, playerId: string) =>
    engine.applyAction(state, playerId, { type: 'euchre_call', euchreCall: { type: 'pass' } });
  const setPlaying = (state: EuchreGameState, makerTeam: 0 | 1, alone = false) => {
    state.phase = 'playing'; state.makerId = makerTeam === 0 ? 'a' : 'b'; state.makerTeam = makerTeam;
    state.trumpSuit = 'hearts'; state.alone = alone; state.activePlayerIds = alone && makerTeam === 0 ? ['a', 'b', 'd'] : players;
    state.sittingOutId = alone && makerTeam === 0 ? 'c' : null;
  };
  const finishHand = (engine: EuchreEngine, state: EuchreGameState, tricks: [number, number]) => {
    setPlaying(state, state.makerTeam ?? 0, state.alone);
    state.currentTurnId = 'd'; state.leaderId = 'a'; state.tricksWon = tricks;
    state.trick = [
      { playerId: 'a', card: card('clubs', 'A') },
      { playerId: 'b', card: card('clubs', 'K') },
      { playerId: 'c', card: card('clubs', 'Q') },
    ].filter((entry) => state.activePlayerIds.includes(entry.playerId));
    state.hands = { a: [], b: [], c: [], d: [card('clubs', 'J')] };
    return engine.applyAction(state, 'd', { type: 'play_euchre_card', cardId: 'c-clubs-J' });
  };

  it('uses a unique 24-card deck, fixed teams, five-card packet hands, and four-card kitty', () => {
    const { engine, state } = game();
    expect(engine.rulesetId).toBe('euchre.north-american-24-to-10.v1');
    expect(players.map((id) => state.hands[id].length)).toEqual([5, 5, 5, 5]);
    expect(state.kitty).toHaveLength(4);
    expect(state.upcard).toEqual(state.kitty[0]);
    expect(new Set([...players.flatMap((id) => state.hands[id]), ...state.kitty].map((entry) => entry.id)).size).toBe(24);
    expect(state.players.map((player) => player.team)).toEqual([0, 1, 0, 1]);
    expect(state.currentTurnId).toBe('b');
    expect(() => engine.initGame(['a', 'b'], {})).toThrow('exactly four');
  });

  it('moves to round two after four passes and forbids the rejected suit', () => {
    const { engine, state } = game();
    for (const playerId of ['b', 'c', 'd', 'a']) pass(engine, state, playerId);
    expect(state).toMatchObject({ biddingRound: 2, passes: 0, currentTurnId: 'b' });
    const view = engine.getPlayerView(state, 'b');
    expect(view.rejectedSuit).toBe(state.upcard.suit);
    expect(view.legalTrumpSuits).toEqual(expect.not.arrayContaining([state.upcard.suit]));
    expect(engine.applyAction(state, 'b', { type: 'euchre_call', euchreCall: { type: 'name_trump', suit: state.upcard.suit, alone: false } })).toEqual({
      valid: false,
      reason: 'Trump suit is not legal',
    });
  });

  it('redeals with the next dealer after all eight passes', () => {
    const { engine, state } = game();
    const originalUpcard = state.upcard.id;
    for (const playerId of ['b', 'c', 'd', 'a', 'b', 'c', 'd', 'a']) pass(engine, state, playerId);
    expect(state).toMatchObject({ dealerIndex: 1, handNumber: 2, biddingRound: 1, currentTurnId: 'c' });
    expect(state.upcard.id).toBe(originalUpcard);
  });

  it('orders up the dealer, preserves card uniqueness, and requires a dealer-owned discard', () => {
    const { engine, state } = game();
    const upcardId = state.upcard.id;
    expect(engine.applyAction(state, 'b', { type: 'euchre_call', euchreCall: { type: 'order_up', alone: false } })).toEqual({ valid: true });
    expect(state).toMatchObject({ phase: 'dealer_discard', currentTurnId: 'a', makerId: 'b', makerTeam: 1 });
    expect(state.hands.a).toHaveLength(6);
    expect(state.kitty.some((entry) => entry.id === upcardId)).toBe(false);
    expect(new Set([...players.flatMap((id) => state.hands[id]), ...state.kitty].map((entry) => entry.id)).size).toBe(24);
    expect(engine.applyAction(state, 'a', { type: 'euchre_discard', cardId: state.hands.b[0].id })).toEqual({ valid: false, reason: 'Card not in hand' });
    expect(engine.applyAction(state, 'a', { type: 'euchre_discard', cardId: state.hands.a[0].id })).toEqual({ valid: true });
    expect(state).toMatchObject({ phase: 'playing', currentTurnId: 'b', leaderId: 'b' });
    expect(state.hands.a).toHaveLength(5);
    expect(new Set([...players.flatMap((id) => state.hands[id]), ...state.kitty].map((entry) => entry.id)).size).toBe(24);
  });

  it('names any non-rejected suit in round two and can declare alone', () => {
    const { engine, state } = game();
    for (const playerId of ['b', 'c', 'd', 'a']) pass(engine, state, playerId);
    const suit = (['clubs', 'diamonds', 'hearts', 'spades'] as CardSuit[]).find((entry) => entry !== state.upcard.suit)!;
    expect(engine.applyAction(state, 'b', { type: 'euchre_call', euchreCall: { type: 'name_trump', suit, alone: true } })).toEqual({ valid: true });
    expect(state).toMatchObject({ phase: 'playing', makerId: 'b', makerTeam: 1, trumpSuit: suit, alone: true, sittingOutId: 'd' });
    expect(state.activePlayerIds).toEqual(['a', 'b', 'c']);
    expect(state.currentTurnId).toBe('b');
  });

  it('treats the left bower as trump for following suit and second-highest rank', () => {
    const { engine, state } = game();
    setPlaying(state, 0);
    state.currentTurnId = 'b';
    state.trick = [{ playerId: 'a', card: card('hearts', '9') }];
    state.hands.b = [card('diamonds', 'J'), card('hearts', 'A'), card('diamonds', 'A')];
    expect(engine.getPlayerView(state, 'b').legalCardIds).toEqual(['c-diamonds-J', 'c-hearts-A']);

    state.currentTurnId = 'd';
    state.trick = [
      { playerId: 'a', card: card('hearts', 'A') },
      { playerId: 'b', card: card('diamonds', 'J') },
      { playerId: 'c', card: card('hearts', 'J') },
    ];
    state.hands = { a: [card('spades', '9')], b: [card('spades', '10')], c: [card('spades', 'Q')], d: [card('hearts', '9'), card('spades', 'K')] };
    state.tricksWon = [0, 0];
    engine.applyAction(state, 'd', { type: 'play_euchre_card', cardId: 'c-hearts-9' });
    expect(state.currentTurnId).toBe('c');
    expect(state.tricksWon).toEqual([1, 0]);
  });

  it('removes a lone maker partner from every trick rotation', () => {
    const { engine, state } = game();
    setPlaying(state, 0, true);
    state.currentTurnId = 'a'; state.leaderId = 'a'; state.trick = [];
    state.hands = { a: [card('clubs', '9'), card('spades', '9')], b: [card('clubs', '10'), card('spades', '10')], c: [card('clubs', 'Q')], d: [card('clubs', 'K'), card('spades', 'K')] };
    engine.applyAction(state, 'a', { type: 'play_euchre_card', cardId: 'c-clubs-9' });
    expect(state.currentTurnId).toBe('b');
    engine.applyAction(state, 'b', { type: 'play_euchre_card', cardId: 'c-clubs-10' });
    expect(state.currentTurnId).toBe('d');
    engine.applyAction(state, 'd', { type: 'play_euchre_card', cardId: 'c-clubs-K' });
    expect(state.trick).toEqual([]);
    expect(state.currentTurnId).toBe('d');
    expect(state.hands.c).toHaveLength(1);
  });

  it.each([
    { label: 'maker 3-4', alone: false, tricks: [2, 2] as [number, number], expected: [1, 0] },
    { label: 'partnership march', alone: false, tricks: [4, 0] as [number, number], expected: [2, 0] },
    { label: 'lone march', alone: true, tricks: [4, 0] as [number, number], expected: [4, 0] },
    { label: 'euchred', alone: false, tricks: [1, 3] as [number, number], expected: [0, 2] },
  ])('scores $label correctly', ({ alone, tricks, expected }) => {
    const { engine, state } = game();
    state.makerTeam = 0; state.makerId = 'a'; state.alone = alone;
    finishHand(engine, state, tricks);
    expect(state.teamScores).toEqual(expected);
    expect(state.lastHand?.points).toEqual(expected);
  });

  it('finishes when a team reaches ten points', () => {
    const { engine, state } = game();
    state.teamScores = [9, 0]; state.makerTeam = 0; state.makerId = 'a'; state.alone = false;
    expect(finishHand(engine, state, [2, 2]).result).toMatchObject({ gameKey: 'euchre', winnerTeam: 0, winnerId: 'a', reason: 'target_score', teamScores: [10, 0] });
  });

  it('keeps opponent and sitting-out hands private', () => {
    const { engine, state } = game();
    const view = engine.getPlayerView(state, 'a');
    const serialized = JSON.stringify(view);
    for (const opponentId of ['b', 'c', 'd']) for (const hiddenCard of state.hands[opponentId]) expect(serialized).not.toContain(`"${hiddenCard.id}"`);
    expect(view.players.map((player) => player.handCount)).toEqual([5, 5, 5, 5]);
  });

  it('awards surrender to the opposing team', () => {
    const { engine, state } = game();
    expect(engine.surrender(state, 'a').result).toMatchObject({ winnerTeam: 1, winnerId: 'b', reason: 'surrender' });
  });
});