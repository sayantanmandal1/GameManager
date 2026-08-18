import { ArcadeEngine } from './arcade.engine';
import {
  ArcadePhase,
  GAME_CATALOG,
  GameCatalogEntry,
  GameType,
  getGameDefinition,
} from '../../../shared';

const PLAYERS = ['p1', 'p2'];
const NAMES = { p1: 'Alice', p2: 'Bob' };

function definition(key: string): GameCatalogEntry & {
  family: 'alignment' | 'takeaway' | 'race' | 'memory';
} {
  return getGameDefinition(key)! as ReturnType<typeof definition>;
}

describe('ArcadeEngine', () => {
  let engine: ArcadeEngine;

  beforeEach(() => {
    engine = new ArcadeEngine();
  });

  it('initializes every arcade catalog title and produces redacted player views', () => {
    const arcadeTitles = GAME_CATALOG.filter((game) => game.gameType === GameType.ARCADE);
    expect(arcadeTitles).toHaveLength(80);

    for (const game of arcadeTitles) {
      const players = game.maxPlayers > 2 ? ['p1', 'p2', 'p3', 'p4'].slice(0, game.maxPlayers) : PLAYERS;
      const names = Object.fromEntries(players.map((id) => [id, id]));
      const state = engine.initGame('game', '123456', game as ReturnType<typeof definition>, players, names);
      const view = engine.getPlayerView(state, players[0]);
      expect(view).not.toBeNull();
      expect(view!.gameKey).toBe(game.key);
      expect(view!.phase).toBe(ArcadePhase.PLAYING);
      if (view!.memory) {
        expect(view!.memory.tiles.every((tile) => tile === null)).toBe(true);
      }

      const initialTurn = state.currentTurn;
      const action = state.family === 'alignment'
        ? { type: 'place' as const, index: 0 }
        : state.family === 'takeaway'
          ? { type: 'take' as const, heap: 0, count: 1 }
          : state.family === 'race'
            ? { type: 'roll' as const }
            : { type: 'flip' as const, index: 0 };
      const outcome = engine.applyAction(state, initialTurn, action);
      expect(outcome.valid).toBe(true);
      if (state.family === 'alignment') expect(state.alignment!.board.some(Boolean)).toBe(true);
      if (state.family === 'takeaway') expect(state.takeaway!.heaps[0]).toBeLessThan((game.rules.heaps as number[])[0]);
      if (state.family === 'race') expect(state.race!.lastRoll?.playerId).toBe(initialTurn);
      if (state.family === 'memory') expect(state.memory!.revealed).toEqual([0]);
    }
  });

  describe('alignment family', () => {
    it('wins after making the configured line', () => {
      const state = engine.initGame('g1', '123456', definition('three-grid'), PLAYERS, NAMES);

      expect(engine.applyAction(state, 'p1', { type: 'place', index: 0 }).valid).toBe(true);
      engine.applyAction(state, 'p2', { type: 'place', index: 3 });
      engine.applyAction(state, 'p1', { type: 'place', index: 1 });
      engine.applyAction(state, 'p2', { type: 'place', index: 4 });
      const result = engine.applyAction(state, 'p1', { type: 'place', index: 2 });

      expect(result.valid).toBe(true);
      expect(result.result?.winnerId).toBe('p1');
      expect(state.phase).toBe(ArcadePhase.FINISHED);
    });

    it('awards a misere line to the opponent', () => {
      const state = engine.initGame('g1', '123456', definition('misere-three'), PLAYERS, NAMES);
      engine.applyAction(state, 'p1', { type: 'place', index: 0 });
      engine.applyAction(state, 'p2', { type: 'place', index: 3 });
      engine.applyAction(state, 'p1', { type: 'place', index: 1 });
      engine.applyAction(state, 'p2', { type: 'place', index: 4 });
      const result = engine.applyAction(state, 'p1', { type: 'place', index: 2 });
      expect(result.result?.winnerId).toBe('p2');
    });

    it('applies gravity by using the lowest open row', () => {
      const state = engine.initGame('g1', '123456', definition('gravity-three'), PLAYERS, NAMES);
      engine.applyAction(state, 'p1', { type: 'place', index: 1 });
      expect(state.alignment!.board[21]).toBe('p1');
    });

    it('removes the oldest pawn in limited-piece variants', () => {
      const state = engine.initGame('g1', '123456', definition('three-piece-grid'), PLAYERS, NAMES);
      engine.applyAction(state, 'p1', { type: 'place', index: 0 });
      engine.applyAction(state, 'p2', { type: 'place', index: 3 });
      engine.applyAction(state, 'p1', { type: 'place', index: 1 });
      engine.applyAction(state, 'p2', { type: 'place', index: 4 });
      engine.applyAction(state, 'p1', { type: 'place', index: 5 });
      engine.applyAction(state, 'p2', { type: 'place', index: 6 });
      engine.applyAction(state, 'p1', { type: 'place', index: 7 });
      expect(state.alignment!.board[0]).toBeNull();
      expect(state.alignment!.board[7]).toBe('p1');
    });
  });

  describe('takeaway family', () => {
    it('validates take limits and finishes a normal game', () => {
      const state = engine.initGame('g1', '123456', definition('take-15'), PLAYERS, NAMES);
      expect(engine.applyAction(state, 'p1', { type: 'take', heap: 0, count: 4 })).toEqual({
        valid: false,
        reason: 'invalid_count',
      });
      state.takeaway!.heaps[0] = 2;
      const result = engine.applyAction(state, 'p1', { type: 'take', heap: 0, count: 2 });
      expect(result.result?.winnerId).toBe('p1');
    });

    it('awards the final counter to the opponent in misere play', () => {
      const state = engine.initGame('g1', '123456', definition('take-15-misere'), PLAYERS, NAMES);
      state.takeaway!.heaps[0] = 1;
      const result = engine.applyAction(state, 'p1', { type: 'take', heap: 0, count: 1 });
      expect(result.result?.winnerId).toBe('p2');
    });
  });

  describe('race family', () => {
    it('uses a server-generated roll within the configured die', () => {
      const state = engine.initGame('g1', '123456', definition('sprint-30'), PLAYERS, NAMES);
      const result = engine.applyAction(state, 'p1', { type: 'roll' });
      expect(result.valid).toBe(true);
      expect(state.race!.lastRoll?.value).toBeGreaterThanOrEqual(1);
      expect(state.race!.lastRoll?.value).toBeLessThanOrEqual(6);
      expect(state.currentTurn).toBe('p2');
    });

    it('does not allow a client to provide a dice value', () => {
      const state = engine.initGame('g1', '123456', definition('sprint-30'), PLAYERS, NAMES);
      const result = engine.applyAction(state, 'p1', { type: 'roll', value: 30 } as never);
      expect(result.valid).toBe(true);
      expect(state.race!.lastRoll?.value).toBeLessThanOrEqual(6);
    });
  });

  describe('memory family', () => {
    it('hides unmatched cards and scores a server-verified pair', () => {
      const state = engine.initGame('g1', '123456', definition('memory-sprint'), PLAYERS, NAMES);
      const first = 0;
      const second = state.memory!.deck.findIndex(
        (value, index) => index !== first && value === state.memory!.deck[first],
      );

      expect(engine.getPlayerView(state, 'p1')!.memory!.tiles.every((tile) => tile === null)).toBe(true);
      engine.applyAction(state, 'p1', { type: 'flip', index: first });
      expect(engine.getPlayerView(state, 'p2')!.memory!.tiles[first]).toBe(state.memory!.deck[first]);
      const result = engine.applyAction(state, 'p1', { type: 'flip', index: second });

      expect(result.valid).toBe(true);
      expect(state.players[0].score).toBe(1);
      expect(state.currentTurn).toBe('p1');
      expect(engine.getPlayerView(state, 'p2')!.memory!.matchedBy[first]).toBe('p1');
    });

    it('shows a mismatch until the next player continues', () => {
      const state = engine.initGame('g1', '123456', definition('memory-sprint'), PLAYERS, NAMES);
      const first = 0;
      const second = state.memory!.deck.findIndex((value) => value !== state.memory!.deck[first]);
      engine.applyAction(state, 'p1', { type: 'flip', index: first });
      engine.applyAction(state, 'p1', { type: 'flip', index: second });

      expect(state.currentTurn).toBe('p2');
      expect(state.memory!.pendingContinue).toBe(true);
      expect(engine.applyAction(state, 'p2', { type: 'flip', index: 2 })).toEqual({
        valid: false,
        reason: 'continue_required',
      });
      expect(engine.applyAction(state, 'p2', { type: 'continue' }).valid).toBe(true);
      expect(state.memory!.revealed).toEqual([]);
    });
  });
});
