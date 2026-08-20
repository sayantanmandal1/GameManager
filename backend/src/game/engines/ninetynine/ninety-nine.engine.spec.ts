import type { NinetyNineAction, StandardCard } from '../../../shared';
import { NinetyNineEngine } from './ninety-nine.engine';

describe('NinetyNineEngine', () => {
  const players = ['a', 'b', 'c', 'd'];
  const card = (suit: StandardCard['suit'], rank: StandardCard['rank']): StandardCard => ({
    id: `c-${suit}-${rank}`,
    suit,
    rank,
  });
  const game = (ids = players) => {
    const engine = new NinetyNineEngine((cards) => cards);
    const state = engine.initGame(ids, Object.fromEntries(ids.map((id) => [id, id.toUpperCase()])));
    return { engine, state };
  };

  it('deals three private cards and three tokens to every player', () => {
    const { engine, state } = game();
    expect(engine.rulesetId).toBe('ninety-nine.standard-three-token.v1');
    expect(players.map((id) => state.hands[id].length)).toEqual([3, 3, 3, 3]);
    expect(state.tokens).toEqual({ a: 3, b: 3, c: 3, d: 3 });
    expect(state).toMatchObject({ total: 0, direction: 1, currentTurnId: 'a', handNumber: 1 });
    expect(() => engine.initGame(['a'], {})).toThrow('two to eight');
  });

  it('publishes only legal bounded values for every special rank', () => {
    const { engine, state } = game();
    state.currentTurnId = 'a';
    state.total = 90;
    state.hands.a = [
      card('clubs', 'A'), card('clubs', '3'), card('clubs', '4'), card('clubs', '9'),
      card('clubs', '10'), card('clubs', 'J'), card('clubs', 'Q'), card('clubs', 'K'), card('clubs', '8'),
    ];
    expect(Object.fromEntries(engine.getPlayerView(state, 'a').legalPlays.map((entry) => [entry.cardId, entry.values]))).toEqual({
      'c-clubs-A': [1],
      'c-clubs-3': [3],
      'c-clubs-4': [0],
      'c-clubs-9': [99],
      'c-clubs-10': [-10],
      'c-clubs-K': [0],
      'c-clubs-8': [8],
    });
  });

  it('adds a normal card, draws a replacement, and advances left', () => {
    const { engine, state } = game();
    state.hands.a = [card('clubs', '7'), card('diamonds', '2'), card('hearts', '2')];
    const stockBefore = state.stock.length;
    expect(engine.applyAction(state, 'a', { type: 'play_ninety_nine', cardId: 'c-clubs-7', chosenValue: 7 })).toEqual({ valid: true });
    expect(state).toMatchObject({ total: 7, currentTurnId: 'b' });
    expect(state.hands.a).toHaveLength(3);
    expect(state.stock).toHaveLength(stockBefore - 1);
  });

  it('rejects out-of-turn, forged, foreign, and overflowing plays', () => {
    const { engine, state } = game();
    const ownId = state.hands.a[0].id;
    expect(engine.applyAction(state, 'b', { type: 'play_ninety_nine', cardId: state.hands.b[0].id, chosenValue: 1 })).toEqual({ valid: false, reason: 'Not your turn' });
    expect(engine.applyAction(state, 'a', { type: 'play_ninety_nine', cardId: ownId, chosenValue: 1, extra: true } as unknown as NinetyNineAction)).toEqual({ valid: false, reason: 'Invalid play' });
    expect(engine.applyAction(state, 'a', { type: 'play_ninety_nine', cardId: state.hands.b[0].id, chosenValue: 1 })).toEqual({ valid: false, reason: 'Card not in hand' });
    state.total = 98;
    state.hands.a = [card('clubs', '2')];
    expect(engine.applyAction(state, 'a', { type: 'play_ninety_nine', cardId: 'c-clubs-2', chosenValue: 2 })).toEqual({ valid: false, reason: 'Card value would exceed ninety-nine' });
  });

  it('applies ace, nine, ten, and king values exactly', () => {
    const ace = game();
    ace.state.total = 10;
    ace.state.hands.a = [card('clubs', 'A')];
    ace.engine.applyAction(ace.state, 'a', { type: 'play_ninety_nine', cardId: 'c-clubs-A', chosenValue: 11 });
    expect(ace.state.total).toBe(21);

    const nine = game();
    nine.state.total = 17;
    nine.state.hands.a = [card('clubs', '9')];
    nine.engine.applyAction(nine.state, 'a', { type: 'play_ninety_nine', cardId: 'c-clubs-9', chosenValue: 99 });
    expect(nine.state.total).toBe(99);

    const ten = game();
    ten.state.total = 50;
    ten.state.hands.a = [card('clubs', '10')];
    ten.engine.applyAction(ten.state, 'a', { type: 'play_ninety_nine', cardId: 'c-clubs-10', chosenValue: -10 });
    expect(ten.state.total).toBe(40);

    const king = game();
    king.state.total = 99;
    king.state.hands.a = [card('clubs', 'K')];
    king.engine.applyAction(king.state, 'a', { type: 'play_ninety_nine', cardId: 'c-clubs-K', chosenValue: 0 });
    expect(king.state.total).toBe(99);
  });

  it('skips the next active seat when a three is played', () => {
    const { engine, state } = game();
    state.hands.a = [card('clubs', '3')];
    engine.applyAction(state, 'a', { type: 'play_ninety_nine', cardId: 'c-clubs-3', chosenValue: 3 });
    expect(state.currentTurnId).toBe('c');
  });

  it('reverses direction with four and grants another turn in a two-player game', () => {
    const four = game();
    four.state.hands.a = [card('clubs', '4')];
    four.engine.applyAction(four.state, 'a', { type: 'play_ninety_nine', cardId: 'c-clubs-4', chosenValue: 0 });
    expect(four.state).toMatchObject({ direction: -1, currentTurnId: 'd' });

    const two = game(['a', 'b']);
    two.state.hands.a = [card('clubs', '4')];
    two.engine.applyAction(two.state, 'a', { type: 'play_ninety_nine', cardId: 'c-clubs-4', chosenValue: 0 });
    expect(two.state).toMatchObject({ direction: 1, currentTurnId: 'a' });
  });

  it('forbids concession while any legal card remains', () => {
    const { engine, state } = game();
    state.total = 99;
    state.hands.a = [card('clubs', 'K')];
    expect(engine.applyAction(state, 'a', { type: 'concede_ninety_nine' })).toEqual({
      valid: false,
      reason: 'A legal card must be played',
    });
  });

  it('loses one token and starts a fresh hand when no play is legal', () => {
    const { engine, state } = game();
    state.total = 99;
    state.hands.a = [card('clubs', 'J'), card('diamonds', 'Q'), card('hearts', '8')];
    expect(engine.getPlayerView(state, 'a').mustConcede).toBe(true);
    expect(engine.applyAction(state, 'a', { type: 'concede_ninety_nine' })).toEqual({ valid: true });
    expect(state.tokens.a).toBe(2);
    expect(state).toMatchObject({ total: 0, handNumber: 2, dealerIndex: 0, currentTurnId: 'b' });
    expect(players.map((id) => state.hands[id].length)).toEqual([3, 3, 3, 3]);
  });

  it('eliminates a player on the third loss and finishes with the last token holder', () => {
    const { engine, state } = game(['a', 'b']);
    state.tokens.a = 1;
    state.total = 99;
    state.hands.a = [card('clubs', 'Q')];
    expect(engine.applyAction(state, 'a', { type: 'concede_ninety_nine' }).result).toMatchObject({
      gameKey: 'ninety-nine', winnerId: 'b', reason: 'last_with_tokens', tokens: { a: 0, b: 3 },
    });
  });

  it('recycles old discards while preserving the current top card', () => {
    const { engine, state } = game();
    state.stock = [];
    state.discardPile = [card('clubs', '2'), card('diamonds', '3')];
    state.hands.a = [card('hearts', 'K')];
    engine.applyAction(state, 'a', { type: 'play_ninety_nine', cardId: 'c-hearts-K', chosenValue: 0 });
    expect(state.hands.a).toHaveLength(1);
    expect(state.discardPile.map((entry) => entry.id)).toEqual(['c-hearts-K']);
  });

  it('never projects another active hand', () => {
    const { engine, state } = game();
    const hiddenId = state.hands.b[0].id;
    const view = engine.getPlayerView(state, 'a');
    expect(JSON.stringify(view)).not.toContain(`"${hiddenId}"`);
    expect(view.players.map((player) => player.handCount)).toEqual([3, 3, 3, 3]);
  });

  it('awards surrender to a remaining active player', () => {
    const { engine, state } = game();
    expect(engine.surrender(state, 'a').result).toMatchObject({ winnerId: 'b', reason: 'surrender' });
  });
});