import {
  LudoGameState,
  LudoGamePhase,
  LudoPlayerState,
  LudoPlayerView,
  LudoWinResult,
  LudoMoveAction,
  LudoMoveRecord,
  LudoColor,
  LUDO_COLOR_ASSIGNMENTS,
  LUDO_TOKENS_PER_PLAYER,
  LUDO_START_POSITIONS,
} from '@/shared';
import {
  rollDie,
  calculateAllPossibleMoves,
  getAbsolutePosition,
  isAtBase,
  isOnMainTrack,
  isFinished,
  isSafeSquare,
  getTokensAtPosition,
  createInitialTokens,
  FINISHED_STEPS,
} from './ludo.utils';
import { chooseBestMove } from './ludo.bot';

const MAX_BOT_RECURSION = 10;
const CONSECUTIVE_SIXES_LIMIT = 3;

export class LudoEngine {
  initGame(
    playerIds: string[],
    playerNames: Record<string, string>,
    botIds: string[] = [],
  ): LudoGameState {
    const totalPlayers = playerIds.length;
    const colors = LUDO_COLOR_ASSIGNMENTS[totalPlayers];
    if (!colors) throw new Error(`Ludo requires 2-4 players, got ${totalPlayers}`);

    const players: Record<string, LudoPlayerState> = {};
    for (let i = 0; i < playerIds.length; i++) {
      const pid = playerIds[i];
      players[pid] = {
        id: pid,
        username: playerNames[pid] || `Player ${i + 1}`,
        color: colors[i],
        tokens: createInitialTokens(),
        finishedCount: 0,
        isBot: botIds.includes(pid),
      };
    }

    return {
      players,
      playerOrder: [...playerIds],
      currentTurn: playerIds[0],
      dice: null,
      phase: LudoGamePhase.ROLLING,
      consecutiveSixes: 0,
      turnState: null,
      winnerId: null,
      rankings: [],
      moveHistory: [],
    };
  }

  rollDice(
    state: LudoGameState,
    playerId: string,
  ): {
    valid: boolean;
    reason?: string;
    dice?: number;
    availableMoves?: LudoMoveAction[][];
    turnSkipped?: boolean;
    turnCanceled?: boolean;
  } {
    if (state.phase !== LudoGamePhase.ROLLING) return { valid: false, reason: 'Not in rolling phase' };
    if (state.currentTurn !== playerId) return { valid: false, reason: 'Not your turn' };

    const dice = rollDie();
    state.dice = dice;

    if (dice === 6) {
      state.consecutiveSixes++;
    } else {
      state.consecutiveSixes = 0;
    }

    if (state.consecutiveSixes >= CONSECUTIVE_SIXES_LIMIT) {
      state.consecutiveSixes = 0;
      state.dice = null;
      state.turnState = { availableMoves: [], mustRollAgain: false, turnCanceled: true };
      this.advanceTurn(state);
      return { valid: true, dice, turnCanceled: true };
    }

    const availableMoves = calculateAllPossibleMoves(state, playerId);

    if (availableMoves.length === 0) {
      state.turnState = { availableMoves: [], mustRollAgain: false, turnCanceled: false };
      this.advanceTurn(state);
      return { valid: true, dice, availableMoves: [], turnSkipped: true };
    }

    state.phase = LudoGamePhase.MOVING;
    state.turnState = { availableMoves, mustRollAgain: false, turnCanceled: false };
    return { valid: true, dice, availableMoves };
  }

