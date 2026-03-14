import {
  BingoGameState,
  BingoGamePhase,
  BingoPlayerView,
  BingoWinResult,
  BINGO_TOTAL_NUMBERS,
  BINGO_CONSTANTS,
} from '@multiplayer-games/shared';
import {
  createEmptyBoard,
  markNumberOnBoard,
  countCompletedLines,
  isBoardFilled,
  isNumberOnBoard,
} from './bingo.utils';

export class BingoEngine {
  /** Create initial game state — both players get empty boards for setup */
  initGame(playerIds: string[]): BingoGameState {
    const boards: Record<string, ReturnType<typeof createEmptyBoard>> = {};
    for (const id of playerIds) {
      boards[id] = createEmptyBoard();
    }

    const completedLines: Record<string, number> = {};
    for (const id of playerIds) {
      completedLines[id] = 0;
    }

    return {
      boards,
      phase: BingoGamePhase.SETUP,
      setupDone: [],
      currentTurn: null,
      chosenNumbers: [],
      completedLines,
      playerIds: [...playerIds],
      winnerId: null,
    };
  }

  /** Place a number on the player's board during setup phase */
  placeNumber(
    state: BingoGameState,
    playerId: string,
    row: number,
    col: number,
    number: number,
  ): { valid: boolean; reason?: string } {
    if (state.phase !== BingoGamePhase.SETUP) {
      return { valid: false, reason: 'Not in setup phase' };
    }
    if (state.setupDone.includes(playerId)) {
      return { valid: false, reason: 'You already finished setup' };
    }
    const board = state.boards[playerId];
    if (!board) return { valid: false, reason: 'Player not in game' };

    if (row < 0 || row >= 5 || col < 0 || col >= 5) {
      return { valid: false, reason: 'Invalid cell position' };
    }
    if (number < 1 || number > BINGO_TOTAL_NUMBERS) {
      return { valid: false, reason: `Number must be 1-${BINGO_TOTAL_NUMBERS}` };
    }
    if (board[row][col].value !== 0) {
      return { valid: false, reason: 'Cell already has a number' };
    }
    if (isNumberOnBoard(board, number)) {
      return { valid: false, reason: 'Number already placed on your board' };
    }

    // Place it
    board[row][col] = { value: number, marked: false };

    // Check if this player's board is fully filled
    if (isBoardFilled(board)) {
      state.setupDone.push(playerId);

      // If all players are done with setup, transition to playing
      if (state.setupDone.length === state.playerIds.length) {
        state.phase = BingoGamePhase.PLAYING;
        state.currentTurn = state.playerIds[0]; // first player goes first
      }
    }

    return { valid: true };
  }

  /** Player chooses a number during the play phase — marks it on ALL boards */
  chooseNumber(
    state: BingoGameState,
    playerId: string,
    number: number,
  ): { valid: boolean; reason?: string; winner?: BingoWinResult } {
    if (state.phase !== BingoGamePhase.PLAYING) {
      return { valid: false, reason: 'Game is not in playing phase' };
    }
    if (state.currentTurn !== playerId) {
      return { valid: false, reason: 'Not your turn' };
    }
    if (number < 1 || number > BINGO_TOTAL_NUMBERS) {
      return { valid: false, reason: `Number must be 1-${BINGO_TOTAL_NUMBERS}` };
    }
    if (state.chosenNumbers.includes(number)) {
      return { valid: false, reason: 'Number already chosen' };
    }

    // Mark the number on ALL boards
    state.chosenNumbers.push(number);
    for (const pid of state.playerIds) {
      markNumberOnBoard(state.boards[pid], number);
    }

    // Recount completed lines for all players
    for (const pid of state.playerIds) {
      state.completedLines[pid] = countCompletedLines(state.boards[pid]);
    }

    // Check for winner (first to 5 lines = B-I-N-G-O)
    for (const pid of state.playerIds) {
      if (state.completedLines[pid] >= BINGO_CONSTANTS.LINES_TO_WIN) {
        state.winnerId = pid;
        state.phase = BingoGamePhase.FINISHED;
        state.currentTurn = null;
        return {
          valid: true,
          winner: {
            winnerId: pid,
            completedLines: { ...state.completedLines },
          },
        };
      }
    }

    // Advance turn
    const currentIdx = state.playerIds.indexOf(playerId);
    state.currentTurn = state.playerIds[(currentIdx + 1) % state.playerIds.length];

    return { valid: true };
  }

  /** Get a player-specific view of the state */
  getPlayerView(state: BingoGameState, playerId: string): BingoPlayerView {
    const opponentId = state.playerIds.find((id) => id !== playerId) || null;

    // During setup, hide opponent's board; during play/finished, show it (numbers are crossed off)
    let opponentBoard = null;
    if (
      opponentId &&
      (state.phase === BingoGamePhase.PLAYING || state.phase === BingoGamePhase.FINISHED)
    ) {
      opponentBoard = state.boards[opponentId] || null;
    }

    return {
      board: state.boards[playerId] || [],
      opponentBoard,
      phase: state.phase,
      isSetupDone: state.setupDone.includes(playerId),
      opponentSetupDone: opponentId ? state.setupDone.includes(opponentId) : false,
      currentTurn: state.currentTurn,
      chosenNumbers: [...state.chosenNumbers],
      completedLines: { ...state.completedLines },
      players: state.playerIds,
      winnerId: state.winnerId,
    };
  }
}
