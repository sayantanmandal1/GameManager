import type { HexAction, HexGameState, HexPlayerView, HexResult, HexStone } from '../../../shared';
import { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';
import { hasExactActionShape, isBoundedInteger } from '../action-shape';

const BOARD_SIZE = 11;
const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

export class HexEngine implements DistinctGameAdapter<HexGameState, HexAction, HexPlayerView, HexResult> {
  readonly key = 'hex' as const;
  readonly rulesetId = 'hex.standard-11x11.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 2;

  initGame(playerIds: string[], playerNames: Record<string, string>): HexGameState {
    this.requirePlayers(playerIds);
    return {
      players: playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}` })) as HexGameState['players'],
      board: new Array<HexStone | null>(CELL_COUNT).fill(null),
      currentTurnId: playerIds[0],
      phase: 'playing',
      winnerId: null,
      isDraw: false,
      finishReason: null,
    };
  }

  applyAction(state: HexGameState, playerId: string, action: HexAction): DistinctActionResult<HexResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    if (!hasExactActionShape(action, 'place_hex', ['cell']) || !isBoundedInteger(action.cell, 0, CELL_COUNT - 1)) {
      return { valid: false, reason: 'Invalid placement' };
    }
    if (state.board[action.cell] !== null) return { valid: false, reason: 'Cell is occupied' };

    const playerIndex = state.players.findIndex((player) => player.id === playerId);
    const stone: HexStone = playerIndex === 0 ? 'vertical' : 'horizontal';
    state.board[action.cell] = stone;
    if (this.hasConnection(state.board, stone)) {
      state.phase = 'finished';
      state.winnerId = playerId;
      state.finishReason = 'connection';
      return { valid: true, result: this.getResult(state) };
    }
    state.currentTurnId = state.players[1 - playerIndex].id;
    return { valid: true };
  }

  getPlayerView(state: HexGameState, playerId: string): HexPlayerView {
    const playerIndex = state.players.findIndex((player) => player.id === playerId);
    const yourStone: HexStone = playerIndex === 0 ? 'vertical' : 'horizontal';
    return {
      gameKey: this.key,
      players: state.players.map((player, index) => ({ ...player, stone: index === 0 ? 'vertical' : 'horizontal' })),
      youId: playerId,
      yourStone,
      board: [...state.board],
      currentTurnId: state.currentTurnId,
      phase: state.phase,
      winnerId: state.winnerId,
      canAct: state.phase === 'playing' && state.currentTurnId === playerId,
      legalCells: state.phase === 'playing' && state.currentTurnId === playerId
        ? state.board.flatMap((cell, index) => cell === null ? [index] : [])
        : [],
    };
  }

  surrender(state: HexGameState, playerId: string): DistinctActionResult<HexResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    const playerIndex = state.players.findIndex((player) => player.id === playerId);
    if (playerIndex < 0) return { valid: false, reason: 'Player not found' };
    state.phase = 'finished';
    state.winnerId = state.players[1 - playerIndex].id;
    state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: HexGameState): HexResult {
    if (!state.finishReason || !state.winnerId) throw new Error('Hex game is not finished');
    return { gameKey: this.key, winnerId: state.winnerId, isDraw: false, reason: state.finishReason };
  }

  private hasConnection(board: Array<HexStone | null>, stone: HexStone): boolean {
    const frontier = board.flatMap((value, cell) => value === stone && this.isStartEdge(cell, stone) ? [cell] : []);
    const visited = new Set(frontier);
    while (frontier.length > 0) {
      const cell = frontier.shift()!;
      if (this.isGoalEdge(cell, stone)) return true;
      for (const next of this.neighbors(cell)) {
        if (visited.has(next) || board[next] !== stone) continue;
        visited.add(next);
        frontier.push(next);
      }
    }
    return false;
  }

  private isStartEdge(cell: number, stone: HexStone): boolean {
    return stone === 'vertical' ? Math.floor(cell / BOARD_SIZE) === 0 : cell % BOARD_SIZE === 0;
  }

  private isGoalEdge(cell: number, stone: HexStone): boolean {
    return stone === 'vertical' ? Math.floor(cell / BOARD_SIZE) === BOARD_SIZE - 1 : cell % BOARD_SIZE === BOARD_SIZE - 1;
  }

  private neighbors(cell: number): number[] {
    const row = Math.floor(cell / BOARD_SIZE);
    const column = cell % BOARD_SIZE;
    return [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0]].flatMap(([rowOffset, columnOffset]) => {
      const nextRow = row + rowOffset;
      const nextColumn = column + columnOffset;
      return nextRow >= 0 && nextRow < BOARD_SIZE && nextColumn >= 0 && nextColumn < BOARD_SIZE
        ? [nextRow * BOARD_SIZE + nextColumn]
        : [];
    });
  }

  private requirePlayers(playerIds: string[]): void {
    if (playerIds.length !== 2 || new Set(playerIds).size !== 2) throw new Error('Hex requires exactly two distinct players');
  }
}