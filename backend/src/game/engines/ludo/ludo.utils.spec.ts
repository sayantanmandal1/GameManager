import {
  getAbsolutePosition,
  isAtBase,
  isOnMainTrack,
  isOnHomeColumn,
  isFinished,
  isSafeSquare,
  getTokensAtPosition,
  isBlockedByOpponentStack,
  isPathBlocked,
  canTokenMove,
  rollTwoDice,
  calculateAllPossibleMoves,
  createInitialTokens,
  FINISHED_STEPS,
  HOME_ENTRANCE_STEP,
} from './ludo.utils';
import {
  LudoColor,
  LudoGamePhase,
  LudoPlayerState,
  LudoGameState,
  LUDO_BOARD_SIZE,
  LUDO_SAFE_SQUARES,
  LUDO_START_POSITIONS,
  LUDO_TOKENS_PER_PLAYER,
} from '../../../shared';

// ─── Helper to build a minimal game state ───

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
  dice: [number, number] | null = null,
): LudoGameState {
  return {
    players,
    playerOrder: Object.keys(players),
    currentTurn,
    dice,
    phase: dice ? LudoGamePhase.MOVING : LudoGamePhase.ROLLING,
    consecutiveSixes: 0,
    turnState: null,
    winnerId: null,
    rankings: [],
    moveHistory: [],
  };
}

// ─── Tests ───

