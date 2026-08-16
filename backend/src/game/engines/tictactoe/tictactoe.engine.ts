import {
  TicTacToeAction,
  TicTacToeGameState,
  TicTacToeMark,
  TicTacToeMode,
  TicTacToePhase,
  TicTacToePlayerView,
  TicTacToeResult,
} from '../../../shared';

const BOARD_CELLS = 9;
const LIMITED_PIECES_PER_PLAYER = 3;
const MAX_LIMITED_PLIES = 100;
const WINNING_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

export class TicTacToeEngine {
  initGame(
    playerIds: string[],
    playerNames: Record<string, string>,
    mode: TicTacToeMode = TicTacToeMode.CLASSIC,
    botIds: string[] = [],
  ): TicTacToeGameState {
    if (playerIds.length !== 2 || new Set(playerIds).size !== 2) {
      throw new Error('Tic Tac Toe requires exactly two distinct players');
    }
    if (!Object.values(TicTacToeMode).includes(mode)) {
      throw new Error('Invalid Tic Tac Toe mode');
    }

    const players: TicTacToeGameState['players'] = [
      {
        id: playerIds[0],
        name: playerNames[playerIds[0]] || 'Player 1',
        mark: 'X',
        isBot: botIds.includes(playerIds[0]),
      },
      {
        id: playerIds[1],
        name: playerNames[playerIds[1]] || 'Player 2',
        mark: 'O',
        isBot: botIds.includes(playerIds[1]),
      },
    ];
    const state: TicTacToeGameState = {
      players,
      board: Array.from({ length: BOARD_CELLS }, () => null),
      currentTurnId: playerIds[0],
      mode,
      phase: TicTacToePhase.PLAYING,
      winnerId: null,
      winningLine: null,
      isDraw: false,
      plyCount: 0,
      positionCounts: {},
    };
    state.positionCounts[this.positionKey(state)] = 1;
    return state;
  }

  applyAction(
    state: TicTacToeGameState,
    playerId: string,
    action: TicTacToeAction,
  ): { valid: boolean; reason?: string; result?: TicTacToeResult } {
    if (state.phase !== TicTacToePhase.PLAYING) {
      return { valid: false, reason: 'Game already finished' };
    }
    if (state.currentTurnId !== playerId) {
      return { valid: false, reason: 'Not your turn' };
    }
    if (!this.isCellIndex(action?.to)) {
      return { valid: false, reason: 'Invalid destination' };
    }
    if (state.board[action.to] !== null) {
      return { valid: false, reason: 'Destination is occupied' };
    }

    const player = state.players.find((candidate) => candidate.id === playerId);
    if (!player) return { valid: false, reason: 'Player not found' };

    const placedCount = state.board.filter((cell) => cell === player.mark).length;
    const mustMovePiece =
      state.mode === TicTacToeMode.LIMITED &&
      placedCount >= LIMITED_PIECES_PER_PLAYER;

    if (mustMovePiece) {
      if (!this.isCellIndex(action.from) || state.board[action.from] !== player.mark) {
        return { valid: false, reason: 'Select one of your pieces to move' };
      }
      state.board[action.from] = null;
    } else if (action.from !== undefined) {
      return { valid: false, reason: 'Place a new piece on an empty cell' };
    }

    state.board[action.to] = player.mark;
    state.plyCount += 1;

    const winningLine = this.findWinningLine(state.board, player.mark);
    if (winningLine) {
      state.phase = TicTacToePhase.FINISHED;
      state.winnerId = player.id;
      state.winningLine = winningLine;
      return { valid: true, result: this.getResult(state) };
    }

    if (state.mode === TicTacToeMode.CLASSIC && state.board.every(Boolean)) {
      state.phase = TicTacToePhase.FINISHED;
      state.isDraw = true;
      return { valid: true, result: this.getResult(state) };
    }

    state.currentTurnId = state.players.find((candidate) => candidate.id !== playerId)!.id;

    if (state.mode === TicTacToeMode.LIMITED) {
      const key = this.positionKey(state);
      const repetitions = (state.positionCounts[key] ?? 0) + 1;
      state.positionCounts[key] = repetitions;
      if (repetitions >= 3 || state.plyCount >= MAX_LIMITED_PLIES) {
        state.phase = TicTacToePhase.FINISHED;
        state.isDraw = true;
        return { valid: true, result: this.getResult(state) };
      }
    }

    return { valid: true };
  }

  getPlayerView(state: TicTacToeGameState, playerId: string): TicTacToePlayerView {
    const player = state.players.find((candidate) => candidate.id === playerId);
    const placedCount = player
      ? state.board.filter((cell) => cell === player.mark).length
      : 0;
    return {
      players: state.players.map((candidate) => ({ ...candidate })) as TicTacToeGameState['players'],
      board: [...state.board],
      currentTurnId: state.currentTurnId,
      mode: state.mode,
      phase: state.phase,
      winnerId: state.winnerId,
      winningLine: state.winningLine ? [...state.winningLine] : null,
      isDraw: state.isDraw,
      youId: playerId,
      yourMark: player?.mark ?? null,
      canAct: state.phase === TicTacToePhase.PLAYING && state.currentTurnId === playerId,
      mustMovePiece:
        !!player &&
        state.mode === TicTacToeMode.LIMITED &&
        placedCount >= LIMITED_PIECES_PER_PLAYER,
    };
  }

  surrender(
    state: TicTacToeGameState,
    playerId: string,
  ): { valid: boolean; reason?: string; result?: TicTacToeResult } {
    if (state.phase !== TicTacToePhase.PLAYING) {
      return { valid: false, reason: 'Game already finished' };
    }
    const player = state.players.find((candidate) => candidate.id === playerId);
    if (!player) return { valid: false, reason: 'Player not found' };

    state.phase = TicTacToePhase.FINISHED;
    state.winnerId = state.players.find((candidate) => candidate.id !== playerId)!.id;
    state.winningLine = null;
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: TicTacToeGameState): TicTacToeResult {
    const winner = state.players.find((player) => player.id === state.winnerId);
    return {
      winnerId: state.winnerId,
      winnerName: winner?.name ?? null,
      isDraw: state.isDraw,
      winningLine: state.winningLine ? [...state.winningLine] : null,
    };
  }

  private findWinningLine(board: TicTacToeGameState['board'], mark: TicTacToeMark): number[] | null {
    const line = WINNING_LINES.find((indices) => indices.every((index) => board[index] === mark));
    return line ? [...line] : null;
  }

  private positionKey(state: TicTacToeGameState): string {
    return `${state.board.map((cell) => cell ?? '-').join('')}:${state.currentTurnId}`;
  }

  private isCellIndex(value: unknown): value is number {
    return Number.isInteger(value) && (value as number) >= 0 && (value as number) < BOARD_CELLS;
  }
}