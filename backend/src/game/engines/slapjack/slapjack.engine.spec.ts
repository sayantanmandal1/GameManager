import type { StandardCard } from '../../../shared';
import { SlapjackEngine } from './slapjack.engine';

describe('SlapjackEngine', () => {
  const players = ['a', 'b', 'c'];
  const card = (suit: StandardCard['suit'], rank: StandardCard['rank']): StandardCard => ({ id: `c-${suit}-${rank}`, suit, rank });
  const game = () => {
    const engine = new SlapjackEngine((cards) => cards);
    const state = engine.initGame(players, { a: 'A', b: 'B', c: 'C' });
    return { engine, state };
  };

  it('deals all cards face down as evenly as possible', () => {
    const { engine, state } = game();
    expect(engine.rulesetId).toBe('slapjack.standard-reaction-window.v1');
    expect(players.map((id) => state.stacks[id].length)).toEqual([18, 17, 17]);
    expect(new Set(players.flatMap((id) => state.stacks[id].map((entry) => entry.id))).size).toBe(52);
    expect(() => engine.initGame(['a'], {})).toThrow('two to eight');
  });

  it('flips only in turn and opens a reaction window on a jack', () => {
    const { engine, state } = game();
    state.stacks.a = [card('clubs', 'J'), card('clubs', '2')];
    expect(engine.applyAction(state, 'b', { type: 'flip_slapjack' })).toEqual({ valid: false, reason: 'Not your turn' });
    expect(engine.applyAction(state, 'a', { type: 'flip_slapjack' })).toEqual({ valid: true });
    expect(state).toMatchObject({ phase: 'slap_window', currentTurnId: 'b', topPlayerId: 'a' });
    expect(state.pile.at(-1)?.card.id).toBe('c-clubs-J');
    expect(engine.applyAction(state, 'b', { type: 'flip_slapjack' })).toEqual({ valid: false, reason: 'Resolve the jack before flipping' });
  });

  it('awards the entire pile to the first valid slap', () => {
    const { engine, state } = game();
    state.stacks.a = [card('clubs', 'J')]; state.stacks.b = [card('diamonds', '2')]; state.stacks.c = [card('hearts', '3')];
    engine.applyAction(state, 'a', { type: 'flip_slapjack' });
    expect(engine.applyAction(state, 'c', { type: 'slap_jack' })).toEqual({ valid: true });
    expect(state.phase).toBe('playing');
    expect(state.pile).toEqual([]);
    expect(state.stacks.c.some((entry) => entry.id === 'c-clubs-J')).toBe(true);
  });

  it('charges a false slap card to the player who flipped the top card', () => {
    const { engine, state } = game();
    state.stacks.a = [card('clubs', '5')]; state.stacks.b = [card('diamonds', '2'), card('diamonds', '3')];
    engine.applyAction(state, 'a', { type: 'flip_slapjack' });
    expect(engine.applyAction(state, 'b', { type: 'slap_jack' })).toEqual({ valid: true });
    expect(state.stacks.a.map((entry) => entry.id)).toContain('c-diamonds-2');
    expect(state.stacks.b.map((entry) => entry.id)).not.toContain('c-diamonds-2');
    expect(state.pile).toHaveLength(1);
  });

  it('lets a zero-card player recover by winning the next jack', () => {
    const { engine, state } = game();
    state.stacks.a = [card('clubs', 'J')]; state.stacks.b = [card('diamonds', '2')]; state.stacks.c = [];
    state.lastChanceIds = ['c']; state.currentTurnId = 'a';
    engine.applyAction(state, 'a', { type: 'flip_slapjack' });
    engine.applyAction(state, 'c', { type: 'slap_jack' });
    expect(state.eliminatedIds).not.toContain('c');
    expect(state.lastChanceIds).not.toContain('c');
    expect(state.stacks.c).toHaveLength(1);
  });

  it('eliminates zero-card players who fail the next jack window', () => {
    const { engine, state } = game();
    state.stacks.a = [card('clubs', 'J'), card('clubs', '2')]; state.stacks.b = [card('diamonds', '2')]; state.stacks.c = [];
    state.lastChanceIds = ['c']; state.currentTurnId = 'a';
    engine.applyAction(state, 'a', { type: 'flip_slapjack' });
    expect(engine.applyAction(state, 'b', { type: 'continue_slapjack' })).toEqual({ valid: true });
    expect(state.eliminatedIds).toContain('c');
    expect(state.phase).toBe('playing');
  });

  it('finishes immediately when a slap collects all fifty-two cards', () => {
    const { engine, state } = game();
    const deck = players.flatMap((id) => state.stacks[id]);
    const jack = deck.find((entry) => entry.rank === 'J')!;
    state.stacks = { a: deck.filter((entry) => entry.id !== jack.id), b: [], c: [] };
    state.pile = [{ playerId: 'b', card: jack }]; state.topPlayerId = 'b'; state.phase = 'slap_window';
    expect(engine.applyAction(state, 'a', { type: 'slap_jack' }).result).toMatchObject({ gameKey: 'slapjack', winnerId: 'a', reason: 'all_cards' });
  });

  it('never projects card identities from any face-down stack', () => {
    const { engine, state } = game();
    const view = engine.getPlayerView(state, 'a');
    const serialized = JSON.stringify(view);
    for (const playerId of players) for (const hiddenCard of state.stacks[playerId]) expect(serialized).not.toContain(`"${hiddenCard.id}"`);
    expect(view.players.map((player) => player.cardCount)).toEqual([18, 17, 17]);
  });

  it('awards surrender to another active player', () => {
    const { engine, state } = game();
    expect(engine.surrender(state, 'a').result).toMatchObject({ winnerId: 'b', reason: 'surrender' });
  });
});