import type { StandardCard } from '../../../shared';
import { SpoonsEngine } from './spoons.engine';

describe('SpoonsEngine', () => {
  const players = ['a', 'b', 'c', 'd'];
  const card = (suit: StandardCard['suit'], rank: StandardCard['rank']): StandardCard => ({ id: `c-${suit}-${rank}`, suit, rank });
  const game = () => {
    const engine = new SpoonsEngine((cards) => cards);
    const state = engine.initGame(players, { a: 'A', b: 'B', c: 'C', d: 'D' });
    return { engine, state };
  };

  it('deals four each, gives dealer the fifth card, and sets one fewer spoon', () => {
    const { engine, state } = game();
    expect(engine.rulesetId).toBe('spoons.standard-spoon-elimination.v1');
    expect(players.map((id) => state.hands[id].length)).toEqual([5, 4, 4, 4]);
    expect(state).toMatchObject({ currentTurnId: 'a', spoonsRemaining: 3, roundNumber: 1 });
    expect(new Set([...players.flatMap((id) => state.hands[id]), ...state.stock].map((entry) => entry.id)).size).toBe(52);
    expect(() => engine.initGame(['a', 'b'], {})).toThrow('three to eight');
  });

  it('passes one owned card left and preserves exactly one five-card hand', () => {
    const { engine, state } = game();
    const passedId = state.hands.a[0].id;
    expect(engine.applyAction(state, 'b', { type: 'pass_spoon_card', cardId: state.hands.b[0].id })).toEqual({ valid: false, reason: 'Not your turn to pass' });
    expect(engine.applyAction(state, 'a', { type: 'pass_spoon_card', cardId: passedId })).toEqual({ valid: true });
    expect(state.hands.a).toHaveLength(4);
    expect(state.hands.b).toHaveLength(5);
    expect(state.hands.b.some((entry) => entry.id === passedId)).toBe(true);
    expect(state.currentTurnId).toBe('b');
  });

  it('sends the last pass to trash and draws a new dealer card', () => {
    const { engine, state } = game();
    for (const playerId of players) {
      const passedId = state.hands[playerId][0].id;
      engine.applyAction(state, playerId, { type: 'pass_spoon_card', cardId: passedId });
    }
    expect(state.currentTurnId).toBe('a');
    expect(players.map((id) => state.hands[id].length)).toEqual([5, 4, 4, 4]);
    expect(state.trash).toHaveLength(1);
  });

  it('rejects a false rush start and opens only for a quartet', () => {
    const { engine, state } = game();
    state.hands.b = [card('clubs', '2'), card('diamonds', '3'), card('hearts', '4'), card('spades', '5')];
    expect(engine.applyAction(state, 'b', { type: 'grab_spoon' })).toEqual({ valid: false, reason: 'A quartet is required to start the rush' });
    state.hands.b = [card('clubs', '7'), card('diamonds', '7'), card('hearts', '7'), card('spades', '7')];
    expect(engine.applyAction(state, 'b', { type: 'grab_spoon' })).toEqual({ valid: true });
    expect(state).toMatchObject({ phase: 'spoon_rush', spoonsRemaining: 2, grabbedIds: ['b'] });
  });

  it('awards spoons in server action order and gives the leftover player a letter', () => {
    const { engine, state } = game();
    state.hands.a = [card('clubs', '7'), card('diamonds', '7'), card('hearts', '7'), card('spades', '7')];
    engine.applyAction(state, 'a', { type: 'grab_spoon' });
    engine.applyAction(state, 'c', { type: 'grab_spoon' });
    expect(engine.applyAction(state, 'b', { type: 'grab_spoon' })).toEqual({ valid: true });
    expect(state).toMatchObject({ phase: 'round_complete', letters: { d: 1 } });
    expect(state.lastRound).toMatchObject({ loserId: 'd', eliminated: false });
  });

  it('eliminates on the fifth letter and finishes with the last active player', () => {
    const { engine, state } = game();
    state.activePlayerIds = ['a', 'b']; state.spoonsRemaining = 1; state.letters.b = 4;
    state.hands.a = [card('clubs', '7'), card('diamonds', '7'), card('hearts', '7'), card('spades', '7')];
    expect(engine.applyAction(state, 'a', { type: 'grab_spoon' }).result).toMatchObject({
      gameKey: 'spoons', winnerId: 'a', reason: 'last_player', letters: { b: 5 },
    });
  });

  it('recycles trash when the dealer stock runs out', () => {
    const { engine, state } = game();
    state.stock = []; state.trash = [card('clubs', 'A'), card('diamonds', 'A')];
    state.hands.a = state.hands.a.slice(0, 4);
    state.currentTurnId = 'd'; state.hands.d.push(card('hearts', '2'));
    engine.applyAction(state, 'd', { type: 'pass_spoon_card', cardId: 'c-hearts-2' });
    expect(state.currentTurnId).toBe('a');
    expect(state.hands.a).toHaveLength(5);
    expect(state.stock).toHaveLength(2);
  });

  it('rotates dealer among active players and resets the round', () => {
    const { engine, state } = game();
    state.phase = 'round_complete'; state.activePlayerIds = ['a', 'c', 'd']; state.currentTurnId = 'a';
    expect(engine.applyAction(state, 'b', { type: 'next_spoons_round' })).toEqual({ valid: false, reason: 'Only the host can start the next round' });
    expect(engine.applyAction(state, 'a', { type: 'next_spoons_round' })).toEqual({ valid: true });
    expect(state).toMatchObject({ dealerIndex: 2, currentTurnId: 'c', roundNumber: 2, spoonsRemaining: 2 });
    expect(state.hands.c).toHaveLength(5);
  });

  it('keeps every opponent hand private while exposing counts and letters', () => {
    const { engine, state } = game();
    const view = engine.getPlayerView(state, 'a');
    const serialized = JSON.stringify(view);
    for (const opponentId of ['b', 'c', 'd']) for (const hiddenCard of state.hands[opponentId]) expect(serialized).not.toContain(`"${hiddenCard.id}"`);
    expect(view.players.map((player) => player.handCount)).toEqual([5, 4, 4, 4]);
  });

  it('awards surrender to another active player', () => {
    const { engine, state } = game();
    expect(engine.surrender(state, 'a').result).toMatchObject({ winnerId: 'b', reason: 'surrender' });
  });
});