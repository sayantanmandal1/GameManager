import type { BourreAction, BourreGameState, StandardCard } from '../../../shared';
import { BourreEngine } from './bourre.engine';

describe('BourreEngine', () => {
  const players = ['a', 'b', 'c', 'd'];
  const card = (suit: StandardCard['suit'], rank: StandardCard['rank']): StandardCard => ({
    id: `c-${suit}-${rank}`,
    suit,
    rank,
  });
  const game = (ids = players) => {
    const engine = new BourreEngine((cards) => cards);
    const state = engine.initGame(ids, Object.fromEntries(ids.map((id) => [id, id.toUpperCase()])));
    return { engine, state };
  };
  const decide = (engine: BourreEngine, state: BourreGameState, playerId: string, play: boolean, discardIds: string[] = []) =>
    engine.applyAction(state, playerId, { type: 'bourre_decide', play, discardIds });

  it('deals five cards one at a time and exposes only the dealer trump card', () => {
    const { engine, state } = game();
    expect(engine.rulesetId).toBe('bourre.strict-trump-token-30.v1');
    expect(players.map((id) => state.hands[id].length)).toEqual([5, 5, 5, 5]);
    expect(state.stock).toHaveLength(32);
    expect(state.trumpCard).toEqual(state.hands.a[4]);
    expect(state.trumpSuit).toBe(state.trumpCard.suit);
    expect(state).toMatchObject({ currentTurnId: 'b', pot: 4, handNumber: 1 });
    expect(() => engine.initGame(['a'], {})).toThrow('two to seven');
  });

  it('keeps every hand private except the single face-up trump card', () => {
    const { engine, state } = game();
    const view = engine.getPlayerView(state, 'a');
    const serialized = JSON.stringify(view);
    const hidden = state.hands.b.filter((entry) => entry.id !== state.trumpCard.id);
    expect(hidden.every((entry) => !serialized.includes(`"${entry.id}"`))).toBe(true);
    expect(view.players.map((player) => player.handCount)).toEqual([5, 5, 5, 5]);
    expect(view.trumpCard).toEqual(state.trumpCard);
  });

  it('enforces decision order, exact shape, owned discards, and redraw count', () => {
    const { engine, state } = game();
    expect(decide(engine, state, 'c', true)).toEqual({ valid: false, reason: 'Not your turn' });
    expect(engine.applyAction(state, 'b', { type: 'bourre_decide', play: true, discardIds: [], extra: true } as unknown as BourreAction)).toEqual({ valid: false, reason: 'Invalid decision' });
    expect(decide(engine, state, 'b', true, [state.hands.c[0].id])).toEqual({ valid: false, reason: 'Discard not in hand' });
    const discarded = state.hands.b.slice(0, 2).map((entry) => entry.id);
    expect(decide(engine, state, 'b', true, discarded)).toEqual({ valid: true });
    expect(state.hands.b).toHaveLength(5);
    expect(discarded.every((id) => !state.hands.b.some((entry) => entry.id === id))).toBe(true);
    expect(state.decisions.b).toBe('stayed');
    expect(state.currentTurnId).toBe('c');
  });

  it('does not return a player their own discards when the stock must recycle', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const { engine, state } = game(ids);
    const decisionOrder = ['b', 'c', 'd', 'e', 'f', 'g', 'a'];
    const discardedByPlayer = new Map<string, string[]>();
    for (const playerId of decisionOrder) {
      const discarded = state.hands[playerId].map((entry) => entry.id);
      discardedByPlayer.set(playerId, discarded);
      expect(decide(engine, state, playerId, true, discarded)).toEqual({ valid: true });
      expect(discarded.every((id) => !state.hands[playerId].some((entry) => entry.id === id))).toBe(true);
    }
    expect(state.phase).toBe('playing');
    const allCards = [
      ...ids.flatMap((id) => state.hands[id]),
      ...state.stock,
      ...state.recyclePool,
    ];
    expect(allCards).toHaveLength(52);
    expect(new Set(allCards.map((entry) => entry.id)).size).toBe(52);
  });

  it('forces the dealer to stay with the trump ace or when everyone else folds', () => {
    const allFold = game();
    decide(allFold.engine, allFold.state, 'b', false);
    decide(allFold.engine, allFold.state, 'c', false);
    decide(allFold.engine, allFold.state, 'd', false);
    expect(allFold.engine.getPlayerView(allFold.state, 'a').canFold).toBe(false);
    expect(decide(allFold.engine, allFold.state, 'a', false)).toEqual({ valid: false, reason: 'Dealer must play this hand' });

    const ace = game();
    ace.state.trumpCard = card(ace.state.trumpSuit, 'A');
    decide(ace.engine, ace.state, 'b', true);
    decide(ace.engine, ace.state, 'c', false);
    decide(ace.engine, ace.state, 'd', false);
    expect(decide(ace.engine, ace.state, 'a', false)).toEqual({ valid: false, reason: 'Dealer must play this hand' });
  });

  it('awards the pot immediately when only one player stays', () => {
    const { engine, state } = game();
    decide(engine, state, 'b', true);
    decide(engine, state, 'c', false);
    decide(engine, state, 'd', false);
    expect(decide(engine, state, 'a', false)).toEqual({ valid: true });
    expect(state).toMatchObject({ phase: 'hand_complete', scores: { b: 4 }, pot: 4 });
    expect(state.lastHand).toMatchObject({ winnerId: 'b', splitIds: [], bourreIds: [], pot: 4 });
  });

  it('starts trick play with the first active player left of dealer', () => {
    const { engine, state } = game();
    decide(engine, state, 'b', false);
    decide(engine, state, 'c', true);
    decide(engine, state, 'd', false);
    decide(engine, state, 'a', true);
    expect(state).toMatchObject({ phase: 'playing', currentTurnId: 'c', leaderId: 'c', activePlayerIds: ['c', 'a'] });
  });

  it('forces following suit and a winning card when one can take the trick', () => {
    const { engine, state } = game();
    state.phase = 'playing';
    state.activePlayerIds = ['a', 'b', 'c'];
    state.trumpSuit = 'hearts';
    state.currentTurnId = 'b';
    state.trick = [{ playerId: 'a', card: card('clubs', '5') }];
    state.hands.b = [card('clubs', '2'), card('clubs', 'K'), card('hearts', '2')];
    state.tricksWon = { a: 0, b: 0, c: 0, d: 0 };
    expect(engine.getPlayerView(state, 'b').legalCardIds).toEqual(['c-clubs-K']);
    expect(engine.applyAction(state, 'b', { type: 'play_bourre_card', cardId: 'c-clubs-2' })).toEqual({
      valid: false,
      reason: 'Bourré requires following suit, trumping, and playing to win',
    });
  });

  it('forces an overtrump, and forces a losing trump when no overtrump exists', () => {
    const overtrump = game();
    overtrump.state.phase = 'playing';
    overtrump.state.activePlayerIds = ['a', 'b', 'c'];
    overtrump.state.trumpSuit = 'hearts';
    overtrump.state.currentTurnId = 'c';
    overtrump.state.trick = [
      { playerId: 'a', card: card('clubs', 'A') },
      { playerId: 'b', card: card('hearts', '5') },
    ];
    overtrump.state.hands.c = [card('hearts', '2'), card('hearts', 'K'), card('spades', 'A')];
    overtrump.state.tricksWon = { a: 0, b: 0, c: 0, d: 0 };
    expect(overtrump.engine.getPlayerView(overtrump.state, 'c').legalCardIds).toEqual(['c-hearts-K']);

    const losing = game();
    losing.state.phase = 'playing';
    losing.state.activePlayerIds = ['a', 'b', 'c'];
    losing.state.trumpSuit = 'hearts';
    losing.state.currentTurnId = 'c';
    losing.state.trick = [
      { playerId: 'a', card: card('clubs', 'A') },
      { playerId: 'b', card: card('hearts', 'A') },
    ];
    losing.state.hands.c = [card('hearts', '2'), card('spades', 'A')];
    losing.state.tricksWon = { a: 0, b: 0, c: 0, d: 0 };
    expect(losing.engine.getPlayerView(losing.state, 'c').legalCardIds).toEqual(['c-hearts-2']);
  });

  it('forces the highest trump for information-safe cinch holdings', () => {
    const single = game();
    single.state.phase = 'playing';
    single.state.activePlayerIds = ['a', 'b'];
    single.state.trumpSuit = 'hearts';
    single.state.currentTurnId = 'a';
    single.state.trick = [];
    single.state.hands.a = [card('hearts', 'A'), card('clubs', '2')];
    single.state.tricksWon = { a: 2, b: 0, c: 0, d: 0 };
    expect(single.engine.getPlayerView(single.state, 'a').legalCardIds).toEqual(['c-hearts-A']);

    const aqj = game();
    aqj.state.phase = 'playing';
    aqj.state.activePlayerIds = ['a', 'b'];
    aqj.state.trumpSuit = 'hearts';
    aqj.state.currentTurnId = 'a';
    aqj.state.trick = [];
    aqj.state.hands.a = [card('hearts', 'A'), card('hearts', 'Q'), card('hearts', 'J'), card('clubs', '2')];
    aqj.state.tricksWon = { a: 1, b: 0, c: 0, d: 0 };
    expect(aqj.engine.getPlayerView(aqj.state, 'a').legalCardIds).toEqual(['c-hearts-A']);
  });

  it('awards a unique winner and charges a zero-trick bourré match', () => {
    const { engine, state } = game();
    state.phase = 'playing';
    state.activePlayerIds = ['a', 'b', 'c'];
    state.trumpSuit = 'hearts';
    state.currentTurnId = 'a';
    state.leaderId = 'a';
    state.tricksWon = { a: 2, b: 2, c: 0, d: 0 };
    state.hands = { a: [card('clubs', 'A')], b: [card('clubs', 'K')], c: [card('clubs', 'Q')], d: [] };
    engine.applyAction(state, 'a', { type: 'play_bourre_card', cardId: 'c-clubs-A' });
    engine.applyAction(state, 'b', { type: 'play_bourre_card', cardId: 'c-clubs-K' });
    engine.applyAction(state, 'c', { type: 'play_bourre_card', cardId: 'c-clubs-Q' });
    expect(state).toMatchObject({ phase: 'hand_complete', scores: { a: 4 }, pot: 7 });
    expect(state.lastHand).toMatchObject({ winnerId: 'a', bourreIds: ['c'], pot: 4 });
  });

  it('carries a split pot, exempts tied leaders, and charges bourré instead of ante', () => {
    const { engine, state } = game();
    state.phase = 'playing';
    state.activePlayerIds = ['a', 'b', 'c', 'd'];
    state.trumpSuit = 'hearts';
    state.currentTurnId = 'a';
    state.tricksWon = { a: 1, b: 2, c: 1, d: 0 };
    state.hands = {
      a: [card('clubs', '2')], b: [card('clubs', '3')], c: [card('clubs', 'A')], d: [card('clubs', '4')],
    };
    for (const [playerId, cardId] of [['a', 'c-clubs-2'], ['b', 'c-clubs-3'], ['c', 'c-clubs-A'], ['d', 'c-clubs-4']] as const) {
      engine.applyAction(state, playerId, { type: 'play_bourre_card', cardId });
    }
    expect(state.scores).toEqual({ a: 0, b: 0, c: 0, d: 0 });
    expect(state.pot).toBe(9);
    expect(state.lastHand).toMatchObject({ winnerId: null, splitIds: ['b', 'c'], bourreIds: ['d'], pot: 4 });
  });

  it('lets only the host rotate the deal and preserves session scores', () => {
    const { engine, state } = game();
    state.phase = 'hand_complete';
    state.scores.a = 12;
    expect(engine.applyAction(state, 'b', { type: 'next_bourre_hand' })).toEqual({ valid: false, reason: 'Only the host can start the next hand' });
    expect(engine.applyAction(state, 'a', { type: 'next_bourre_hand' })).toEqual({ valid: true });
    expect(state).toMatchObject({ dealerIndex: 1, handNumber: 2, phase: 'deciding', scores: { a: 12 } });
  });

  it('finishes when a unique winner reaches thirty token points', () => {
    const { engine, state } = game();
    state.scores.a = 29;
    state.phase = 'playing';
    state.activePlayerIds = ['a', 'b'];
    state.trumpSuit = 'hearts';
    state.currentTurnId = 'a';
    state.tricksWon = { a: 2, b: 2, c: 0, d: 0 };
    state.hands = { a: [card('clubs', 'A')], b: [card('clubs', 'K')], c: [], d: [] };
    engine.applyAction(state, 'a', { type: 'play_bourre_card', cardId: 'c-clubs-A' });
    expect(engine.applyAction(state, 'b', { type: 'play_bourre_card', cardId: 'c-clubs-K' }).result).toMatchObject({
      gameKey: 'bourre', winnerId: 'a', reason: 'target_score', scores: { a: 33 },
    });
  });

  it('awards surrender to the highest-scoring remaining player', () => {
    const { engine, state } = game();
    state.scores = { a: 5, b: 9, c: 2, d: 7 };
    expect(engine.surrender(state, 'a').result).toMatchObject({ winnerId: 'b', reason: 'surrender' });
  });
});