  moveToken(
    state: LudoGameState,
    playerId: string,
    moves: LudoMoveAction[],
  ): {
    valid: boolean;
    reason?: string;
    captures?: LudoMoveRecord[];
    reachedHome?: boolean;
    winner?: LudoWinResult;
    extraTurn?: boolean;
  } {
    if (state.phase !== LudoGamePhase.MOVING) return { valid: false, reason: 'Not in moving phase' };
    if (state.currentTurn !== playerId) return { valid: false, reason: 'Not your turn' };
    if (!state.turnState) return { valid: false, reason: 'No turn state' };

    if (!this.isMoveInAvailableSet(state.turnState.availableMoves, moves)) {
      return { valid: false, reason: 'Invalid move combination' };
    }

    const player = state.players[playerId];
    const captures: LudoMoveRecord[] = [];
    let reachedHome = false;
    let capturedAny = false;

    for (const action of moves) {
      const token = player.tokens.find((t) => t.id === action.tokenId);
      if (!token) return { valid: false, reason: 'Token not found' };
      const fromSteps = token.stepsFromStart;

      if (isAtBase(token.stepsFromStart) && action.steps === 6) {
        token.stepsFromStart = 1;
        token.state = 'active';
      } else {
        token.stepsFromStart += action.steps;
      }

      if (isFinished(token.stepsFromStart)) {
        token.state = 'home';
        player.finishedCount++;
        reachedHome = true;
      }

      if (isOnMainTrack(token.stepsFromStart)) {
        const absPos = getAbsolutePosition(player.color, token.stepsFromStart);
        if (!isSafeSquare(absPos)) {
          const enemyTokens = getTokensAtPosition(state.players, absPos, playerId);
          for (const enemy of enemyTokens) {
            const enemyPlayer = state.players[enemy.playerId];
            const enemyToken = enemyPlayer.tokens.find((t) => t.id === enemy.tokenId);
            if (enemyToken) {
              captures.push({
                playerId,
                tokenId: action.tokenId,
                from: fromSteps,
                to: token.stepsFromStart,
                captured: enemy.playerId,
              });
              capturedAny = true;
              enemyToken.stepsFromStart = 0;
              enemyToken.state = 'base';
            }
          }
        }
      }

      state.moveHistory.push({
        playerId,
        tokenId: action.tokenId,
        from: fromSteps,
        to: token.stepsFromStart,
        captured: capturedAny ? captures[captures.length - 1]?.captured : undefined,
      });
    }

    if (player.finishedCount === LUDO_TOKENS_PER_PLAYER) {
      if (!state.rankings.includes(playerId)) state.rankings.push(playerId);
      const activePlayers = state.playerOrder.filter((pid) => !state.rankings.includes(pid));
      if (activePlayers.length <= 1) {
        for (const pid of activePlayers) {
          if (!state.rankings.includes(pid)) state.rankings.push(pid);
        }
        state.phase = LudoGamePhase.FINISHED;
        state.winnerId = state.rankings[0];
        state.turnState = null;
        return {
          valid: true,
          captures: captures.length > 0 ? captures : undefined,
          reachedHome,
          winner: {
            winnerId: state.rankings[0],
            winnerName: state.players[state.rankings[0]]?.username || 'Unknown',
            rankings: [...state.rankings],
          },
        };
      }
    }

    const hasSix = state.dice === 6;
    const extraTurn = !!(hasSix || capturedAny || reachedHome);

    if (extraTurn) {
      state.phase = LudoGamePhase.ROLLING;
      state.dice = null;
      state.turnState = null;
    } else {
      this.advanceTurn(state);
    }

    return {
      valid: true,
      captures: captures.length > 0 ? captures : undefined,
      reachedHome,
      extraTurn,
    };
  }

