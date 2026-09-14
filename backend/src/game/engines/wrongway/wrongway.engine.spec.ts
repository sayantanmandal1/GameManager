import type { WrongwayWall } from '../../../shared';
import { WrongwayEngine } from './wrongway.engine';

const BOARD_SIZE = 9;

function toIndex(row: number, column: number): number {
  return row * BOARD_SIZE + column;
}

function hasPath(start: { row: number; column: number }, goalRow: number, walls: WrongwayWall[]): boolean {
  const queue = [{ ...start }];
  const seen = new Set<number>([toIndex(start.row, start.column)]);
  const directions: Array<[number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  const blocked = (from: { row: number; column: number }, to: { row: number; column: number }) => {
    if (Math.abs(from.row - to.row) + Math.abs(from.column - to.column) !== 1) return true;
    if (from.row !== to.row) {
      const minRow = Math.min(from.row, to.row);
      return walls.some((wall) => wall.orientation === 'horizontal'
        && wall.row === minRow
        && (wall.column === from.column || wall.column + 1 === from.column));
    }
    const minColumn = Math.min(from.column, to.column);
    return walls.some((wall) => wall.orientation === 'vertical'
      && wall.column === minColumn
      && (wall.row === from.row || wall.row + 1 === from.row));
  };

  while (queue.length > 0) {
    const cell = queue.shift()!;
    if (cell.row === goalRow) return true;

    for (const [dr, dc] of directions) {
      const next = { row: cell.row + dr, column: cell.column + dc };
      if (next.row < 0 || next.row >= BOARD_SIZE || next.column < 0 || next.column >= BOARD_SIZE) continue;
      const nextIndex = toIndex(next.row, next.column);
      if (seen.has(nextIndex)) continue;
      if (blocked(cell, next)) continue;
      seen.add(nextIndex);
      queue.push(next);
    }
  }

  return false;
}

describe('WrongwayEngine', () => {
  let engine: WrongwayEngine;

  beforeEach(() => {
    engine = new WrongwayEngine();
  });

  const game = () => engine.initGame(['a', 'b'], { a: 'Alice', b: 'Bob' });

  it('validates exactly two distinct players and initializes colors, starts, goals, and 10 walls', () => {
    expect(() => engine.initGame(['a'], { a: 'Alice' })).toThrow('exactly two distinct players');
    expect(() => engine.initGame(['a', 'a'], { a: 'Alice' })).toThrow('exactly two distinct players');

    const state = game();
    expect(engine.rulesetId).toBe('wrongway.distinct-9x9.v1');
    expect(state.players[0]).toMatchObject({
      id: 'a', name: 'Alice', color: 'red', position: { row: 8, column: 4 }, goalRow: 0, wallsRemaining: 10,
    });
    expect(state.players[1]).toMatchObject({
      id: 'b', name: 'Bob', color: 'blue', position: { row: 0, column: 4 }, goalRow: 8, wallsRemaining: 10,
    });
    expect(state.currentTurnId).toBe('a');
    expect(state.walls).toEqual([]);
  });

  it('supports orthogonal pawn moves and switches turn', () => {
    const state = game();

    expect(engine.applyAction(state, 'a', { type: 'wrongway_move', cell: toIndex(7, 4) })).toEqual({ valid: true });
    expect(state.players[0].position).toEqual({ row: 7, column: 4 });
    expect(state.currentTurnId).toBe('b');
  });

  it('blocks movement through wall edges, disallows occupied destination, and supports straight jump', () => {
    const blockedState = game();
    blockedState.walls.push({ row: 7, column: 4, orientation: 'horizontal' });
    expect(engine.applyAction(blockedState, 'a', { type: 'wrongway_move', cell: toIndex(7, 4) })).toEqual({
      valid: false,
      reason: 'Illegal move',
    });

    const occupiedState = game();
    occupiedState.players[0].position = { row: 1, column: 4 };
    occupiedState.players[1].position = { row: 0, column: 4 };
    expect(engine.applyAction(occupiedState, 'a', { type: 'wrongway_move', cell: toIndex(0, 4) })).toEqual({
      valid: false,
      reason: 'Illegal move',
    });

    const jumpState = game();
    jumpState.players[0].position = { row: 4, column: 4 };
    jumpState.players[1].position = { row: 3, column: 4 };
    expect(engine.applyAction(jumpState, 'a', { type: 'wrongway_move', cell: toIndex(2, 4) })).toEqual({ valid: true });
    expect(jumpState.players[0].position).toEqual({ row: 2, column: 4 });
  });

  it('allows diagonal sidesteps when jump is blocked by a wall and when opponent is on board edge', () => {
    const blockedJump = game();
    blockedJump.players[0].position = { row: 4, column: 4 };
    blockedJump.players[1].position = { row: 3, column: 4 };
    blockedJump.walls.push({ row: 2, column: 4, orientation: 'horizontal' });

    const blockedJumpView = engine.getPlayerView(blockedJump, 'a');
    expect(blockedJumpView.legalMoves).toContain(toIndex(3, 3));
    expect(blockedJumpView.legalMoves).toContain(toIndex(3, 5));
    expect(blockedJumpView.legalMoves).not.toContain(toIndex(2, 4));

    expect(engine.applyAction(blockedJump, 'a', { type: 'wrongway_move', cell: toIndex(3, 3) })).toEqual({ valid: true });

    const edgeJump = game();
    edgeJump.players[0].position = { row: 1, column: 4 };
    edgeJump.players[1].position = { row: 0, column: 4 };
    const edgeView = engine.getPlayerView(edgeJump, 'a');
    expect(edgeView.legalMoves).toContain(toIndex(0, 3));
    expect(edgeView.legalMoves).toContain(toIndex(0, 5));
    expect(edgeView.legalMoves).not.toContain(toIndex(0, 4));
  });

  it('rejects arbitrary diagonal moves', () => {
    const state = game();
    expect(engine.applyAction(state, 'a', { type: 'wrongway_move', cell: toIndex(7, 3) })).toEqual({
      valid: false,
      reason: 'Illegal move',
    });
  });

  it('places legal horizontal and vertical walls and decrements only acting player', () => {
    const state = game();
    expect(engine.applyAction(state, 'a', {
      type: 'wrongway_place_wall', row: 4, column: 4, orientation: 'horizontal',
    })).toEqual({ valid: true });
    expect(state.players[0].wallsRemaining).toBe(9);
    expect(state.players[1].wallsRemaining).toBe(10);
    expect(state.currentTurnId).toBe('b');
    expect(state.walls[0]).toMatchObject({ ownerId: 'a', color: 'red' });

    expect(engine.applyAction(state, 'b', {
      type: 'wrongway_place_wall', row: 2, column: 2, orientation: 'vertical',
    })).toEqual({ valid: true });
    expect(state.players[1].wallsRemaining).toBe(9);
    expect(state.walls[1]).toMatchObject({ ownerId: 'b', color: 'blue' });
  });

  it('rejects overlap, crossing, out-of-range, and forged action payloads', () => {
    const state = game();
    expect(engine.applyAction(state, 'a', {
      type: 'wrongway_place_wall', row: 4, column: 4, orientation: 'horizontal',
    })).toEqual({ valid: true });

    expect(engine.applyAction(state, 'b', {
      type: 'wrongway_place_wall', row: 4, column: 5, orientation: 'horizontal',
    })).toEqual({ valid: false, reason: 'Illegal wall placement' });

    state.currentTurnId = 'b';
    expect(engine.applyAction(state, 'b', {
      type: 'wrongway_place_wall', row: 4, column: 4, orientation: 'vertical',
    })).toEqual({ valid: false, reason: 'Illegal wall placement' });

    state.currentTurnId = 'b';
    expect(engine.applyAction(state, 'b', {
      type: 'wrongway_place_wall', row: 8, column: 0, orientation: 'horizontal',
    } as any)).toEqual({ valid: false, reason: 'Invalid action payload' });

    state.currentTurnId = 'b';
    expect(engine.applyAction(state, 'b', {
      type: 'wrongway_move',
      cell: toIndex(1, 4),
      forged: true,
    } as any)).toEqual({ valid: false, reason: 'Invalid action payload' });
  });

  it('rejects a path-blocking wall in a deterministic near-blocked setup', () => {
    const state = game();
    state.players[1].position = { row: 1, column: 4 };
    state.walls = [
      { row: 0, column: 4, orientation: 'horizontal' },
      { row: 0, column: 3, orientation: 'vertical' },
      { row: 1, column: 4, orientation: 'vertical' },
    ];

    expect(engine.applyAction(state, 'a', {
      type: 'wrongway_place_wall',
      row: 1,
      column: 3,
      orientation: 'horizontal',
    })).toEqual({ valid: false, reason: 'Illegal wall placement' });
  });

  it('allows touching walls that do not overlap', () => {
    const state = game();
    expect(engine.applyAction(state, 'a', {
      type: 'wrongway_place_wall', row: 4, column: 4, orientation: 'horizontal',
    })).toEqual({ valid: true });

    expect(engine.applyAction(state, 'b', {
      type: 'wrongway_place_wall', row: 4, column: 5, orientation: 'vertical',
    })).toEqual({ valid: true });
  });

  it('projects only legal walls that preserve paths for both players', () => {
    const state = game();
    state.walls = [
      { row: 6, column: 4, orientation: 'horizontal' },
      { row: 2, column: 2, orientation: 'vertical' },
      { row: 3, column: 6, orientation: 'vertical' },
    ];

    const view = engine.getPlayerView(state, 'a');
    expect(view.legalWallPlacements.length).toBeGreaterThan(0);

    for (const wall of view.legalWallPlacements) {
      const candidateWalls = [...state.walls, wall];
      expect(hasPath(state.players[0].position, state.players[0].goalRow, candidateWalls)).toBe(true);
      expect(hasPath(state.players[1].position, state.players[1].goalRow, candidateWalls)).toBe(true);
    }
  });

  it('ends immediately on goal row, supports surrender, and returns cloned projection data', () => {
    const winState = game();
    winState.players[0].position = { row: 1, column: 4 };
    winState.players[1].position = { row: 7, column: 4 };

    const win = engine.applyAction(winState, 'a', { type: 'wrongway_move', cell: toIndex(0, 4) });
    expect(win).toMatchObject({
      valid: true,
      result: { gameKey: 'wrongway', winnerId: 'a', reason: 'goal', isDraw: false },
    });

    const surrenderState = game();
    const surrender = engine.surrender(surrenderState, 'a');
    expect(surrender).toMatchObject({
      valid: true,
      result: { gameKey: 'wrongway', winnerId: 'b', reason: 'surrender', isDraw: false },
    });

    const projectionState = game();
    projectionState.walls.push({ row: 5, column: 4, orientation: 'horizontal' });
    const view = engine.getPlayerView(projectionState, 'a');
    view.players[0].name = 'Mutated';
    view.players[0].position.row = 0;
    view.walls[0].row = 0;

    expect(projectionState.players[0].name).toBe('Alice');
    expect(projectionState.players[0].position.row).toBe(8);
    expect(projectionState.walls[0].row).toBe(5);
  });
});