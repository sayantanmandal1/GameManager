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

export function rollTwoDice(): [number, number] {
  return [
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
  ];
}

export function calculateAllPossibleMoves(
  state: LudoGameState,
  playerId: string,
): LudoMoveAction[][] {
  const player = state.players[playerId];
  if (!player || !state.dice) return [];
  const [die1, die2] = state.dice;
  const allMoves: LudoMoveAction[][] = [];
  const seen = new Set<string>();

  const addIfUnique = (moves: LudoMoveAction[]) => {
    const sorted = [...moves].sort((a, b) => a.tokenId - b.tokenId || a.steps - b.steps);
    const key = sorted.map((m) => `${m.tokenId}:${m.steps}`).join('|');
    if (!seen.has(key)) {
      seen.add(key);
      allMoves.push(moves);
    }
  };

  const activeTokens = player.tokens.filter((t) => !isFinished(t.stepsFromStart));
  const combined = die1 + die2;

  for (const token of activeTokens) {
    if (canTokenMove(token, combined, player, state.players)) {
      addIfUnique([{ tokenId: token.id, steps: combined }]);
    }
  }

  if (die1 === die2) {
    for (const t1 of activeTokens) {
      if (!canTokenMove(t1, die1, player, state.players)) continue;
      const simPlayers = simulateMove(state.players, playerId, t1.id, die1, player.color);
      const simPlayer = simPlayers[playerId];
      for (const t2 of simPlayer.tokens) {
        if (isFinished(t2.stepsFromStart)) continue;
        if (canTokenMove(t2, die2, simPlayer, simPlayers)) {
          addIfUnique([
            { tokenId: t1.id, steps: die1 },
            { tokenId: t2.id, steps: die2 },
          ]);
        }
      }
    }
  } else {
    for (const [first, second] of [[die1, die2], [die2, die1]]) {
      for (const t1 of activeTokens) {
        if (!canTokenMove(t1, first, player, state.players)) continue;
        const simPlayers = simulateMove(state.players, playerId, t1.id, first, player.color);
        const simPlayer = simPlayers[playerId];
        for (const t2 of simPlayer.tokens) {
          if (isFinished(t2.stepsFromStart)) continue;
          if (canTokenMove(t2, second, simPlayer, simPlayers)) {
            addIfUnique([
              { tokenId: t1.id, steps: first },
              { tokenId: t2.id, steps: second },
            ]);
          }
        }
      }
    }
  }

  const hasBothDiceMove = allMoves.some((moves) => {
    const totalSteps = moves.reduce((sum, m) => sum + m.steps, 0);
    return totalSteps === die1 + die2;
  });

  if (!hasBothDiceMove) {
    for (const token of activeTokens) {
      if (canTokenMove(token, die1, player, state.players)) {
        addIfUnique([{ tokenId: token.id, steps: die1 }]);
      }
      if (die1 !== die2 && canTokenMove(token, die2, player, state.players)) {
        addIfUnique([{ tokenId: token.id, steps: die2 }]);
      }
    }
  }

  return allMoves;
}

function simulateMove(
  players: Record<string, LudoPlayerState>,
  playerId: string,
  tokenId: number,
  steps: number,
  color: LudoColor,
): Record<string, LudoPlayerState> {
  const copy: Record<string, LudoPlayerState> = {};
  for (const [pid, p] of Object.entries(players)) {
    copy[pid] = { ...p, tokens: p.tokens.map((t) => ({ ...t })) };
  }
  const token = copy[playerId].tokens.find((t) => t.id === tokenId);
  if (!token) return copy;
  if (isAtBase(token.stepsFromStart) && steps === 6) {
    token.stepsFromStart = 1;
    token.state = 'active';
  } else {
    token.stepsFromStart += steps;
    if (isFinished(token.stepsFromStart)) token.state = 'home';
  }
  return copy;
}

export function createInitialTokens(): LudoToken[] {
  return Array.from({ length: LUDO_TOKENS_PER_PLAYER }, (_, i) => ({
    id: i,
    state: 'base' as const,
    stepsFromStart: 0,
  }));
}
