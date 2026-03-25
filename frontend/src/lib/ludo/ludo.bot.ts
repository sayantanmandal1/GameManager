import type { LudoGameState, LudoMoveAction, LudoPlayerState } from '@/shared';
import { LUDO_SAFE_SQUARES, LUDO_BOARD_SIZE } from '@/shared';
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

const SCORE = {
  CAPTURE: 100,
  REACH_HOME: 90,
  EXIT_BASE: 80,
  ESCAPE_DANGER: 50,
  ENTER_SAFE: 40,
  CREATE_BLOCK: 30,
  ADVANCE_MULTIPLIER: 0.4,
  AVOID_DANGER: -40,
  BREAK_BLOCK_NEAR_HOME: 10,
};

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

  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

function evaluateMoveCombo(
  state: LudoGameState,
  playerId: string,
  combo: LudoMoveAction[],
): number {
  let totalScore = 0;
  let simPlayers = deepCopyPlayers(state.players);

  for (const action of combo) {
    totalScore += evaluateSingleMove(simPlayers, playerId, action);
    simPlayers = applySimulatedMove(simPlayers, playerId, action);
  }

  return totalScore;
}

function evaluateSingleMove(
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

  if (newSteps === FINISHED_STEPS) {
    return score + SCORE.REACH_HOME;
  }

  score += (newSteps - currentSteps) * SCORE.ADVANCE_MULTIPLIER;
  score += newSteps * 0.1;

  if (isOnMainTrack(newSteps)) {
    const absPos = getAbsolutePosition(player.color, newSteps);
    if (isSafeSquare(absPos)) score += SCORE.ENTER_SAFE;

    const opponentTokens = getTokensAtPosition(players, absPos, playerId);
    if (opponentTokens.length === 1 && !isSafeSquare(absPos)) score += SCORE.CAPTURE;

    if (isOnMainTrack(currentSteps)) {
      const currentAbs = getAbsolutePosition(player.color, currentSteps);
      if (!isSafeSquare(currentAbs) && isInDanger(currentAbs, players, playerId)) {
        score += SCORE.ESCAPE_DANGER;
      }
    }

    if (!isSafeSquare(absPos) && isInDanger(absPos, players, playerId)) {
      score += SCORE.AVOID_DANGER;
    }
  }

  if (isOnHomeColumn(newSteps)) {
    score += SCORE.ENTER_SAFE * 0.5;
  }

  return score;
}

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
      const distance = (absolutePos - tokenAbs + LUDO_BOARD_SIZE) % LUDO_BOARD_SIZE;
      if (distance >= 1 && distance <= 12) return true;
    }
  }
  return false;
}

function deepCopyPlayers(
  players: Record<string, LudoPlayerState>,
): Record<string, LudoPlayerState> {
  const copy: Record<string, LudoPlayerState> = {};
  for (const [pid, p] of Object.entries(players)) {
    copy[pid] = { ...p, tokens: p.tokens.map((t) => ({ ...t })) };
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
