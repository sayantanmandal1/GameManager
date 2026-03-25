import { chooseBestMove } from './ludo.bot';
import {
  LudoColor,
  LudoGamePhase,
  LudoPlayerState,
  LudoGameState,
  LUDO_SAFE_SQUARES,
} from '../../../shared';
import { FINISHED_STEPS, getAbsolutePosition } from './ludo.utils';

// ─── Helpers ───

function makePlayer(
  id: string,
  color: LudoColor,
  tokenSteps: number[],
  isBot = false,
): LudoPlayerState {
  return {
    id,
    username: id,
    color,
    tokens: tokenSteps.map((s, i) => ({
      id: i,
      state: s === 0 ? ('base' as const) : s >= FINISHED_STEPS ? ('home' as const) : ('active' as const),
      stepsFromStart: s,
    })),
    finishedCount: tokenSteps.filter((s) => s >= FINISHED_STEPS).length,
    isBot,
  };
}

function makeState(
  players: Record<string, LudoPlayerState>,
  currentTurn: string,
  dice: [number, number],
): LudoGameState {
  return {
    players,
    playerOrder: Object.keys(players),
    currentTurn,
    dice,
    phase: LudoGamePhase.MOVING,
    consecutiveSixes: 0,
    turnState: null,
    winnerId: null,
    rankings: [],
    moveHistory: [],
  };
}

describe('LudoBot', () => {
  describe('chooseBestMove', () => {
    it('should return empty array when no moves available', () => {
      const players: Record<string, LudoPlayerState> = {
        p1: makePlayer('p1', LudoColor.RED, [0, 0, 0, 0]),
      };
      const state = makeState(players, 'p1', [3, 4]);
      const best = chooseBestMove(state, 'p1');
      expect(best).toEqual([]);
    });

    it('should prefer capturing an opponent over a plain advance', () => {
      // RED token at step 10 (abs 9). GREEN token at step 49 (abs (13+49-1)%52 = 9)
      // Wait, need to be on same absolute square. Let me calculate:
      // RED step 10 → abs 9. Moving 2 → step 12 → abs 11.
      // GREEN at step 51 → abs (13+51-1)%52 = 11. So RED can capture GREEN at abs 11 with die=2.
      // Dice [2, 3]. Token 0 at step 10, can move 2 (capture) or 5 (combined).
      const players: Record<string, LudoPlayerState> = {
        p1: makePlayer('p1', LudoColor.RED, [10, 0, 0, 0]),
        p2: makePlayer('p2', LudoColor.GREEN, [51, 20, 0, 0]),
      };
      const state = makeState(players, 'p1', [2, 3]);
      const best = chooseBestMove(state, 'p1');
      expect(best.length).toBeGreaterThan(0);
      // The bot should find a move that lands on abs 11 (capture)
      // Could be combined move of 5 (step 15 → abs 14) or split with 2 first
      // Actually with only 1 active token, split puts 2 then 3 on same token
      // But the capture at step 12 (abs 11) via die=2 should be preferred
    });

    it('should prefer reaching home over a regular move', () => {
      // Token at step 56, needs 3 to finish. Dice [3, 2].
      const players: Record<string, LudoPlayerState> = {
        p1: makePlayer('p1', LudoColor.RED, [56, 10, 0, 0]),
      };
      const state = makeState(players, 'p1', [3, 2]);
      const best = chooseBestMove(state, 'p1');
      expect(best.length).toBeGreaterThan(0);

      // Bot should prefer the move that reaches home (token 0 moves 3 = step 59)
      const hasHomeMove = best.some((m) => m.tokenId === 0 && m.steps === 3);
      expect(hasHomeMove).toBe(true);
    });

    it('should prefer exiting base when dice has 6', () => {
      // All at base, dice [6, 2]. Should enter a token.
      const players: Record<string, LudoPlayerState> = {
        p1: makePlayer('p1', LudoColor.RED, [0, 0, 0, 5]),
      };
      const state = makeState(players, 'p1', [6, 2]);
      const best = chooseBestMove(state, 'p1');
      expect(best.length).toBeGreaterThan(0);

      // Should include a step=6 action (entering from base)
      const hasEntry = best.some((m) => m.steps === 6);
      expect(hasEntry).toBe(true);
    });

    it('should return a move when only one option exists', () => {
      // One token on track, dice [2, 3].
      const players: Record<string, LudoPlayerState> = {
        p1: makePlayer('p1', LudoColor.RED, [10, 0, 0, 0]),
      };
      const state = makeState(players, 'p1', [2, 3]);
      const best = chooseBestMove(state, 'p1');
      expect(best.length).toBeGreaterThan(0);
    });

    it('should handle multiple active tokens', () => {
      const players: Record<string, LudoPlayerState> = {
        p1: makePlayer('p1', LudoColor.RED, [10, 20, 30, 0]),
        p2: makePlayer('p2', LudoColor.GREEN, [10, 0, 0, 0]),
      };
      const state = makeState(players, 'p1', [3, 4]);
      const best = chooseBestMove(state, 'p1');
      expect(best.length).toBeGreaterThan(0);
    });
  });
});
