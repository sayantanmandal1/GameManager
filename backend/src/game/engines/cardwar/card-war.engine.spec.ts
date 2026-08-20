import type { CardWarAction, StandardCard } from '../../../shared';
import { CardWarEngine } from './card-war.engine';

describe('CardWarEngine', () => {
  const card = (rank: StandardCard['rank'], id: string = rank): StandardCard => ({ id: `test-${id}`, rank, suit: 'clubs' });
  const game = () => {
    const engine = new CardWarEngine((cards) => cards);
    return { engine, state: engine.initGame(['a', 'b'], { a: 'Alice', b: 'Bob' }) };
  };

  it('splits one standard deck into two server-owned piles', () => {
    const { engine, state } = game();
    expect(engine.rulesetId).toBe('card-war.standard-52-card.v1');
    expect(state.decks.a).toHaveLength(26);
    expect(state.decks.b).toHaveLength(26);
    expect(new Set([...state.decks.a, ...state.decks.b].map((entry) => entry.id)).size).toBe(52);
  });

  it('enforces the rotating battle actor and exact action shape', () => {
    const { engine, state } = game();
    expect(engine.applyAction(state, 'b', { type: 'battle' })).toEqual({ valid: false, reason: 'Not your turn' });
    expect(engine.applyAction(state, 'a', { type: 'battle', cardId: 'x' } as unknown as CardWarAction)).toEqual({ valid: false, reason: 'Invalid battle action' });
  });

  it('compares both top cards and awards the complete pot', () => {
    const { engine, state } = game();
    state.decks = { a: [card('A')], b: [card('K')] };
    const outcome = engine.applyAction(state, 'a', { type: 'battle' });
    expect(outcome.result).toMatchObject({ winnerId: 'a', reason: 'all_cards', cardCounts: { a: 2, b: 0 } });
    expect(state.lastBattle).toMatchObject({ winnerId: 'a', potSize: 2 });
  });

  it('resolves a tied rank with three face-down cards and another face-up card', () => {
    const { engine, state } = game();
    state.decks = {
      a: [card('5', 'a5'), card('2'), card('3'), card('4'), card('K'), card('9')],
      b: [card('5', 'b5'), card('6'), card('7'), card('8'), card('Q'), card('10')],
    };
    engine.applyAction(state, 'a', { type: 'battle' });
    expect(state.lastBattle?.potSize).toBe(10);
    expect(state.lastBattle?.reveals[0]).toMatchObject({ faceDownCount: 3 });
    expect(state.lastBattle?.reveals[0].faceUp.map((entry) => entry.rank)).toEqual(['5', 'K']);
    expect(state.decks.a).toHaveLength(11);
  });

  it('handles one player lacking enough cards to continue a war', () => {
    const { engine, state } = game();
    state.decks = { a: [card('5', 'a5')], b: [card('5', 'b5'), card('2')] };
    expect(engine.applyAction(state, 'a', { type: 'battle' }).result).toMatchObject({ winnerId: 'b', reason: 'all_cards' });
  });

  it('declares a draw when neither tied player can expose another card', () => {
    const { engine, state } = game();
    state.decks = { a: [card('5', 'a5')], b: [card('5', 'b5')] };
    expect(engine.applyAction(state, 'a', { type: 'battle' }).result).toMatchObject({ winnerId: null, isDraw: true, reason: 'cannot_battle' });
  });

  it('never projects hidden deck identities or face-down cards', () => {
    const { engine, state } = game();
    const hiddenId = state.decks.b[3].id;
    const view = engine.getPlayerView(state, 'a');
    expect(JSON.stringify(view)).not.toContain(hiddenId);
    expect(view.players.map((player) => player.cardCount)).toEqual([26, 26]);
    expect(view).not.toHaveProperty('decks');
  });

  it('rotates the battle trigger when both players retain cards', () => {
    const { engine, state } = game();
    state.decks = { a: [card('A'), card('2')], b: [card('K'), card('3')] };
    engine.applyAction(state, 'a', { type: 'battle' });
    expect(state.currentTurnId).toBe('b');
    expect(state.phase).toBe('playing');
  });

  it('awards surrender and rejects later battles', () => {
    const { engine, state } = game();
    expect(engine.surrender(state, 'a').result).toMatchObject({ winnerId: 'b', reason: 'surrender' });
    expect(engine.applyAction(state, 'b', { type: 'battle' })).toEqual({ valid: false, reason: 'Game already finished' });
  });
});