import {
  ReversiAction,
  ReversiDisc,
  ReversiGameState,
  ReversiPlayerView,
  ReversiResult,
} from '../../../shared';
import {
  DistinctActionResult,
  DistinctGameAdapter,
  DistinctGamePhase,
} from '../distinct-game.adapter';

const BOARD_SIZE = 8;
const BOARD_CELLS = BOARD_SIZE * BOARD_SIZE;
const DIRECTIONS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
] as const;

export class ReversiEngine
  implements
    DistinctGameAdapter<
      ReversiGameState,
      ReversiAction,
      ReversiPlayerView,
      ReversiResult
    >
{
  readonly key = 'reversi' as const;
  readonly rulesetId = 'reversi.standard.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 2;

  initGame(
    playerIds: string[],
    playerNames: Record<string, string>,
  ): ReversiGameState {
    if (playerIds.length !== 2 || new Set(playerIds).size !== 2) {
      throw new Error('Reversi requires exactly two distinct players');
    }

    const board: ReversiGameState['board'] = Array.from(
      { length: BOARD_CELLS },
      () => null,
    );
    board[this.index(3, 3)] = 'white';
    board[this.index(3, 4)] = 'black';
    board[this.index(4, 3)] = 'black';
    board[this.index(4, 4)] = 'white';

    return {
      players: [
        {
          id: playerIds[0],
          name: playerNames[playerIds[0]] || 'Player 1',
          disc: 'black',
        },
        {
          id: playerIds[1],
          name: playerNames[playerIds[1]] || 'Player 2',
          disc: 'white',
        },
      ],
      board,
      currentTurnId: playerIds[0],
      phase: DistinctGamePhase.PLAYING,
      winnerId: null,
      isDraw: false,
      consecutivePasses: 0,
      finishReason: null,
    };
  }

  applyAction(
    state: ReversiGameState,
    playerId: string,
    action: ReversiAction,
  ): DistinctActionResult<ReversiResult> {
    if (state.phase !== DistinctGamePhase.PLAYING) {
      return { valid: false, reason: 'Game already finished' };
    }
    if (state.currentTurnId !== playerId) {
      return { valid: false, reason: 'Not your turn' };
    }
    if (!this.isCell(action?.cell)) {
      return { valid: false, reason: 'Invalid cell' };
    }

    const player = state.players.find((candidate) => candidate.id === playerId);
    if (!player) return { valid: false, reason: 'Player not found' };

    const flips = this.getFlips(state.board, action.cell, player.disc);
    if (flips.length === 0) {
      return { valid: false, reason: 'Move must bracket opponent discs' };
    }

    // SECURITY_NOTE: the server derives every flipped disc from the board; the
    // client supplies only a bounded destination cell.
    state.board[action.cell] = player.disc;
    flips.forEach((cell) => {
      state.board[cell] = player.disc;
    });

    if (state.board.every((cell) => cell !== null)) {
      return this.finish(state, 'board_complete');
    }

    const opponent = state.players.find((candidate) => candidate.id !== playerId)!;
    if (this.getLegalMoves(state.board, opponent.disc).length > 0) {
      state.currentTurnId = opponent.id;
      state.consecutivePasses = 0;
      return { valid: true };
    }

    if (this.getLegalMoves(state.board, player.disc).length > 0) {
      state.currentTurnId = player.id;
      state.consecutivePasses = 1;
      return { valid: true };
    }

    return this.finish(state, 'no_moves');
  }

  getPlayerView(
    state: ReversiGameState,
    playerId: string,
  ): ReversiPlayerView {
    const player = state.players.find((candidate) => candidate.id === playerId);
    const canAct =
      state.phase === DistinctGamePhase.PLAYING &&
      state.currentTurnId === playerId &&
      !!player;

    return {
      players: state.players.map((candidate) => ({ ...candidate })) as [
        ReversiGameState['players'][0],
        ReversiGameState['players'][1],
      ],
      board: [...state.board],
      currentTurnId: state.currentTurnId,
      phase: state.phase,
      winnerId: state.winnerId,
      isDraw: state.isDraw,
      consecutivePasses: state.consecutivePasses,
      youId: playerId,
      yourDisc: player?.disc ?? null,
      canAct,
      legalMoves: canAct ? this.getLegalMoves(state.board, player.disc) : [],
      scores: this.countDiscs(state.board),
    };
  }

  surrender(
    state: ReversiGameState,
    playerId: string,
  ): DistinctActionResult<ReversiResult> {
    if (state.phase !== DistinctGamePhase.PLAYING) {
      return { valid: false, reason: 'Game already finished' };
    }
    const player = state.players.find((candidate) => candidate.id === playerId);
    if (!player) return { valid: false, reason: 'Player not found' };

    state.phase = DistinctGamePhase.FINISHED;
    state.winnerId = state.players.find(
      (candidate) => candidate.id !== playerId,
    )!.id;
    state.isDraw = false;
    state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: ReversiGameState): ReversiResult {
    if (!state.finishReason) throw new Error('Reversi game is not finished');
    return {
      winnerId: state.winnerId,
      isDraw: state.isDraw,
      reason: state.finishReason,
      scores: this.countDiscs(state.board),
    };
  }

  private finish(
    state: ReversiGameState,
    reason: 'board_complete' | 'no_moves',
  ): DistinctActionResult<ReversiResult> {
    const scores = this.countDiscs(state.board);
    state.phase = DistinctGamePhase.FINISHED;
    state.finishReason = reason;
    state.isDraw = scores.black === scores.white;
    state.winnerId = state.isDraw
      ? null
      : state.players.find(
          (player) =>
            player.disc === (scores.black > scores.white ? 'black' : 'white'),
        )!.id;
    return { valid: true, result: this.getResult(state) };
  }

  private getLegalMoves(
    board: ReversiGameState['board'],
    disc: ReversiDisc,
  ): number[] {
    const moves: number[] = [];
    for (let cell = 0; cell < BOARD_CELLS; cell += 1) {
      if (this.getFlips(board, cell, disc).length > 0) moves.push(cell);
    }
    return moves;
  }

  private getFlips(
    board: ReversiGameState['board'],
    cell: number,
    disc: ReversiDisc,
  ): number[] {
    if (board[cell] !== null) return [];

    const row = Math.floor(cell / BOARD_SIZE);
    const column = cell % BOARD_SIZE;
    const opponent: ReversiDisc = disc === 'black' ? 'white' : 'black';
    const flips: number[] = [];

    for (const [rowDelta, columnDelta] of DIRECTIONS) {
      const line: number[] = [];
      let nextRow = row + rowDelta;
      let nextColumn = column + columnDelta;
      while (
        this.isCoordinate(nextRow) &&
        this.isCoordinate(nextColumn) &&
        board[this.index(nextRow, nextColumn)] === opponent
      ) {
        line.push(this.index(nextRow, nextColumn));
        nextRow += rowDelta;
        nextColumn += columnDelta;
      }
      if (
        line.length > 0 &&
        this.isCoordinate(nextRow) &&
        this.isCoordinate(nextColumn) &&
        board[this.index(nextRow, nextColumn)] === disc
      ) {
        flips.push(...line);
      }
    }

    return flips;
  }

  private countDiscs(
    board: ReversiGameState['board'],
  ): Record<ReversiDisc, number> {
    return board.reduce(
      (scores, cell) => {
        if (cell) scores[cell] += 1;
        return scores;
      },
      { black: 0, white: 0 },
    );
  }

  private index(row: number, column: number): number {
    return row * BOARD_SIZE + column;
  }

  private isCoordinate(value: number): boolean {
    return value >= 0 && value < BOARD_SIZE;
  }

  private isCell(value: unknown): value is number {
    return Number.isInteger(value) && (value as number) >= 0 && (value as number) < BOARD_CELLS;
  }
}