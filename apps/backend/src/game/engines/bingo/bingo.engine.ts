import {
  IGameEngine,
  BingoGameState,
  BingoMarkMove,
  BingoPlayerView,
  BingoWinResult,
  BingoWinPattern,
} from '@multiplayer-games/shared';
import {
  generateBoard,
  generateDrawPool,
  markNumberOnBoard,
  checkBoardWin,
} from './bingo.utils';

export class BingoEngine
  implements IGameEngine<BingoGameState, BingoMarkMove, BingoPlayerView, BingoWinResult>
{
  initGame(playerIds: string[]): BingoGameState {
    const boards: Record<string, ReturnType<typeof generateBoard>> = {};
    for (const id of playerIds) {
      boards[id] = generateBoard();
    }

    const drawPool = generateDrawPool();

    return {
      boards,
      calledNumbers: [],
      currentNumber: null,
      remainingNumbers: drawPool,
      playerIds: [...playerIds],
      winnerId: null,
      winPattern: null,
    };
  }

  processMove(
    state: BingoGameState,
    playerId: string,
    move: BingoMarkMove,
  ): BingoGameState {
    const board = state.boards[playerId];
    if (!board) return state;

    state.boards[playerId] = markNumberOnBoard(board, move.number);
    return state;
  }

  validateMove(
    state: BingoGameState,
    playerId: string,
    move: BingoMarkMove,
  ): { valid: boolean; reason?: string } {
    if (!state.boards[playerId]) {
      return { valid: false, reason: 'Player not in game' };
    }

    if (!state.calledNumbers.includes(move.number)) {
      return { valid: false, reason: 'Number has not been called' };
    }

    // Check the number exists on the player's board
    const board = state.boards[playerId];
    let found = false;
    for (const row of board) {
      for (const cell of row) {
        if (cell.value === move.number) {
          if (cell.marked) {
            return { valid: false, reason: 'Number already marked' };
          }
          found = true;
        }
      }
    }

    if (!found) {
      return { valid: false, reason: 'Number not on your board' };
    }

    return { valid: true };
  }

  checkWinner(state: BingoGameState): BingoWinResult | null {
    if (state.winnerId) {
      return {
        winnerId: state.winnerId,
        pattern: state.winPattern!,
        winningCells: [],
      };
    }
    return null;
  }

  /**
   * Anti-cheat: Verify a player's board actually has a winning pattern.
   * Called when a player claims "BINGO!"
   */
  validateClaim(
    state: BingoGameState,
    playerId: string,
  ): BingoWinResult | null {
    const board = state.boards[playerId];
    if (!board) return null;

    const result = checkBoardWin(board);
    if (!result) return null;

    return {
      winnerId: playerId,
      pattern: result.pattern,
      winningCells: result.winningCells,
    };
  }

  drawNumber(state: BingoGameState): { state: BingoGameState; number: number | null } {
    if (state.remainingNumbers.length === 0) {
      return { state, number: null };
    }

    const number = state.remainingNumbers.pop()!;
    state.calledNumbers.push(number);
    state.currentNumber = number;

    return { state, number };
  }

  getPlayerView(state: BingoGameState, playerId: string): BingoPlayerView {
    return {
      board: state.boards[playerId] || [],
      calledNumbers: [...state.calledNumbers],
      currentNumber: state.currentNumber,
      players: state.playerIds,
      winnerId: state.winnerId,
      winPattern: state.winPattern,
    };
  }
}
