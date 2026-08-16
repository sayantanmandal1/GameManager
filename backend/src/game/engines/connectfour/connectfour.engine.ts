import {
  CONNECT_FOUR_COLUMNS,
  CONNECT_FOUR_ROWS,
  ConnectFourDisc,
  ConnectFourGameState,
  ConnectFourPhase,
  ConnectFourPlayerView,
  ConnectFourResult,
} from '../../../shared';

export class ConnectFourEngine {
  initGame(
    playerIds: string[],
    playerNames: Record<string, string>,
    botIds: string[] = [],
  ): ConnectFourGameState {
    if (playerIds.length !== 2 || new Set(playerIds).size !== 2) {
      throw new Error('Connect Four requires exactly two distinct players');
    }
    return {
      players: [
        {
          id: playerIds[0],
          name: playerNames[playerIds[0]] || 'Player 1',
          disc: 'red',
          isBot: botIds.includes(playerIds[0]),
        },
        {
          id: playerIds[1],
          name: playerNames[playerIds[1]] || 'Player 2',
          disc: 'yellow',
          isBot: botIds.includes(playerIds[1]),
        },
      ],
      board: Array.from({ length: CONNECT_FOUR_ROWS * CONNECT_FOUR_COLUMNS }, () => null),
      currentTurnId: playerIds[0],
      phase: ConnectFourPhase.PLAYING,
      winnerId: null,
      winningCells: null,
      isDraw: false,
      lastMove: null,
    };
  }

  drop(
    state: ConnectFourGameState,
    playerId: string,
    column: number,
  ): { valid: boolean; reason?: string; result?: ConnectFourResult } {
    if (state.phase !== ConnectFourPhase.PLAYING) {
      return { valid: false, reason: 'Game already finished' };
    }
    if (state.currentTurnId !== playerId) {
      return { valid: false, reason: 'Not your turn' };
    }
    if (!Number.isInteger(column) || column < 0 || column >= CONNECT_FOUR_COLUMNS) {
      return { valid: false, reason: 'Invalid column' };
    }
    const row = this.findOpenRow(state.board, column);
    if (row < 0) return { valid: false, reason: 'Column is full' };
    const player = state.players.find((candidate) => candidate.id === playerId);
    if (!player) return { valid: false, reason: 'Player not found' };

    state.board[this.index(row, column)] = player.disc;
    state.lastMove = { row, column, playerId };
    const winningCells = this.findWinningCells(state.board, row, column, player.disc);
    if (winningCells) {
      state.phase = ConnectFourPhase.FINISHED;
      state.winnerId = playerId;
      state.winningCells = winningCells;
      return { valid: true, result: this.getResult(state) };
    }
    if (state.board.every(Boolean)) {
      state.phase = ConnectFourPhase.FINISHED;
      state.isDraw = true;
      return { valid: true, result: this.getResult(state) };
    }
    state.currentTurnId = state.players.find((candidate) => candidate.id !== playerId)!.id;
    return { valid: true };
  }

  surrender(
    state: ConnectFourGameState,
    playerId: string,
  ): { valid: boolean; reason?: string; result?: ConnectFourResult } {
    if (state.phase !== ConnectFourPhase.PLAYING) {
      return { valid: false, reason: 'Game already finished' };
    }
    if (!state.players.some((player) => player.id === playerId)) {
      return { valid: false, reason: 'Player not found' };
    }
    state.phase = ConnectFourPhase.FINISHED;
    state.winnerId = state.players.find((player) => player.id !== playerId)!.id;
    return { valid: true, result: this.getResult(state) };
  }

  getPlayerView(state: ConnectFourGameState, playerId: string): ConnectFourPlayerView {
    const player = state.players.find((candidate) => candidate.id === playerId);
    return {
      players: state.players.map((candidate) => ({ ...candidate })) as ConnectFourGameState['players'],
      board: [...state.board],
      currentTurnId: state.currentTurnId,
      phase: state.phase,
      winnerId: state.winnerId,
      winningCells: state.winningCells ? [...state.winningCells] : null,
      isDraw: state.isDraw,
      lastMove: state.lastMove ? { ...state.lastMove } : null,
      youId: playerId,
      yourDisc: player?.disc ?? null,
      canAct: state.phase === ConnectFourPhase.PLAYING && state.currentTurnId === playerId,
      validColumns: this.validColumns(state.board),
    };
  }

  getResult(state: ConnectFourGameState): ConnectFourResult {
    const winner = state.players.find((player) => player.id === state.winnerId);
    return {
      winnerId: state.winnerId,
      winnerName: winner?.name ?? null,
      isDraw: state.isDraw,
      winningCells: state.winningCells ? [...state.winningCells] : null,
    };
  }

  private validColumns(board: ConnectFourGameState['board']): number[] {
    return Array.from({ length: CONNECT_FOUR_COLUMNS }, (_, column) => column)
      .filter((column) => board[this.index(0, column)] === null);
  }

  private findOpenRow(board: ConnectFourGameState['board'], column: number): number {
    for (let row = CONNECT_FOUR_ROWS - 1; row >= 0; row -= 1) {
      if (board[this.index(row, column)] === null) return row;
    }
    return -1;
  }

  private findWinningCells(
    board: ConnectFourGameState['board'],
    row: number,
    column: number,
    disc: ConnectFourDisc,
  ): number[] | null {
    for (const [rowStep, columnStep] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const cells = [this.index(row, column)];
      for (const direction of [-1, 1]) {
        let nextRow = row + rowStep * direction;
        let nextColumn = column + columnStep * direction;
        while (
          nextRow >= 0 &&
          nextRow < CONNECT_FOUR_ROWS &&
          nextColumn >= 0 &&
          nextColumn < CONNECT_FOUR_COLUMNS &&
          board[this.index(nextRow, nextColumn)] === disc
        ) {
          cells.push(this.index(nextRow, nextColumn));
          nextRow += rowStep * direction;
          nextColumn += columnStep * direction;
        }
      }
      if (cells.length >= 4) return cells.sort((a, b) => a - b);
    }
    return null;
  }

  private index(row: number, column: number): number {
    return row * CONNECT_FOUR_COLUMNS + column;
  }
}