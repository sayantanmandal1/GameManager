import type { HeartsAction, StandardCard } from '../../../shared';
import { HeartsEngine } from './hearts.engine';

describe('HeartsEngine', () => {
  const players = ['a', 'b', 'c', 'd'];
  const card = (suit: StandardCard['suit'], rank: StandardCard['rank']): StandardCard => ({ id: `c-${suit}-${rank}`, suit, rank });
  const game = () => {
    const engine = new HeartsEngine((cards) => cards);
    return { engine, state: engine.initGame(players, { a: 'A', b: 'B', c: 'C', d: 'D' }) };
  };
  const completeLeftPass = (engine: HeartsEngine, state: ReturnType<HeartsEngine['initGame']>) => {
    const selections = Object.fromEntries(players.map((id) => [id, state.hands[id].filter((entry) => entry.id !== 'c-clubs-2').slice(0, 3).map((entry) => entry.id)]));
    players.forEach((id) => engine.applyAction(state, id, { type: 'pass_cards', cardIds: selections[id] }));
    return selections;
  };

  it('deals all 52 unique cards to exactly four players', () => {
    const { engine, state } = game();
    expect(engine.rulesetId).toBe('hearts.standard-100.v1');
    expect(players.map((id) => state.hands[id].length)).toEqual([13, 13, 13, 13]);
    expect(new Set(players.flatMap((id) => state.hands[id].map((entry) => entry.id))).size).toBe(52);
    expect(() => engine.initGame(['a', 'b', 'c'], {})).toThrow('exactly four');
  });

  it('collects three simultaneous choices and passes left without exposing selections', () => {
    const { engine, state } = game();
    const selections = Object.fromEntries(players.map((id) => [id, state.hands[id].filter((entry) => entry.id !== 'c-clubs-2').slice(0, 3).map((entry) => entry.id)]));
    engine.applyAction(state, 'd', { type: 'pass_cards', cardIds: selections.d });
    expect(state.phase).toBe('passing');
    expect(engine.getPlayerView(state, 'a').players.find((entry) => entry.id === 'd')?.passed).toBe(true);
    expect(JSON.stringify(engine.getPlayerView(state, 'a'))).not.toContain(selections.d[0]);
    ['a', 'b', 'c'].forEach((id) => engine.applyAction(state, id, { type: 'pass_cards', cardIds: selections[id] }));
    expect(selections.a.every((id) => state.hands.b.some((entry) => entry.id === id))).toBe(true);
    expect(state.phase).toBe('playing');
  });

  it('rejects duplicate, foreign, repeated, and extra-field pass payloads', () => {
    const { engine, state } = game();
    const own = state.hands.a.slice(0, 3).map((entry) => entry.id);
    expect(engine.applyAction(state, 'a', { type: 'pass_cards', cardIds: [own[0], own[0], own[1]] })).toEqual({ valid: false, reason: 'Invalid pass' });
    expect(engine.applyAction(state, 'a', { type: 'pass_cards', cardIds: [...own, 'extra'] } as unknown as HeartsAction)).toEqual({ valid: false, reason: 'Invalid pass' });
    expect(engine.applyAction(state, 'a', { type: 'pass_cards', cardIds: [own[0], own[1], state.hands.b[0].id] })).toEqual({ valid: false, reason: 'Card not in hand' });
    engine.applyAction(state, 'a', { type: 'pass_cards', cardIds: own });
    expect(engine.applyAction(state, 'a', { type: 'pass_cards', cardIds: own })).toEqual({ valid: false, reason: 'Cards already selected' });
  });

  it('requires the holder to lead the two of clubs on the first trick', () => {
    const { engine, state } = game();
    completeLeftPass(engine, state);
    const holder = players.find((id) => state.hands[id].some((entry) => entry.id === 'c-clubs-2'))!;
    expect(state.currentTurnId).toBe(holder);
    expect(engine.getPlayerView(state, holder).legalCardIds).toEqual(['c-clubs-2']);
  });

  it('enforces turn ownership during trick play', () => {
    const { engine, state } = game();
    completeLeftPass(engine, state);
    const other = players.find((id) => id !== state.currentTurnId)!;
    expect(engine.applyAction(state, other, { type: 'play_card', cardId: state.hands[other][0].id })).toEqual({ valid: false, reason: 'Not your turn' });
  });

  it('requires following the led suit when possible', () => {
    const { engine, state } = game();
    state.phase = 'playing'; state.currentTurnId = 'b'; state.trick = [{ playerId: 'a', card: card('clubs', '5') }];
    state.hands = { a: [], b: [card('clubs', 'K'), card('hearts', '2')], c: [], d: [] };
    expect(engine.getPlayerView(state, 'b').legalCardIds).toEqual(['c-clubs-K']);
    expect(engine.applyAction(state, 'b', { type: 'play_card', cardId: 'c-hearts-2' })).toEqual({ valid: false, reason: 'Card is not legal' });
  });

  it('prevents a heart lead until broken unless the hand contains only hearts', () => {
    const { engine, state } = game();
    state.phase = 'playing'; state.currentTurnId = 'a'; state.trick = [];
    state.hands = { a: [card('hearts', 'A'), card('clubs', '3')], b: [], c: [], d: [] };
    expect(engine.getPlayerView(state, 'a').legalCardIds).toEqual(['c-clubs-3']);
    state.hands.a = [card('hearts', 'A'), card('hearts', '3')];
    expect(engine.getPlayerView(state, 'a').legalCardIds).toEqual(['c-hearts-A', 'c-hearts-3']);
  });

  it('breaks hearts when a heart is discarded off suit', () => {
    const { engine, state } = game();
    state.phase = 'playing'; state.currentTurnId = 'b'; state.trick = [{ playerId: 'a', card: card('clubs', '5') }];
    state.hands = { a: [card('diamonds', '2')], b: [card('hearts', '2')], c: [card('diamonds', '3')], d: [card('diamonds', '4')] };
    engine.applyAction(state, 'b', { type: 'play_card', cardId: 'c-hearts-2' });
    expect(state.heartsBroken).toBe(true);
  });

  it('assigns one point per heart and thirteen for the queen of spades', () => {
    const { engine, state } = game();
    state.phase = 'playing'; state.currentTurnId = 'd'; state.heartsBroken = true;
    state.trick = [
      { playerId: 'a', card: card('clubs', 'A') }, { playerId: 'b', card: card('hearts', '4') }, { playerId: 'c', card: card('spades', 'Q') },
    ];
    state.hands = { a: [card('diamonds', '2')], b: [card('diamonds', '3')], c: [card('diamonds', '4')], d: [card('clubs', '2'), card('diamonds', '5')] };
    engine.applyAction(state, 'd', { type: 'play_card', cardId: 'c-clubs-2' });
    expect(state.roundPoints.a).toBe(14);
  });

  it('applies shoot-the-moon scoring and ends at the first 100-point threshold', () => {
    const { engine, state } = game();
    state.phase = 'playing'; state.currentTurnId = 'd'; state.heartsBroken = true;
    state.scores = { a: 0, b: 80, c: 90, d: 99 }; state.roundPoints = { a: 22, b: 0, c: 0, d: 0 };
    state.hands = { a: [], b: [], c: [], d: [card('hearts', '2')] };
    state.trick = [
      { playerId: 'a', card: card('hearts', 'A') }, { playerId: 'b', card: card('hearts', 'K') }, { playerId: 'c', card: card('hearts', 'Q') },
    ];
    expect(engine.applyAction(state, 'd', { type: 'play_card', cardId: 'c-hearts-2' }).result).toMatchObject({
      winnerId: 'a', reason: 'score_limit', scores: { a: 0, b: 106, c: 116, d: 125 },
    });
  });

  it('chooses the lowest cumulative score when an ordinary round reaches 100', () => {
    const { engine, state } = game();
    state.phase = 'playing'; state.currentTurnId = 'd'; state.scores = { a: 99, b: 10, c: 20, d: 30 };
    state.roundPoints = { a: 1, b: 0, c: 0, d: 0 }; state.hands = { a: [], b: [], c: [], d: [card('clubs', '2')] };
    state.trick = [
      { playerId: 'a', card: card('clubs', 'A') }, { playerId: 'b', card: card('clubs', 'K') }, { playerId: 'c', card: card('clubs', 'Q') },
    ];
    expect(engine.applyAction(state, 'd', { type: 'play_card', cardId: 'c-clubs-2' }).result?.winnerId).toBe('b');
  });

  it('cycles left, right, across, then hold with no pass action', () => {
    const { engine, state } = game();
    state.roundNumber = 3; state.phase = 'playing'; state.currentTurnId = 'd';
    state.hands = { a: [], b: [], c: [], d: [card('clubs', '2')] }; state.roundPoints = { a: 0, b: 0, c: 0, d: 0 };
    state.trick = [
      { playerId: 'a', card: card('clubs', 'A') }, { playerId: 'b', card: card('clubs', 'K') }, { playerId: 'c', card: card('clubs', 'Q') },
    ];
    engine.applyAction(state, 'd', { type: 'play_card', cardId: 'c-clubs-2' });
    expect(state).toMatchObject({ roundNumber: 4, passDirection: 'hold', phase: 'playing' });
  });

  it('keeps opponents hands private in every player projection', () => {
    const { engine, state } = game();
    const hiddenId = state.hands.b[0].id;
    const view = engine.getPlayerView(state, 'a');
    expect(JSON.stringify(view)).not.toContain(hiddenId);
    expect(view.players.find((entry) => entry.id === 'b')?.handCount).toBe(13);
    expect(view).not.toHaveProperty('passSelections');
  });

  it('awards surrender to the lowest-scoring remaining player and rejects later play', () => {
    const { engine, state } = game();
    state.scores = { a: 5, b: 8, c: 2, d: 7 };
    expect(engine.surrender(state, 'a').result).toMatchObject({ winnerId: 'c', reason: 'surrender' });
    expect(engine.applyAction(state, 'c', { type: 'play_card', cardId: 'x' })).toEqual({ valid: false, reason: 'Game already finished' });
  });
});