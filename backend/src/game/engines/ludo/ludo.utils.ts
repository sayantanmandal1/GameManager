import * as crypto from 'crypto';
import {
  LudoColor,
  LudoToken,
  LudoPlayerState,
  LudoMoveAction,
  LudoGameState,
  LUDO_BOARD_SIZE,
  LUDO_TOKENS_PER_PLAYER,
  LUDO_START_POSITIONS,
  LUDO_SAFE_SQUARES,
} from '../../../shared';

// ─── Position Helpers ───

/** Convert a player-relative stepsFromStart to an absolute board position (0–51) */
export function getAbsolutePosition(color: LudoColor, stepsFromStart: number): number {
  if (stepsFromStart <= 0 || stepsFromStart > LUDO_BOARD_SIZE) return -1;
  const start = LUDO_START_POSITIONS[color];
  return (start + stepsFromStart - 1) % LUDO_BOARD_SIZE;
}

export function isAtBase(stepsFromStart: number): boolean {
  return stepsFromStart === 0;
}

export function isOnMainTrack(stepsFromStart: number): boolean {
  return stepsFromStart >= 1 && stepsFromStart <= LUDO_BOARD_SIZE;
}

export function isOnHomeColumn(stepsFromStart: number): boolean {
  return stepsFromStart >= LUDO_BOARD_SIZE + 1 && stepsFromStart <= LUDO_BOARD_SIZE + 6;
}

export function isFinished(stepsFromStart: number): boolean {
  return stepsFromStart === LUDO_BOARD_SIZE + 7; // 59
}

/** The exact step count where a token is finished (reached center) */
export const FINISHED_STEPS = LUDO_BOARD_SIZE + 7; // 59

/** The maximum steps on the home column entrance (step 53 is first home cell, 58 is last) */
export const HOME_ENTRANCE_STEP = LUDO_BOARD_SIZE + 1; // 53

export function isSafeSquare(absolutePos: number): boolean {
  return LUDO_SAFE_SQUARES.includes(absolutePos);
}

// ─── Token Queries ───

export interface TokenAtPosition {
  playerId: string;
  tokenId: number;
}

/** Find all tokens at a given absolute position on the main track, optionally excluding a player */
export function getTokensAtPosition(
  players: Record<string, LudoPlayerState>,
  absolutePos: number,
  excludePlayerId?: string,
): TokenAtPosition[] {
  const result: TokenAtPosition[] = [];
  for (const [pid, player] of Object.entries(players)) {
    if (excludePlayerId && pid === excludePlayerId) continue;
    for (const token of player.tokens) {
      if (!isOnMainTrack(token.stepsFromStart)) continue;
      const abs = getAbsolutePosition(player.color, token.stepsFromStart);
      if (abs === absolutePos) {
        result.push({ playerId: pid, tokenId: token.id });
      }
    }
  }
  return result;
}

/**
 * Check if a position is blocked by an opponent's stack (2+ tokens of same color).
 * A block cannot be passed through or landed on.
 */
export function isBlockedByOpponentStack(
  absolutePos: number,
  players: Record<string, LudoPlayerState>,
  movingPlayerId: string,
): boolean {
  for (const [pid, player] of Object.entries(players)) {
    if (pid === movingPlayerId) continue;
    let count = 0;
    for (const token of player.tokens) {
      if (!isOnMainTrack(token.stepsFromStart)) continue;
      if (getAbsolutePosition(player.color, token.stepsFromStart) === absolutePos) {
        count++;
      }
    }
    if (count >= 2) return true;
  }
  return false;
}

/**
 * Check if any square along the path from current to destination is blocked.
 * This checks all intermediate squares (not just the destination).
 */
export function isPathBlocked(
  color: LudoColor,
  currentSteps: number,
  moveSteps: number,
  players: Record<string, LudoPlayerState>,
  movingPlayerId: string,
): boolean {
  for (let s = 1; s <= moveSteps; s++) {
    const intermediateSteps = currentSteps + s;
    // Only check main track squares for blocking
    if (isOnMainTrack(intermediateSteps)) {
      const absPos = getAbsolutePosition(color, intermediateSteps);
      // Check intermediate squares (excluding destination for landing rules)
      if (s < moveSteps && isBlockedByOpponentStack(absPos, players, movingPlayerId)) {
        return true;
      }
      // Destination can also be blocked
      if (s === moveSteps && isBlockedByOpponentStack(absPos, players, movingPlayerId)) {
        return true;
      }
    }
  }
  return false;
}

// ─── Single Token Move Validation ───

/**
 * Check if a single token can move by the given number of steps.
 * Returns true if the move is legal.
 */
export function canTokenMove(
  token: LudoToken,
  steps: number,
  playerState: LudoPlayerState,
  allPlayers: Record<string, LudoPlayerState>,
): boolean {
  if (steps <= 0) return false;
  if (isFinished(token.stepsFromStart)) return false;

  // Token is at base — can only enter with exactly 6
  if (isAtBase(token.stepsFromStart)) {
    if (steps !== 6) return false;
    // Check if entry square is blocked
    const entryAbs = LUDO_START_POSITIONS[playerState.color];
    if (isBlockedByOpponentStack(entryAbs, allPlayers, playerState.id)) return false;
    return true;
  }

  const newSteps = token.stepsFromStart + steps;

  // Can't overshoot home
  if (newSteps > FINISHED_STEPS) return false;

  // Check path for blocks on main track
  if (isOnMainTrack(token.stepsFromStart)) {
    if (isPathBlocked(playerState.color, token.stepsFromStart, steps, allPlayers, playerState.id)) {
      return false;
    }
  }

  return true;
}

// ─── Dice ───

/** Roll a single fair die using cryptographic RNG */
export function rollDie(): number {
  return crypto.randomInt(1, 7);
}

export function calculateAllPossibleMoves(
  state: LudoGameState,
  playerId: string,
): LudoMoveAction[][] {
  const player = state.players[playerId];
  if (!player || state.dice == null) return [];
  const die = state.dice;
  const allMoves: LudoMoveAction[][] = [];

  const activeTokens = player.tokens.filter((t) => !isFinished(t.stepsFromStart));

  for (const token of activeTokens) {
    if (canTokenMove(token, die, player, state.players)) {
      allMoves.push([{ tokenId: token.id, steps: die }]);
    }
  }

  return allMoves;
}

/** Create initial tokens for a player (all at base) */
export function createInitialTokens(): LudoToken[] {
  return Array.from({ length: LUDO_TOKENS_PER_PLAYER }, (_, i) => ({
    id: i,
    state: 'base' as const,
    stepsFromStart: 0,
  }));
}
