import {
  LudoGameState,
  LudoMoveAction,
  LudoPlayerState,
  LUDO_SAFE_SQUARES,
  LUDO_START_POSITIONS,
  LudoColor,
} from '../../../shared';
import {
  getAbsolutePosition,
  isAtBase,
  isOnMainTrack,
  isOnHomeColumn,
  isFinished,
  isSafeSquare,
  getTokensAtPosition,
  FINISHED_STEPS,
  calculateAllPossibleMoves,
} from './ludo.utils';

// ─── Scoring Weights ───
const SCORE = {
  CAPTURE: 100,
  REACH_HOME: 90,
  EXIT_BASE: 80,
  ESCAPE_DANGER: 50,
  ENTER_SAFE: 40,
  CREATE_BLOCK: 30,
  ADVANCE_MULTIPLIER: 0.4, // per step closer to home
  AVOID_DANGER: -40,
  BREAK_BLOCK_NEAR_HOME: 10,
};

/**
 * Choose the best move combination from all available moves.
 * Evaluates every legal option using a weighted heuristic.
 */
export function chooseBestMove(
  state: LudoGameState,
  playerId: string,
): LudoMoveAction[] {
  const moves = calculateAllPossibleMoves(state, playerId);
  if (moves.length === 0) return [];
  if (moves.length === 1) return moves[0];

  let bestScore = -Infinity;
  let bestMoves: LudoMoveAction[][] = [];

  for (const combo of moves) {
    const score = evaluateMoveCombo(state, playerId, combo);
    if (score > bestScore) {
      bestScore = score;
      bestMoves = [combo];
    } else if (score === bestScore) {
      bestMoves.push(combo);
    }
  }

  // Random tie-break for variety
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

/**
 * Evaluate a combination of moves (1 or 2 LudoMoveActions).
 * Higher score = better move.
 */
function evaluateMoveCombo(
  state: LudoGameState,
  playerId: string,
  combo: LudoMoveAction[],
): number {
  const player = state.players[playerId];
  let totalScore = 0;

  // Simulate moves sequentially and score each
  let simPlayers = deepCopyPlayers(state.players);

  for (const action of combo) {
    const score = evaluateSingleMove(state, simPlayers, playerId, action);
    totalScore += score;
    // Apply the move to the simulation
    simPlayers = applySimulatedMove(simPlayers, playerId, action);
  }

  return totalScore;
}

function evaluateSingleMove(
  originalState: LudoGameState,
  players: Record<string, LudoPlayerState>,
  playerId: string,
  action: LudoMoveAction,
): number {
  const player = players[playerId];
  const token = player.tokens.find((t) => t.id === action.tokenId);
  if (!token) return 0;

  let score = 0;
  const currentSteps = token.stepsFromStart;
  let newSteps: number;

  if (isAtBase(currentSteps) && action.steps === 6) {
    newSteps = 1;
    score += SCORE.EXIT_BASE;
  } else {
    newSteps = currentSteps + action.steps;
  }

  // Reaching home (finished)
  if (newSteps === FINISHED_STEPS) {
    score += SCORE.REACH_HOME;
    return score; // No further analysis needed
  }

  // Advancing toward home
  score += (newSteps - currentSteps) * SCORE.ADVANCE_MULTIPLIER;

  // Bonus for being further along (prioritize tokens closer to home)
  score += newSteps * 0.1;

  // Check if landing on a safe square
  if (isOnMainTrack(newSteps)) {
    const absPos = getAbsolutePosition(player.color, newSteps);

    if (isSafeSquare(absPos)) {
      score += SCORE.ENTER_SAFE;
    }

    // Check for capture
    const opponentTokens = getTokensAtPosition(players, absPos, playerId);
    if (opponentTokens.length === 1 && !isSafeSquare(absPos)) {
      score += SCORE.CAPTURE;
    }

    // Check if creating a block with own token
    const ownTokensAtDest = getOwnTokensAtAbsolutePos(player, absPos, action.tokenId);
    if (ownTokensAtDest === 1) {
      score += SCORE.CREATE_BLOCK;
    }

    // ESCAPE DANGER: if currently on a dangerous square, moving away is good
    if (isOnMainTrack(currentSteps)) {
      const currentAbs = getAbsolutePosition(player.color, currentSteps);
      if (!isSafeSquare(currentAbs) && isInDanger(currentAbs, players, playerId)) {
        score += SCORE.ESCAPE_DANGER;
      }
    }

    // AVOID DANGER: if destination is reachable by opponents
    if (!isSafeSquare(absPos) && isInDanger(absPos, players, playerId)) {
      score += SCORE.AVOID_DANGER;
    }
  }

  // Home column: safe and close to finish
  if (isOnHomeColumn(newSteps)) {
    score += SCORE.ENTER_SAFE * 0.5; // Home column is inherently safe
    score += (newSteps - FINISHED_STEPS + 1) * -2; // Closer to home = better
  }

  // Break own block near home — if token is close to home, unstacking is good
  if (isOnMainTrack(currentSteps) && currentSteps > 45) {
    const currentAbs = getAbsolutePosition(player.color, currentSteps);
    const ownAtCurrent = getOwnTokensAtAbsolutePos(player, currentAbs, -1);
    if (ownAtCurrent >= 2) {
      score += SCORE.BREAK_BLOCK_NEAR_HOME;
    }
  }

  return score;
}

// ─── Helper Functions ───

function getOwnTokensAtAbsolutePos(
  player: LudoPlayerState,
  absolutePos: number,
  excludeTokenId: number,
): number {
  let count = 0;
  for (const token of player.tokens) {
    if (token.id === excludeTokenId) continue;
    if (!isOnMainTrack(token.stepsFromStart)) continue;
    if (getAbsolutePosition(player.color, token.stepsFromStart) === absolutePos) {
      count++;
    }
  }
  return count;
}

/**
 * Check if a square is "in danger" — reachable by any opponent token
 * within a single dice roll (1–6).
 */
function isInDanger(
  absolutePos: number,
  players: Record<string, LudoPlayerState>,
  currentPlayerId: string,
): boolean {
  for (const [pid, player] of Object.entries(players)) {
    if (pid === currentPlayerId) continue;
    for (const token of player.tokens) {
      if (!isOnMainTrack(token.stepsFromStart)) continue;
      const tokenAbs = getAbsolutePosition(player.color, token.stepsFromStart);
      // Can an opponent reach this square with a roll of 1–6?
      const distance = (absolutePos - tokenAbs + 52) % 52;
      if (distance >= 1 && distance <= 6) {
        return true;
      }
    }
  }
  return false;
}

function deepCopyPlayers(
  players: Record<string, LudoPlayerState>,
): Record<string, LudoPlayerState> {
  const copy: Record<string, LudoPlayerState> = {};
  for (const [pid, p] of Object.entries(players)) {
    copy[pid] = {
      ...p,
      tokens: p.tokens.map((t) => ({ ...t })),
    };
  }
  return copy;
}

function applySimulatedMove(
  players: Record<string, LudoPlayerState>,
  playerId: string,
  action: LudoMoveAction,
): Record<string, LudoPlayerState> {
  const copy = deepCopyPlayers(players);
  const player = copy[playerId];
  const token = player.tokens.find((t) => t.id === action.tokenId);
  if (!token) return copy;

  if (isAtBase(token.stepsFromStart) && action.steps === 6) {
    token.stepsFromStart = 1;
    token.state = 'active';
  } else {
    token.stepsFromStart += action.steps;
    if (isFinished(token.stepsFromStart)) {
      token.state = 'home';
      player.finishedCount++;
    }
  }

  // Apply capture (send opponent tokens home)
  if (isOnMainTrack(token.stepsFromStart)) {
    const absPos = getAbsolutePosition(player.color, token.stepsFromStart);
    if (!isSafeSquare(absPos)) {
      for (const [pid, p] of Object.entries(copy)) {
        if (pid === playerId) continue;
        for (const t of p.tokens) {
          if (!isOnMainTrack(t.stepsFromStart)) continue;
          if (getAbsolutePosition(p.color, t.stepsFromStart) === absPos) {
            t.stepsFromStart = 0;
            t.state = 'base';
          }
        }
      }
    }
  }

  return copy;
}