describe('LudoUtils', () => {
  // ─── Position Helpers ───

  describe('getAbsolutePosition', () => {
    it('should return the correct absolute position for RED at step 1', () => {
      // RED starts at 0, so step 1 → absolute 0
      expect(getAbsolutePosition(LudoColor.RED, 1)).toBe(0);
    });

    it('should return the correct absolute position for GREEN at step 1', () => {
      // GREEN starts at 13, so step 1 → absolute 13
      expect(getAbsolutePosition(LudoColor.GREEN, 1)).toBe(13);
    });

    it('should wrap around the board correctly', () => {
      // RED at step 52 → absolute (0 + 52 - 1) % 52 = 51
      expect(getAbsolutePosition(LudoColor.RED, 52)).toBe(51);
    });

    it('should handle wrap for non-RED colors', () => {
      // GREEN at step 40 → absolute (13 + 40 - 1) % 52 = 0
      expect(getAbsolutePosition(LudoColor.GREEN, 40)).toBe(0);
    });

    it('should return -1 for invalid step values', () => {
      expect(getAbsolutePosition(LudoColor.RED, 0)).toBe(-1);
      expect(getAbsolutePosition(LudoColor.RED, 53)).toBe(-1);
      expect(getAbsolutePosition(LudoColor.RED, -1)).toBe(-1);
    });
  });

  describe('isAtBase / isOnMainTrack / isOnHomeColumn / isFinished', () => {
    it('should identify base position', () => {
      expect(isAtBase(0)).toBe(true);
      expect(isAtBase(1)).toBe(false);
    });

    it('should identify main track range', () => {
      expect(isOnMainTrack(1)).toBe(true);
      expect(isOnMainTrack(52)).toBe(true);
      expect(isOnMainTrack(0)).toBe(false);
      expect(isOnMainTrack(53)).toBe(false);
    });

    it('should identify home column range', () => {
      expect(isOnHomeColumn(53)).toBe(true);
      expect(isOnHomeColumn(58)).toBe(true);
      expect(isOnHomeColumn(52)).toBe(false);
      expect(isOnHomeColumn(59)).toBe(false);
    });

    it('should identify finished position', () => {
      expect(isFinished(59)).toBe(true);
      expect(isFinished(58)).toBe(false);
    });
  });

  describe('FINISHED_STEPS / HOME_ENTRANCE_STEP constants', () => {
    it('should have correct values', () => {
      expect(FINISHED_STEPS).toBe(LUDO_BOARD_SIZE + 7); // 59
      expect(HOME_ENTRANCE_STEP).toBe(LUDO_BOARD_SIZE + 1); // 53
    });
  });

  describe('isSafeSquare', () => {
    it('should return true for known safe squares', () => {
      for (const sq of LUDO_SAFE_SQUARES) {
        expect(isSafeSquare(sq)).toBe(true);
      }
    });

    it('should return false for non-safe squares', () => {
      expect(isSafeSquare(1)).toBe(false);
      expect(isSafeSquare(10)).toBe(false);
      expect(isSafeSquare(50)).toBe(false);
    });
  });

  // ─── Token Queries ───

  describe('getTokensAtPosition', () => {
    it('should find opponent tokens at an absolute position', () => {
      const players: Record<string, LudoPlayerState> = {
        p1: makePlayer('p1', LudoColor.RED, [5, 0, 0, 0]),
        p2: makePlayer('p2', LudoColor.GREEN, [5, 0, 0, 0]), // GREEN step 5 → abs (13+5-1)%52 = 17
      };

      // RED step 5 → abs 4
      const tokensAt4 = getTokensAtPosition(players, 4);
      expect(tokensAt4).toHaveLength(1);
      expect(tokensAt4[0].playerId).toBe('p1');
    });

    it('should exclude a specified player', () => {
      const players: Record<string, LudoPlayerState> = {
        p1: makePlayer('p1', LudoColor.RED, [5, 0, 0, 0]),
        p2: makePlayer('p2', LudoColor.GREEN, [5, 0, 0, 0]),
      };

      const tokensAt4 = getTokensAtPosition(players, 4, 'p1');
      expect(tokensAt4).toHaveLength(0);
    });

    it('should not include tokens at base or home column', () => {
      const players: Record<string, LudoPlayerState> = {
        p1: makePlayer('p1', LudoColor.RED, [0, 55, 0, 0]),
      };

      const tokensAt0 = getTokensAtPosition(players, 0);
      expect(tokensAt0).toHaveLength(0);
    });
  });

  describe('isBlockedByOpponentStack', () => {
    it('should detect a 2-token block by an opponent', () => {
      // GREEN tokens at step 1 → abs 13
      const players: Record<string, LudoPlayerState> = {
        p1: makePlayer('p1', LudoColor.RED, [0, 0, 0, 0]),
        p2: makePlayer('p2', LudoColor.GREEN, [1, 1, 0, 0]),
      };
      // Absolute position 13 (GREEN start)
      expect(isBlockedByOpponentStack(13, players, 'p1')).toBe(true);
    });

    it('should not flag a single opponent token as a block', () => {
      const players: Record<string, LudoPlayerState> = {
        p1: makePlayer('p1', LudoColor.RED, [0, 0, 0, 0]),
        p2: makePlayer('p2', LudoColor.GREEN, [1, 0, 0, 0]),
      };
      expect(isBlockedByOpponentStack(13, players, 'p1')).toBe(false);
    });

    it('should not flag own tokens as a block', () => {
      const players: Record<string, LudoPlayerState> = {
        p1: makePlayer('p1', LudoColor.RED, [1, 1, 0, 0]),
      };
      // abs 0 (RED start)
      expect(isBlockedByOpponentStack(0, players, 'p1')).toBe(false);
    });
  });

  describe('isPathBlocked', () => {
    it('should detect a block along the path', () => {
      // GREEN has a 2-token block at abs 2
      // abs 2 → for RED that's step 3 (0 + 3 - 1 = 2)
      // RED token at step 1 trying to move 4 steps → passes through step 3 (abs 2)
      const players: Record<string, LudoPlayerState> = {
        p1: makePlayer('p1', LudoColor.RED, [1, 0, 0, 0]),
        p2: makePlayer('p2', LudoColor.GREEN, [42, 42, 0, 0]),
        // GREEN step 42 → abs (13 + 42 - 1) % 52 = 2
      };

      expect(isPathBlocked(LudoColor.RED, 1, 4, players, 'p1')).toBe(true);
    });

    it('should allow movement when path is clear', () => {
      const players: Record<string, LudoPlayerState> = {
        p1: makePlayer('p1', LudoColor.RED, [1, 0, 0, 0]),
        p2: makePlayer('p2', LudoColor.GREEN, [0, 0, 0, 0]),
      };

      expect(isPathBlocked(LudoColor.RED, 1, 4, players, 'p1')).toBe(false);
    });
  });

  // ─── canTokenMove ───

  describe('canTokenMove', () => {
    it('should allow a base token to enter with 6', () => {
      const players: Record<string, LudoPlayerState> = {
        p1: makePlayer('p1', LudoColor.RED, [0, 0, 0, 0]),
      };
      const token = players.p1.tokens[0]; // at base
      expect(canTokenMove(token, 6, players.p1, players)).toBe(true);
    });

    it('should not allow a base token to enter with non-6', () => {
      const players: Record<string, LudoPlayerState> = {
        p1: makePlayer('p1', LudoColor.RED, [0, 0, 0, 0]),
      };
      const token = players.p1.tokens[0];
      expect(canTokenMove(token, 3, players.p1, players)).toBe(false);
      expect(canTokenMove(token, 5, players.p1, players)).toBe(false);
    });

    it('should not allow moving a finished token', () => {
      const players: Record<string, LudoPlayerState> = {
        p1: makePlayer('p1', LudoColor.RED, [FINISHED_STEPS, 0, 0, 0]),
      };
      const token = players.p1.tokens[0];
      expect(canTokenMove(token, 1, players.p1, players)).toBe(false);
    });

    it('should not allow overshooting home', () => {
      const players: Record<string, LudoPlayerState> = {
        p1: makePlayer('p1', LudoColor.RED, [57, 0, 0, 0]),
      };
      const token = players.p1.tokens[0]; // at step 57, needs exactly 2 to finish
      expect(canTokenMove(token, 3, players.p1, players)).toBe(false);
      expect(canTokenMove(token, 2, players.p1, players)).toBe(true);
    });

    it('should allow exact home entry', () => {
      const players: Record<string, LudoPlayerState> = {
        p1: makePlayer('p1', LudoColor.RED, [56, 0, 0, 0]),
      };
      const token = players.p1.tokens[0]; // step 56, needs 3 to reach 59
      expect(canTokenMove(token, 3, players.p1, players)).toBe(true);
    });

    it('should not allow entry when start square is blocked', () => {
      // RED start is at abs 0. GREEN has 2 tokens at abs 0 → GREEN step 40 → abs (13+40-1)%52 = 0
      const players: Record<string, LudoPlayerState> = {
        p1: makePlayer('p1', LudoColor.RED, [0, 0, 0, 0]),
        p2: makePlayer('p2', LudoColor.GREEN, [40, 40, 0, 0]),
      };
      const token = players.p1.tokens[0];
      expect(canTokenMove(token, 6, players.p1, players)).toBe(false);
    });

    it('should not allow movement through a blocked square', () => {
      // GREEN block at abs 6: GREEN step 46 → abs (13+46-1)%52 = 6
      // RED at step 5 (abs 4), move 3 = step 8 (abs 7)
      // Path: step 6 (abs 5), step 7 (abs 6=BLOCKED), step 8 dest (abs 7)
      // Block at abs 6 → movement should be blocked
      const players: Record<string, LudoPlayerState> = {
        p1: makePlayer('p1', LudoColor.RED, [5, 0, 0, 0]),
        p2: makePlayer('p2', LudoColor.GREEN, [46, 46, 0, 0]),
      };
      const token = players.p1.tokens[0];
      expect(canTokenMove(token, 3, players.p1, players)).toBe(false);
    });

    it('should block movement when opponent has 2+ tokens on intermediate square', () => {
      // GREEN block at abs 6: GREEN step 46 → abs (13+46-1)%52 = 6 ✓
      // RED at step 5 (abs 4), move 4 = step 9 (abs 8)
      // Path: step 6 (abs 5), step 7 (abs 6=BLOCKED), step 8 (abs 7), step 9 dest (abs 8)
      const players: Record<string, LudoPlayerState> = {
        p1: makePlayer('p1', LudoColor.RED, [5, 0, 0, 0]),
        p2: makePlayer('p2', LudoColor.GREEN, [46, 46, 0, 0]),
      };
      const token = players.p1.tokens[0];
      expect(canTokenMove(token, 4, players.p1, players)).toBe(false);
    });
  });

  // ─── Dice ───

  describe('rollTwoDice', () => {
    it('should return two numbers between 1 and 6', () => {
      for (let i = 0; i < 50; i++) {
        const [d1, d2] = rollTwoDice();
        expect(d1).toBeGreaterThanOrEqual(1);
        expect(d1).toBeLessThanOrEqual(6);
        expect(d2).toBeGreaterThanOrEqual(1);
        expect(d2).toBeLessThanOrEqual(6);
      }
    });
  });

  // ─── createInitialTokens ───

  describe('createInitialTokens', () => {
    it('should create 4 tokens at base', () => {
      const tokens = createInitialTokens();
      expect(tokens).toHaveLength(LUDO_TOKENS_PER_PLAYER);
      tokens.forEach((t, i) => {
        expect(t.id).toBe(i);
        expect(t.state).toBe('base');
        expect(t.stepsFromStart).toBe(0);
      });
    });
  });

  // ─── calculateAllPossibleMoves ───

  describe('calculateAllPossibleMoves', () => {
    it('should return empty when all tokens are at base and no 6 rolled', () => {
      const players: Record<string, LudoPlayerState> = {
        p1: makePlayer('p1', LudoColor.RED, [0, 0, 0, 0]),
      };
      const state = makeState(players, 'p1', [3, 4]);
      const moves = calculateAllPossibleMoves(state, 'p1');
      expect(moves).toHaveLength(0);
    });

    it('should allow entering from base when one die is 6', () => {
      const players: Record<string, LudoPlayerState> = {
        p1: makePlayer('p1', LudoColor.RED, [0, 0, 0, 0]),
      };
      const state = makeState(players, 'p1', [6, 3]);
      const moves = calculateAllPossibleMoves(state, 'p1');
      // Should have at least one move (enter + move 3, or combined 9 if possible)
      expect(moves.length).toBeGreaterThan(0);

      // At least one move should include a step=6 action (entering from base)
      const hasEntry = moves.some((combo) => combo.some((m) => m.steps === 6));
      expect(hasEntry).toBe(true);
    });

    it('should allow combined move on an active token', () => {
      const players: Record<string, LudoPlayerState> = {
        p1: makePlayer('p1', LudoColor.RED, [10, 0, 0, 0]),
      };
      const state = makeState(players, 'p1', [3, 4]);
      const moves = calculateAllPossibleMoves(state, 'p1');

      // Should be able to move token 0 by 7 (combined)
      const hasCombined = moves.some(
        (combo) => combo.length === 1 && combo[0].tokenId === 0 && combo[0].steps === 7,
      );
      expect(hasCombined).toBe(true);
    });

    it('should allow split moves on different tokens', () => {
      const players: Record<string, LudoPlayerState> = {
        p1: makePlayer('p1', LudoColor.RED, [10, 20, 0, 0]),
      };
      const state = makeState(players, 'p1', [3, 4]);
      const moves = calculateAllPossibleMoves(state, 'p1');

      // Should allow: token0+3 & token1+4, token0+4 & token1+3
      const hasSplit = moves.some(
        (combo) => combo.length === 2,
      );
      expect(hasSplit).toBe(true);
    });

    it('should fall back to single die moves when both dice cannot be used', () => {
      // Token at step 56, dice [4, 5]. Combined = 9 → overshoot. 4 → overshoot (60). 5 → overshoot (61).
      // Actually step 56 + 3 = 59 (finished). 56 + 4 = 60 (overshoot).
      // Let's use step 55. 55+4=59 (ok). 55+5=60 (overshoot). Combined 55+9=64 (overshoot).
      // So only one die (4) works → single die move.
      const players: Record<string, LudoPlayerState> = {
        p1: makePlayer('p1', LudoColor.RED, [55, 0, 0, 0]),
      };
      const state = makeState(players, 'p1', [4, 5]);
      const moves = calculateAllPossibleMoves(state, 'p1');

      // Should have a single die move for token 0 with steps 4
      expect(moves.length).toBeGreaterThan(0);
      const hasSingle4 = moves.some(
        (combo) => combo.length === 1 && combo[0].tokenId === 0 && combo[0].steps === 4,
      );
      expect(hasSingle4).toBe(true);
    });

    it('should handle double dice (same value)', () => {
      const players: Record<string, LudoPlayerState> = {
        p1: makePlayer('p1', LudoColor.RED, [10, 20, 0, 0]),
      };
      const state = makeState(players, 'p1', [3, 3]);
      const moves = calculateAllPossibleMoves(state, 'p1');
      expect(moves.length).toBeGreaterThan(0);

      // Should have combined (6 on one token) and split (3+3 on same or different)
      const hasCombined = moves.some(
        (combo) => combo.length === 1 && combo[0].steps === 6,
      );
      expect(hasCombined).toBe(true);
    });

    it('should not produce moves for finished tokens', () => {
      const players: Record<string, LudoPlayerState> = {
        p1: makePlayer('p1', LudoColor.RED, [FINISHED_STEPS, FINISHED_STEPS, FINISHED_STEPS, 10]),
      };
      const state = makeState(players, 'p1', [3, 4]);
      const moves = calculateAllPossibleMoves(state, 'p1');

      // All moves should only reference token 3 (id=3) since others are finished
      for (const combo of moves) {
        for (const action of combo) {
          expect(action.tokenId).toBe(3);
        }
      }
    });
  });
});
