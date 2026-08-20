import {
  CheckersAction,
  CheckersGameState,
  CheckersMoveOption,
  CheckersPlayerView,
  CheckersResult,
} from '../../../shared';
import {
  DistinctActionResult,
  DistinctGameAdapter,
  DistinctGamePhase,
} from '../distinct-game.adapter';

const BOARD_SIZE = 8;
const BOARD_CELLS = BOARD_SIZE * BOARD_SIZE;

export class CheckersEngine
  implements
    DistinctGameAdapter<
      CheckersGameState,
      CheckersAction,
      CheckersPlayerView,
      CheckersResult
    >
{
  readonly key = 'checkers' as const;
  readonly rulesetId = 'checkers.english-draughts.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 2;

  initGame(
    playerIds: string[],
    playerNames: Record<string, string>,
  ): CheckersGameState {
    if (playerIds.length !== 2 || new Set(playerIds).size !== 2) {
      throw new Error('Checkers requires exactly two distinct players');
    }

    const board: CheckersGameState['board'] = Array.from(
      { length: BOARD_CELLS },
      () => null,
    );
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let column = 0; column < BOARD_SIZE; column += 1) {
        if (!this.isDarkSquare(row, column)) continue;
        if (row < 3) board[this.index(row, column)] = { playerId: playerIds[1], king: false };
        if (row > 4) board[this.index(row, column)] = { playerId: playerIds[0], king: false };
      }
    }

    return {
      players: [
        {
          id: playerIds[0],
          name: playerNames[playerIds[0]] || 'Player 1',
          color: 'red',
        },
        {
          id: playerIds[1],
          name: playerNames[playerIds[1]] || 'Player 2',
          color: 'black',
        },
      ],
      board,
      currentTurnId: playerIds[0],
      mustContinueFrom: null,
      phase: DistinctGamePhase.PLAYING,
      winnerId: null,
      isDraw: false,
      finishReason: null,
    };
  }

  applyAction(
    state: CheckersGameState,
    playerId: string,
    action: CheckersAction,
  ): DistinctActionResult<CheckersResult> {
    if (state.phase !== DistinctGamePhase.PLAYING) {
      return { valid: false, reason: 'Game already finished' };
    }
    if (state.currentTurnId !== playerId) {
      return { valid: false, reason: 'Not your turn' };
    }
    if (!this.isCell(action?.from) || !this.isCell(action?.to)) {
      return { valid: false, reason: 'Invalid square' };
    }
    if (state.mustContinueFrom !== null && action.from !== state.mustContinueFrom) {
      return { valid: false, reason: 'Continue the capture with the same piece' };
    }

    const piece = state.board[action.from];
    if (!piece || piece.playerId !== playerId) {
      return { valid: false, reason: 'Select one of your pieces' };
    }
    if (state.board[action.to]) {
      return { valid: false, reason: 'Destination is occupied' };
    }

    const mandatoryCapture = this.getCaptures(state, playerId).length > 0;
    const legalMove = this.getMovesForPiece(
      state,
      action.from,
      mandatoryCapture || state.mustContinueFrom !== null,
    ).find((move) => move.to === action.to);
    if (!legalMove) {
      return {
        valid: false,
        reason: mandatoryCapture ? 'Capture is mandatory' : 'Illegal move',
      };
    }

    // SECURITY_NOTE: capture targets and promotion are derived from the
    // authoritative board; clients cannot name a piece to remove or crown.
    state.board[action.to] = piece;
    state.board[action.from] = null;
    if (legalMove.capture !== null) state.board[legalMove.capture] = null;

    const destinationRow = Math.floor(action.to / BOARD_SIZE);
    const player = state.players.find((candidate) => candidate.id === playerId)!;
    const promoted =
      !piece.king &&
      ((player.color === 'red' && destinationRow === 0) ||
        (player.color === 'black' && destinationRow === BOARD_SIZE - 1));
    if (promoted) piece.king = true;

    if (legalMove.capture !== null && !promoted) {
      const continuations = this.getMovesForPiece(state, action.to, true);
      if (continuations.length > 0) {
        state.mustContinueFrom = action.to;
        return { valid: true };
      }
    }

    state.mustContinueFrom = null;
    const opponent = state.players.find((candidate) => candidate.id !== playerId)!;
    const remaining = this.countPieces(state, opponent.id);
    if (remaining === 0) return this.finish(state, playerId, 'no_pieces');
    if (this.getLegalMoves(state, opponent.id).length === 0) {
      return this.finish(state, playerId, 'no_legal_moves');
    }

    state.currentTurnId = opponent.id;
    return { valid: true };
  }

  getPlayerView(
    state: CheckersGameState,
    playerId: string,
  ): CheckersPlayerView {
    const player = state.players.find((candidate) => candidate.id === playerId);
    const canAct =
      state.phase === DistinctGamePhase.PLAYING &&
      state.currentTurnId === playerId &&
      !!player;
    const legalMoves = canAct ? this.getLegalMoves(state, playerId) : [];

    return {
      players: state.players.map((candidate) => ({ ...candidate })) as [
        CheckersGameState['players'][0],
        CheckersGameState['players'][1],
      ],
      board: state.board.map((piece) => (piece ? { ...piece } : null)),
      currentTurnId: state.currentTurnId,
      mustContinueFrom: state.mustContinueFrom,
      phase: state.phase,
      winnerId: state.winnerId,
      isDraw: false,
      youId: playerId,
      yourColor: player?.color ?? null,
      canAct,
      mandatoryCapture: canAct && legalMoves.some((move) => move.capture !== null),
      legalMoves: legalMoves.map((move) => ({ ...move })),
    };
  }

  surrender(
    state: CheckersGameState,
    playerId: string,
  ): DistinctActionResult<CheckersResult> {
    if (state.phase !== DistinctGamePhase.PLAYING) {
      return { valid: false, reason: 'Game already finished' };
    }
    if (!state.players.some((candidate) => candidate.id === playerId)) {
      return { valid: false, reason: 'Player not found' };
    }
    const winner = state.players.find((candidate) => candidate.id !== playerId)!;
    return this.finish(state, winner.id, 'surrender');
  }

  getResult(state: CheckersGameState): CheckersResult {
    if (!state.finishReason || !state.winnerId) {
      throw new Error('Checkers game is not finished');
    }
    return {
      winnerId: state.winnerId,
      isDraw: false,
      reason: state.finishReason,
      remainingPieces: Object.fromEntries(
        state.players.map((player) => [player.id, this.countPieces(state, player.id)]),
      ),
    };
  }

  private finish(
    state: CheckersGameState,
    winnerId: string,
    reason: CheckersResult['reason'],
  ): DistinctActionResult<CheckersResult> {
    state.phase = DistinctGamePhase.FINISHED;
    state.winnerId = winnerId;
    state.finishReason = reason;
    state.mustContinueFrom = null;
    return { valid: true, result: this.getResult(state) };
  }

  private getLegalMoves(state: CheckersGameState, playerId: string): CheckersMoveOption[] {
    if (state.mustContinueFrom !== null && state.currentTurnId === playerId) {
      return this.getMovesForPiece(state, state.mustContinueFrom, true);
    }
    const captures = this.getCaptures(state, playerId);
    if (captures.length > 0) return captures;

    return state.board.flatMap((piece, cell) =>
      piece?.playerId === playerId ? this.getMovesForPiece(state, cell, false) : [],
    );
  }

  private getCaptures(state: CheckersGameState, playerId: string): CheckersMoveOption[] {
    return state.board.flatMap((piece, cell) =>
      piece?.playerId === playerId ? this.getMovesForPiece(state, cell, true) : [],
    );
  }

  private getMovesForPiece(
    state: CheckersGameState,
    from: number,
    capturesOnly: boolean,
  ): CheckersMoveOption[] {
    const piece = state.board[from];
    if (!piece) return [];

    const player = state.players.find((candidate) => candidate.id === piece.playerId)!;
    const row = Math.floor(from / BOARD_SIZE);
    const column = from % BOARD_SIZE;
    const rowDirections = piece.king ? [-1, 1] : [player.color === 'red' ? -1 : 1];
    const moves: CheckersMoveOption[] = [];

    for (const rowDirection of rowDirections) {
      for (const columnDirection of [-1, 1]) {
        if (!capturesOnly) {
          const toRow = row + rowDirection;
          const toColumn = column + columnDirection;
          if (
            this.isCoordinate(toRow) &&
            this.isCoordinate(toColumn) &&
            !state.board[this.index(toRow, toColumn)]
          ) {
            moves.push({ from, to: this.index(toRow, toColumn), capture: null });
          }
        }

        const jumpedRow = row + rowDirection;
        const jumpedColumn = column + columnDirection;
        const toRow = row + rowDirection * 2;
        const toColumn = column + columnDirection * 2;
        if (!this.isCoordinate(toRow) || !this.isCoordinate(toColumn)) continue;
        const jumpedCell = this.index(jumpedRow, jumpedColumn);
        const jumpedPiece = state.board[jumpedCell];
        const to = this.index(toRow, toColumn);
        if (jumpedPiece && jumpedPiece.playerId !== piece.playerId && !state.board[to]) {
          moves.push({ from, to, capture: jumpedCell });
        }
      }
    }

    return capturesOnly ? moves.filter((move) => move.capture !== null) : moves;
  }

  private countPieces(state: CheckersGameState, playerId: string): number {
    return state.board.filter((piece) => piece?.playerId === playerId).length;
  }

  private index(row: number, column: number): number {
    return row * BOARD_SIZE + column;
  }

  private isDarkSquare(row: number, column: number): boolean {
    return (row + column) % 2 === 1;
  }

  private isCoordinate(value: number): boolean {
    return value >= 0 && value < BOARD_SIZE;
  }

  private isCell(value: unknown): value is number {
    return Number.isInteger(value) && (value as number) >= 0 && (value as number) < BOARD_CELLS;
  }
}