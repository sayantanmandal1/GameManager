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
} from '../../../shared';
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
  // ─── Game Initialization ───

  initGame(
    playerIds: string[],
    playerNames: Record<string, string>,
    botIds: string[] = [],
  ): LudoGameState {
    const totalPlayers = playerIds.length;
    const colors = LUDO_COLOR_ASSIGNMENTS[totalPlayers];
    if (!colors) {
      throw new Error(`Ludo requires 2-4 players, got ${totalPlayers}`);
    }

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

  // ─── Dice Rolling ───

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
    if (state.phase !== LudoGamePhase.ROLLING) {
      return { valid: false, reason: 'Not in rolling phase' };
    }
    if (state.currentTurn !== playerId) {
      return { valid: false, reason: 'Not your turn' };
    }

    const dice = rollDie();
    state.dice = dice;

    // Track consecutive sixes
    if (dice === 6) {
      state.consecutiveSixes++;
    } else {
      state.consecutiveSixes = 0;
    }

    // 3 consecutive sixes → cancel turn
    if (state.consecutiveSixes >= CONSECUTIVE_SIXES_LIMIT) {
      state.consecutiveSixes = 0;
      state.dice = null;
      state.turnState = { availableMoves: [], mustRollAgain: false, turnCanceled: true };
      this.advanceTurn(state);
      return { valid: true, dice, turnCanceled: true };
    }

    // Calculate available moves
    const availableMoves = calculateAllPossibleMoves(state, playerId);

    if (availableMoves.length === 0) {
      // No moves available — skip turn
      state.turnState = { availableMoves: [], mustRollAgain: false, turnCanceled: false };
      // If rolled a 6 but no moves, still get extra turn? No — spec says extra turn only on 6, capture, or home.
      // But the player couldn't move, so advance turn.
      this.advanceTurn(state);
      return { valid: true, dice, availableMoves: [], turnSkipped: true };
    }

    state.phase = LudoGamePhase.MOVING;
    state.turnState = { availableMoves, mustRollAgain: false, turnCanceled: false };

    return { valid: true, dice, availableMoves };
  }

  // ─── Token Movement ───

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
    if (state.phase !== LudoGamePhase.MOVING) {
      return { valid: false, reason: 'Not in moving phase' };
    }
    if (state.currentTurn !== playerId) {
      return { valid: false, reason: 'Not your turn' };
    }
    if (!state.turnState) {
      return { valid: false, reason: 'No turn state' };
    }

    // Validate the move combination is in the available set
    if (!this.isMoveInAvailableSet(state.turnState.availableMoves, moves)) {
      return { valid: false, reason: 'Invalid move combination' };
    }

    const player = state.players[playerId];
    const captures: LudoMoveRecord[] = [];
    let reachedHome = false;
    let capturedAny = false;

    // Execute each move action
    for (const action of moves) {
      const token = player.tokens.find((t) => t.id === action.tokenId);
      if (!token) return { valid: false, reason: 'Token not found' };

      const fromSteps = token.stepsFromStart;

      // Apply the move
      if (isAtBase(token.stepsFromStart) && action.steps === 6) {
        token.stepsFromStart = 1;
        token.state = 'active';
      } else {
        token.stepsFromStart += action.steps;
      }

      // Check if reached home
      if (isFinished(token.stepsFromStart)) {
        token.state = 'home';
        player.finishedCount++;
        reachedHome = true;
      }

      // Check for captures on main track
      if (isOnMainTrack(token.stepsFromStart)) {
        const absPos = getAbsolutePosition(player.color, token.stepsFromStart);
        if (!isSafeSquare(absPos)) {
          const enemyTokens = getTokensAtPosition(state.players, absPos, playerId);
          for (const enemy of enemyTokens) {
            // Only capture lone tokens (not part of a block)
            const enemyPlayer = state.players[enemy.playerId];
            const enemyToken = enemyPlayer.tokens.find((t) => t.id === enemy.tokenId);
            if (enemyToken) {
              const record: LudoMoveRecord = {
                playerId,
                tokenId: action.tokenId,
                from: fromSteps,
                to: token.stepsFromStart,
                captured: enemy.playerId,
              };
              captures.push(record);
              capturedAny = true;
              // Send opponent token back to base
              enemyToken.stepsFromStart = 0;
              enemyToken.state = 'base';
            }
          }
        }
      }

      // Record move
      state.moveHistory.push({
        playerId,
        tokenId: action.tokenId,
        from: fromSteps,
        to: token.stepsFromStart,
        captured: capturedAny ? captures[captures.length - 1]?.captured : undefined,
      });
    }

    // Check if this player has finished all tokens
    if (player.finishedCount === LUDO_TOKENS_PER_PLAYER) {
      if (!state.rankings.includes(playerId)) {
        state.rankings.push(playerId);
      }

      // Check if game is over (only 1 non-finished player remains, or all done)
      const activePlayers = state.playerOrder.filter(
        (pid) => !state.rankings.includes(pid),
      );

      if (activePlayers.length <= 1) {
        // Game over — add remaining players to rankings
        for (const pid of activePlayers) {
          if (!state.rankings.includes(pid)) {
            state.rankings.push(pid);
          }
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

    // Determine extra turn conditions
    const hasSix = state.dice === 6;
    const extraTurn = !!(hasSix || capturedAny || reachedHome);

    if (extraTurn) {
      // Same player rolls again
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

  // ─── Bot Execution ───

  executeBotTurn(
    state: LudoGameState,
    botPlayerId: string,
    depth: number = 0,
  ): LudoMoveRecord[] {
    if (depth >= MAX_BOT_RECURSION) return [];
    if (state.phase === LudoGamePhase.FINISHED) return [];
    if (state.currentTurn !== botPlayerId) return [];

    const player = state.players[botPlayerId];
    if (!player || !player.isBot) return [];

    const records: LudoMoveRecord[] = [];

    // Roll dice
    const rollResult = this.rollDice(state, botPlayerId);
    if (!rollResult.valid) return records;

    if (rollResult.turnCanceled || rollResult.turnSkipped) {
      return records;
    }

    // Choose best move
    const bestMove = chooseBestMove(state, botPlayerId);
    if (bestMove.length === 0) return records;

    // Execute the move
    const moveResult = this.moveToken(state, botPlayerId, bestMove);
    if (!moveResult.valid) return records;

    // Collect records from move history
    const lastRecords = state.moveHistory.slice(-bestMove.length);
    records.push(...lastRecords);

    // If bot gets extra turn, recurse
    if (moveResult.extraTurn && state.currentTurn === botPlayerId) {
      const moreRecords = this.executeBotTurn(state, botPlayerId, depth + 1);
      records.push(...moreRecords);
    }

    return records;
  }

  // ─── Player View ───

  getPlayerView(state: LudoGameState, playerId: string): LudoPlayerView {
    const player = state.players[playerId];
    const playerNames: Record<string, string> = {};
    for (const p of Object.values(state.players)) {
      playerNames[p.id] = p.username;
    }

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
      winnerName: state.winnerId
        ? state.players[state.winnerId]?.username || null
        : null,
      playerNames,
      isMyTurn: state.currentTurn === playerId,
    };
  }

  // ─── Bot Management ───

  addBot(
    state: LudoGameState,
    botName: string,
  ): { valid: boolean; reason?: string; botId?: string } {
    const currentCount = state.playerOrder.length;
    if (currentCount >= 4) {
      return { valid: false, reason: 'Game is full (max 4 players)' };
    }

    const allColors = LUDO_COLOR_ASSIGNMENTS[currentCount + 1];
    if (!allColors) {
      return { valid: false, reason: 'Invalid player count' };
    }

    const botId = `bot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Re-assign colors for new player count
    const newColorAssignment = LUDO_COLOR_ASSIGNMENTS[currentCount + 1];
    if (!newColorAssignment) {
      return { valid: false, reason: 'Cannot add more players' };
    }

    // Add bot player
    state.players[botId] = {
      id: botId,
      username: botName,
      color: newColorAssignment[currentCount], // Next available color
      tokens: createInitialTokens(),
      finishedCount: 0,
      isBot: true,
    };
    state.playerOrder.push(botId);

    // Re-assign all colors based on new player count
    for (let i = 0; i < state.playerOrder.length; i++) {
      state.players[state.playerOrder[i]].color = newColorAssignment[i];
    }

    return { valid: true, botId };
  }

  removeBot(
    state: LudoGameState,
    botId: string,
  ): { valid: boolean; reason?: string } {
    const player = state.players[botId];
    if (!player) return { valid: false, reason: 'Player not found' };
    if (!player.isBot) return { valid: false, reason: 'Player is not a bot' };

    delete state.players[botId];
    state.playerOrder = state.playerOrder.filter((pid) => pid !== botId);

    // Re-assign colors for new count
    const newCount = state.playerOrder.length;
    if (newCount >= 2) {
      const newColors = LUDO_COLOR_ASSIGNMENTS[newCount];
      if (newColors) {
        for (let i = 0; i < state.playerOrder.length; i++) {
          state.players[state.playerOrder[i]].color = newColors[i];
        }
      }
    }

    // If current turn was the removed bot, advance
    if (state.currentTurn === botId) {
      this.advanceTurn(state);
    }

    return { valid: true };
  }

  // ─── Surrender ───

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

    // Add surrendering player to the end of rankings
    state.rankings.push(playerId);

    // Check remaining active players
    const activePlayers = state.playerOrder.filter(
      (pid) => !state.rankings.includes(pid),
    );

    if (activePlayers.length <= 1) {
      // Game over — remaining player wins
      for (const pid of activePlayers) {
        if (!state.rankings.includes(pid)) {
          state.rankings.unshift(pid); // Winner goes first
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

    // More than 1 player remaining — game continues
    // If it was the surrendering player's turn, advance
    if (state.currentTurn === playerId) {
      this.advanceTurn(state);
    }

    return { valid: true };
  }

  // ─── Private Helpers ───

  private advanceTurn(state: LudoGameState): void {
    const currentIdx = state.playerOrder.indexOf(state.currentTurn);
    const totalPlayers = state.playerOrder.length;
    let nextIdx = (currentIdx + 1) % totalPlayers;
    let attempts = 0;

    // Skip finished players
    while (attempts < totalPlayers) {
      const nextId = state.playerOrder[nextIdx];
      if (!state.rankings.includes(nextId)) {
        break;
      }
      nextIdx = (nextIdx + 1) % totalPlayers;
      attempts++;
    }

    state.currentTurn = state.playerOrder[nextIdx];
    state.phase = LudoGamePhase.ROLLING;
    state.dice = null;
    state.turnState = null;
  }

  private isMoveInAvailableSet(
    available: LudoMoveAction[][],
    moves: LudoMoveAction[],
  ): boolean {
    if (available.length === 0) return false;

    return available.some((combo) => {
      if (combo.length !== moves.length) return false;
      // Normalize both for comparison
      const sortedCombo = [...combo].sort(
        (a, b) => a.tokenId - b.tokenId || a.steps - b.steps,
      );
      const sortedMoves = [...moves].sort(
        (a, b) => a.tokenId - b.tokenId || a.steps - b.steps,
      );
      return sortedCombo.every(
        (c, i) =>
          c.tokenId === sortedMoves[i].tokenId &&
          c.steps === sortedMoves[i].steps,
      );
    });
  }
}
