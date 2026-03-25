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
} from '@/shared';

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
  return stepsFromStart === LUDO_BOARD_SIZE + 7;
}

export const FINISHED_STEPS = LUDO_BOARD_SIZE + 7;

export function isSafeSquare(absolutePos: number): boolean {
  return LUDO_SAFE_SQUARES.includes(absolutePos);
}

export interface TokenAtPosition {
  playerId: string;
  tokenId: number;
}

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

export function isPathBlocked(
  color: LudoColor,
  currentSteps: number,
  moveSteps: number,
  players: Record<string, LudoPlayerState>,
  movingPlayerId: string,
): boolean {
  for (let s = 1; s <= moveSteps; s++) {
    const intermediateSteps = currentSteps + s;
    if (isOnMainTrack(intermediateSteps)) {
      const absPos = getAbsolutePosition(color, intermediateSteps);
      if (isBlockedByOpponentStack(absPos, players, movingPlayerId)) {
        return true;
      }
    }
  }
  return false;
}

export function canTokenMove(
  token: LudoToken,
  steps: number,
  playerState: LudoPlayerState,
  allPlayers: Record<string, LudoPlayerState>,
): boolean {
  if (steps <= 0) return false;
  if (isFinished(token.stepsFromStart)) return false;
  if (isAtBase(token.stepsFromStart)) {
    if (steps !== 6) return false;
    const entryAbs = LUDO_START_POSITIONS[playerState.color];
    if (isBlockedByOpponentStack(entryAbs, allPlayers, playerState.id)) return false;
    return true;
  }
  const newSteps = token.stepsFromStart + steps;
  if (newSteps > FINISHED_STEPS) return false;
  if (isOnMainTrack(token.stepsFromStart)) {
    if (isPathBlocked(playerState.color, token.stepsFromStart, steps, allPlayers, playerState.id)) {
      return false;
    }
  }
  return true;
}

export function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
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

export function createInitialTokens(): LudoToken[] {
  return Array.from({ length: LUDO_TOKENS_PER_PLAYER }, (_, i) => ({
    id: i,
    state: 'base' as const,
    stepsFromStart: 0,
  }));
}
