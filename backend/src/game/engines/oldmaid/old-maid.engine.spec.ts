import type { OldMaidAction, StandardCard } from '../../../shared';
import { OldMaidEngine } from './old-maid.engine';

describe('OldMaidEngine', () => {
  const card = (rank: StandardCard['rank'], suit: StandardCard['suit'] = 'clubs'): StandardCard => ({ id: `c-${suit}-${rank}`, rank, suit });
  const game = (players = ['a', 'b', 'c']) => {
    const engine = new OldMaidEngine((cards) => cards);
    return { engine, state: engine.initGame(players, Object.fromEntries(players.map((id) => [id, id.toUpperCase()]))) };
  };

  it('deals a 51-card deck and automatically removes every in-hand pair', () => {
    const { engine, state } = game();
    expect(engine.rulesetId).toBe('old-maid.single-queen-51-card.v1');
    for (const hand of Object.values(state.hands)) {
      const counts = hand.reduce<Record<string, number>>((all, entry) => ({ ...all, [entry.rank]: (all[entry.rank] ?? 0) + 1 }), {});
      expect(Math.max(0, ...Object.values(counts))).toBeLessThanOrEqual(1);
    }
    expect(() => engine.initGame(['a'], {})).toThrow('two to eight');
  });

  it('enforces turn ownership', () => {
    const { engine, state } = game();
    const other = state.players.find((player) => player.id !== state.currentTurnId)!.id;
    expect(engine.applyAction(state, other, { type: 'draw_from_player', handIndex: 0 })).toEqual({ valid: false, reason: 'Not your turn' });
  });

  it('rejects out-of-range and extra-field draws', () => {
    const { engine, state } = game();
    const actor = state.currentTurnId;
    expect(engine.applyAction(state, actor, { type: 'draw_from_player', handIndex: 50 })).toEqual({ valid: false, reason: 'Invalid hand index' });
    expect(engine.applyAction(state, actor, { type: 'draw_from_player', handIndex: 0, rank: 'A' } as unknown as OldMaidAction)).toEqual({ valid: false, reason: 'Invalid draw' });
  });

  it('draws by hidden index, removes a new pair, and records safe order', () => {
    const { engine, state } = game();
    state.hands = { a: [card('A')], b: [card('A', 'diamonds')], c: [card('Q', 'spades')] };
    state.activePlayerIds = ['a', 'b', 'c'];
    state.safeOrder = [];
    state.currentTurnId = 'a';
    const outcome = engine.applyAction(state, 'a', { type: 'draw_from_player', handIndex: 0 });
    expect(outcome.result).toMatchObject({ winnerId: 'b', loserId: 'c', ranking: ['b', 'a', 'c'], reason: 'old_maid' });
  });

  it('targets the next active seat and skips players already safe', () => {
    const { engine, state } = game();
    state.activePlayerIds = ['a', 'c'];
    state.safeOrder = ['b'];
    state.currentTurnId = 'a';
    state.hands.b = [];
    expect(engine.getPlayerView(state, 'a')).toMatchObject({ targetPlayerId: 'c', targetHandCount: state.hands.c.length });
  });

  it('keeps every opponent card identity private', () => {
    const { engine, state } = game();
    state.hands.b = [card('K', 'spades')];
    const view = engine.getPlayerView(state, 'a');
    expect(JSON.stringify(view)).not.toContain('c-spades-K');
    expect(view.players.find((player) => player.id === 'b')?.handCount).toBe(1);
    expect(view).not.toHaveProperty('activePlayerIds');
  });

  it('ranks the unmatched-queen holder last when one active player remains', () => {
    const { engine, state } = game();
    state.hands = { a: [card('2')], b: [card('2', 'diamonds')], c: [card('Q', 'hearts')] };
    state.activePlayerIds = ['a', 'b', 'c'];
    state.safeOrder = [];
    state.currentTurnId = 'a';
    expect(engine.applyAction(state, 'a', { type: 'draw_from_player', handIndex: 0 }).result?.ranking.at(-1)).toBe('c');
  });

  it('awards surrender to the first ranked remaining player', () => {
    const { engine, state } = game();
    expect(engine.surrender(state, 'a').result).toMatchObject({ winnerId: 'b', loserId: 'a', reason: 'surrender' });
  });

  it('rejects draws after terminal resolution', () => {
    const { engine, state } = game();
    engine.surrender(state, 'a');
    expect(engine.applyAction(state, 'b', { type: 'draw_from_player', handIndex: 0 })).toEqual({ valid: false, reason: 'Game already finished' });
  });
});