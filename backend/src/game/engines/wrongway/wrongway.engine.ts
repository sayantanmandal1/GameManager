import type {
  WrongwayAction,
  WrongwayGameState,
  WrongwayPlayer,
  WrongwayPlayerView,
  WrongwayResult,
  WrongwayWall,
  WrongwayWallOrientation,
} from '../../../shared';
import { DistinctActionResult, DistinctGameAdapter, DistinctGamePhase } from '../distinct-game.adapter';
import { hasExactActionShape, isBoundedInteger } from '../action-shape';

const BOARD_SIZE = 9;
const BOARD_CELLS = BOARD_SIZE * BOARD_SIZE;
const WALL_ANCHOR_MAX = BOARD_SIZE - 2;
const START_WALLS = 10;
const ORTHOGONAL_DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

type Cell = { row: number; column: number };

export class WrongwayEngine
  implements DistinctGameAdapter<WrongwayGameState, WrongwayAction, WrongwayPlayerView, WrongwayResult, 'wrongway'>
{
  readonly key = 'wrongway' as const;
  readonly rulesetId = 'wrongway.distinct-9x9.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 2;

  initGame(playerIds: string[], playerNames: Record<string, string>): WrongwayGameState {
    if (playerIds.length !== 2 || new Set(playerIds).size !== 2) {
      throw new Error('Wrongway requires exactly two distinct players');
    }

    return {
      gameKey: this.key,
      players: [
        {
          id: playerIds[0],
          name: playerNames[playerIds[0]] || 'Player 1',
          color: 'red',
          position: { row: 8, column: 4 },
          goalRow: 0,
          wallsRemaining: START_WALLS,
        },
        {
          id: playerIds[1],
          name: playerNames[playerIds[1]] || 'Player 2',
          color: 'blue',
          position: { row: 0, column: 4 },
          goalRow: 8,
          wallsRemaining: START_WALLS,
        },
      ],
      walls: [],
      currentTurnId: playerIds[0],
      phase: DistinctGamePhase.PLAYING,
      winnerId: null,
      isDraw: false,
      finishReason: null,
    };
  }

  applyAction(state: WrongwayGameState, playerId: string, action: WrongwayAction): DistinctActionResult<WrongwayResult> {
    if (state.phase !== DistinctGamePhase.PLAYING) {
      return { valid: false, reason: 'Game already finished' };
    }
    if (state.currentTurnId !== playerId) {
      return { valid: false, reason: 'Not your turn' };
    }

    const player = this.getPlayer(state, playerId);
    if (!player) return { valid: false, reason: 'Player not found' };

    if (hasExactActionShape(action, 'wrongway_move', ['cell']) && isBoundedInteger(action.cell, 0, BOARD_CELLS - 1)) {
      return this.applyMove(state, player, action.cell);
    }

    if (
      hasExactActionShape(action, 'wrongway_place_wall', ['row', 'column', 'orientation'])
      && isBoundedInteger(action.row, 0, WALL_ANCHOR_MAX)
      && isBoundedInteger(action.column, 0, WALL_ANCHOR_MAX)
      && (action.orientation === 'horizontal' || action.orientation === 'vertical')
    ) {
      return this.applyWallPlacement(state, player, {
        row: action.row,
        column: action.column,
        orientation: action.orientation,
      });
    }

    return { valid: false, reason: 'Invalid action payload' };
  }

  getPlayerView(state: WrongwayGameState, playerId: string): WrongwayPlayerView {
    const canAct = state.phase === DistinctGamePhase.PLAYING && state.currentTurnId === playerId;
    const player = this.getPlayer(state, playerId);

    return {
      gameKey: this.key,
      players: state.players.map((candidate) => ({
        ...candidate,
        position: { ...candidate.position },
      })) as [WrongwayGameState['players'][0], WrongwayGameState['players'][1]],
      walls: state.walls.map((wall) => ({ ...wall })),
      currentTurnId: state.currentTurnId,
      phase: state.phase,
      winnerId: state.winnerId,
      canAct,
      legalMoves: canAct && player ? this.getLegalMoves(state, player).map((cell) => this.toIndex(cell.row, cell.column)) : [],
      legalWallPlacements: canAct && player
        ? this.getLegalWallPlacements(state, player)
        : [],
    };
  }

  surrender(state: WrongwayGameState, playerId: string): DistinctActionResult<WrongwayResult> {
    if (state.phase !== DistinctGamePhase.PLAYING) {
      return { valid: false, reason: 'Game already finished' };
    }
    const player = this.getPlayer(state, playerId);
    if (!player) return { valid: false, reason: 'Player not found' };

    const winner = state.players.find((candidate) => candidate.id !== playerId);
    if (!winner) return { valid: false, reason: 'Player not found' };

    state.phase = DistinctGamePhase.FINISHED;
    state.winnerId = winner.id;
    state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: WrongwayGameState): WrongwayResult {
    if (!state.finishReason || !state.winnerId) {
      throw new Error('Wrongway game is not finished');
    }
    return {
      gameKey: this.key,
      winnerId: state.winnerId,
      isDraw: false,
      reason: state.finishReason,
    };
  }

  private applyMove(state: WrongwayGameState, player: WrongwayPlayer, targetCell: number): DistinctActionResult<WrongwayResult> {
    const legalMoves = this.getLegalMoves(state, player);
    const target = this.toCell(targetCell);
    if (!legalMoves.some((candidate) => candidate.row === target.row && candidate.column === target.column)) {
      return { valid: false, reason: 'Illegal move' };
    }

    player.position = target;
    if (player.position.row === player.goalRow) {
      state.phase = DistinctGamePhase.FINISHED;
      state.winnerId = player.id;
      state.finishReason = 'goal';
      return { valid: true, result: this.getResult(state) };
    }

    state.currentTurnId = this.getOpponent(state, player.id).id;
    return { valid: true };
  }

  private applyWallPlacement(
    state: WrongwayGameState,
    player: WrongwayPlayer,
    wall: WrongwayWall,
  ): DistinctActionResult<WrongwayResult> {
    if (player.wallsRemaining <= 0) {
      return { valid: false, reason: 'No walls remaining' };
    }
    if (!this.canPlaceWall(state, wall)) {
      return { valid: false, reason: 'Illegal wall placement' };
    }

    state.walls.push({ ...wall, ownerId: player.id, color: player.color });
    player.wallsRemaining -= 1;
    state.currentTurnId = this.getOpponent(state, player.id).id;
    return { valid: true };
  }

  private getLegalMoves(state: WrongwayGameState, player: WrongwayPlayer): Cell[] {
    const opponent = this.getOpponent(state, player.id);
    const moves: Cell[] = [];

    for (const [rowDelta, columnDelta] of ORTHOGONAL_DIRECTIONS) {
      const adjacent = {
        row: player.position.row + rowDelta,
        column: player.position.column + columnDelta,
      };
      if (!this.isInBounds(adjacent.row, adjacent.column)) continue;
      if (this.isEdgeBlocked(state.walls, player.position, adjacent)) continue;

      const adjacentIsOpponent =
        adjacent.row === opponent.position.row && adjacent.column === opponent.position.column;
      if (!adjacentIsOpponent) {
        moves.push(adjacent);
        continue;
      }

      const jumpTarget = {
        row: opponent.position.row + rowDelta,
        column: opponent.position.column + columnDelta,
      };
      if (
        this.isInBounds(jumpTarget.row, jumpTarget.column)
        && !this.isEdgeBlocked(state.walls, opponent.position, jumpTarget)
      ) {
        moves.push(jumpTarget);
        continue;
      }

      const sidesteps = rowDelta !== 0
        ? ([
            { row: opponent.position.row, column: opponent.position.column - 1 },
            { row: opponent.position.row, column: opponent.position.column + 1 },
          ] as const)
        : ([
            { row: opponent.position.row - 1, column: opponent.position.column },
            { row: opponent.position.row + 1, column: opponent.position.column },
          ] as const);

      for (const sidestep of sidesteps) {
        if (!this.isInBounds(sidestep.row, sidestep.column)) continue;
        if (this.isEdgeBlocked(state.walls, opponent.position, sidestep)) continue;
        moves.push({ ...sidestep });
      }
    }

    return this.uniqueCells(moves);
  }

  private getLegalWallPlacements(state: WrongwayGameState, player: WrongwayPlayer): WrongwayWall[] {
    if (player.wallsRemaining <= 0) return [];

    const placements: WrongwayWall[] = [];
    const orientations: WrongwayWallOrientation[] = ['horizontal', 'vertical'];
    for (const orientation of orientations) {
      for (let row = 0; row <= WALL_ANCHOR_MAX; row += 1) {
        for (let column = 0; column <= WALL_ANCHOR_MAX; column += 1) {
          const wall = { row, column, orientation };
          if (this.canPlaceWall(state, wall)) placements.push(wall);
        }
      }
    }
    return placements;
  }

  private canPlaceWall(state: WrongwayGameState, wall: WrongwayWall): boolean {
    if (!this.isWallAnchorInRange(wall.row, wall.column)) return false;

    for (const existing of state.walls) {
      if (existing.orientation === wall.orientation) {
        if (
          wall.orientation === 'horizontal'
          && existing.row === wall.row
          && Math.abs(existing.column - wall.column) <= 1
        ) {
          return false;
        }
        if (
          wall.orientation === 'vertical'
          && existing.column === wall.column
          && Math.abs(existing.row - wall.row) <= 1
        ) {
          return false;
        }
      } else if (existing.row === wall.row && existing.column === wall.column) {
        return false;
      }
    }

    const candidateWalls = [...state.walls, wall];
    return state.players.every((player) => this.hasPathToGoal(player.position, player.goalRow, candidateWalls));
  }

  private hasPathToGoal(start: Cell, goalRow: number, walls: WrongwayWall[]): boolean {
    const queue: Cell[] = [{ ...start }];
    const visited = new Set<number>([this.toIndex(start.row, start.column)]);

    while (queue.length > 0) {
      const cell = queue.shift()!;
      if (cell.row === goalRow) return true;

      for (const [rowDelta, columnDelta] of ORTHOGONAL_DIRECTIONS) {
        const next = { row: cell.row + rowDelta, column: cell.column + columnDelta };
        if (!this.isInBounds(next.row, next.column)) continue;
        const nextIndex = this.toIndex(next.row, next.column);
        if (visited.has(nextIndex)) continue;
        if (this.isEdgeBlocked(walls, cell, next)) continue;
        visited.add(nextIndex);
        queue.push(next);
      }
    }

    return false;
  }

  private isEdgeBlocked(walls: WrongwayWall[], from: Cell, to: Cell): boolean {
    if (Math.abs(from.row - to.row) + Math.abs(from.column - to.column) !== 1) {
      return true;
    }

    if (from.row !== to.row) {
      const minRow = Math.min(from.row, to.row);
      const column = from.column;
      return walls.some(
        (wall) => wall.orientation === 'horizontal'
          && wall.row === minRow
          && (wall.column === column || wall.column + 1 === column),
      );
    }

    const row = from.row;
    const minColumn = Math.min(from.column, to.column);
    return walls.some(
      (wall) => wall.orientation === 'vertical'
        && wall.column === minColumn
        && (wall.row === row || wall.row + 1 === row),
    );
  }

  private uniqueCells(cells: Cell[]): Cell[] {
    const seen = new Set<number>();
    const unique: Cell[] = [];
    for (const cell of cells) {
      const index = this.toIndex(cell.row, cell.column);
      if (seen.has(index)) continue;
      seen.add(index);
      unique.push(cell);
    }
    return unique;
  }

  private getPlayer(state: WrongwayGameState, playerId: string): WrongwayPlayer | undefined {
    return state.players.find((player) => player.id === playerId);
  }

  private getOpponent(state: WrongwayGameState, playerId: string): WrongwayPlayer {
    return state.players.find((player) => player.id !== playerId)!;
  }

  private toCell(index: number): Cell {
    return {
      row: Math.floor(index / BOARD_SIZE),
      column: index % BOARD_SIZE,
    };
  }

  private toIndex(row: number, column: number): number {
    return row * BOARD_SIZE + column;
  }

  private isInBounds(row: number, column: number): boolean {
    return row >= 0 && row < BOARD_SIZE && column >= 0 && column < BOARD_SIZE;
  }

  private isWallAnchorInRange(row: number, column: number): boolean {
    return row >= 0 && row <= WALL_ANCHOR_MAX && column >= 0 && column <= WALL_ANCHOR_MAX;
  }
}