  executeBotTurn(
    state: LudoGameState,
    botPlayerId: string,
    depth: number = 0,
  ): LudoMoveRecord[] {
    if (depth >= MAX_BOT_RECURSION || state.phase === LudoGamePhase.FINISHED) return [];
    if (state.currentTurn !== botPlayerId) return [];
    const player = state.players[botPlayerId];
    if (!player || !player.isBot) return [];

    const records: LudoMoveRecord[] = [];
    const rollResult = this.rollDice(state, botPlayerId);
    if (!rollResult.valid || rollResult.turnCanceled || rollResult.turnSkipped) return records;

    const bestMove = chooseBestMove(state, botPlayerId);
    if (bestMove.length === 0) return records;

    const moveResult = this.moveToken(state, botPlayerId, bestMove);
    if (!moveResult.valid) return records;

    const lastRecords = state.moveHistory.slice(-bestMove.length);
    records.push(...lastRecords);

    if (moveResult.extraTurn && state.currentTurn === botPlayerId) {
      const moreRecords = this.executeBotTurn(state, botPlayerId, depth + 1);
      records.push(...moreRecords);
    }

    return records;
  }

  getPlayerView(state: LudoGameState, playerId: string): LudoPlayerView {
    const player = state.players[playerId];
    const playerNames: Record<string, string> = {};
    for (const p of Object.values(state.players)) playerNames[p.id] = p.username;

    return {
      myColor: player?.color || LudoColor.RED,
      players: state.playerOrder.map((pid) => state.players[pid]),
      currentTurn: state.currentTurn,
      dice: state.dice,
      phase: state.phase,
      availableMoves:
        state.currentTurn === playerId && state.turnState
          ? state.turnState.availableMoves
          : null,
      rankings: [...state.rankings],
      winnerId: state.winnerId,
      winnerName: state.winnerId ? state.players[state.winnerId]?.username || null : null,
      playerNames,
      isMyTurn: state.currentTurn === playerId,
    };
  }

  surrender(
    state: LudoGameState,
    playerId: string,
  ): { valid: boolean; reason?: string; winner?: LudoWinResult } {
    if (state.phase === LudoGamePhase.FINISHED) {
      return { valid: false, reason: 'Game already finished' };
    }
    if (!state.players[playerId]) {
      return { valid: false, reason: 'Player not found' };
    }
    if (state.rankings.includes(playerId)) {
      return { valid: false, reason: 'Player already finished' };
    }

    state.rankings.push(playerId);

    const activePlayers = state.playerOrder.filter(
      (pid) => !state.rankings.includes(pid),
    );

    if (activePlayers.length <= 1) {
      for (const pid of activePlayers) {
        if (!state.rankings.includes(pid)) {
          state.rankings.unshift(pid);
        }
      }
      state.phase = LudoGamePhase.FINISHED;
      state.winnerId = state.rankings[0];
      state.turnState = null;
      state.dice = null;

      return {
        valid: true,
        winner: {
          winnerId: state.rankings[0],
          winnerName: state.players[state.rankings[0]]?.username || 'Unknown',
          rankings: [...state.rankings],
          surrenderedBy: playerId,
        },
      };
    }

    if (state.currentTurn === playerId) {
      this.advanceTurn(state);
    }

    return { valid: true };
  }

  private advanceTurn(state: LudoGameState): void {
    const currentIdx = state.playerOrder.indexOf(state.currentTurn);
    const total = state.playerOrder.length;
    let nextIdx = (currentIdx + 1) % total;
    let attempts = 0;
    while (attempts < total) {
      const nextId = state.playerOrder[nextIdx];
      if (!state.rankings.includes(nextId)) break;
      nextIdx = (nextIdx + 1) % total;
      attempts++;
    }
    state.currentTurn = state.playerOrder[nextIdx];
    state.phase = LudoGamePhase.ROLLING;
    state.dice = null;
    state.turnState = null;
  }

  private isMoveInAvailableSet(available: LudoMoveAction[][], moves: LudoMoveAction[]): boolean {
    return available.some((combo) => {
      if (combo.length !== moves.length) return false;
      const sc = [...combo].sort((a, b) => a.tokenId - b.tokenId || a.steps - b.steps);
      const sm = [...moves].sort((a, b) => a.tokenId - b.tokenId || a.steps - b.steps);
      return sc.every((c, i) => c.tokenId === sm[i].tokenId && c.steps === sm[i].steps);
    });
  }
}
