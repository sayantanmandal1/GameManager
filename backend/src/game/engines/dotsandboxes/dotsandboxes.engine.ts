import {
  DotsAndBoxesAction,
  DotsAndBoxesGameState,
  DotsAndBoxesPlayerView,
  DotsAndBoxesResult,
} from '../../../shared';
import {
  DistinctActionResult,
  DistinctGameAdapter,
  DistinctGamePhase,
} from '../distinct-game.adapter';

const BOXES_PER_SIDE = 4;
const DOTS_PER_SIDE = BOXES_PER_SIDE + 1;

export class DotsAndBoxesEngine
  implements
    DistinctGameAdapter<
      DotsAndBoxesGameState,
      DotsAndBoxesAction,
      DotsAndBoxesPlayerView,
      DotsAndBoxesResult
    >
{
  readonly key = 'dotsandboxes' as const;
  readonly rulesetId = 'dots-and-boxes.4x4.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 2;

  initGame(
    playerIds: string[],
    playerNames: Record<string, string>,
  ): DotsAndBoxesGameState {
    if (playerIds.length !== 2 || new Set(playerIds).size !== 2) {
      throw new Error('Dots and Boxes requires exactly two distinct players');
    }

    return {
      players: [
        { id: playerIds[0], name: playerNames[playerIds[0]] || 'Player 1' },
        { id: playerIds[1], name: playerNames[playerIds[1]] || 'Player 2' },
      ],
      horizontalEdges: this.grid(DOTS_PER_SIDE, BOXES_PER_SIDE, false),
      verticalEdges: this.grid(BOXES_PER_SIDE, DOTS_PER_SIDE, false),
      boxes: this.grid(BOXES_PER_SIDE, BOXES_PER_SIDE, null),
      currentTurnId: playerIds[0],
      phase: DistinctGamePhase.PLAYING,
      winnerId: null,
      isDraw: false,
      finishReason: null,
    };
  }

  applyAction(
    state: DotsAndBoxesGameState,
    playerId: string,
    action: DotsAndBoxesAction,
  ): DistinctActionResult<DotsAndBoxesResult> {
    if (state.phase !== DistinctGamePhase.PLAYING) {
      return { valid: false, reason: 'Game already finished' };
    }
    if (state.currentTurnId !== playerId) {
      return { valid: false, reason: 'Not your turn' };
    }
    if (!this.isValidEdge(action)) {
      return { valid: false, reason: 'Invalid edge' };
    }

    const edges =
      action.orientation === 'horizontal'
        ? state.horizontalEdges
        : state.verticalEdges;
    if (edges[action.row][action.column]) {
      return { valid: false, reason: 'Edge already drawn' };
    }

    // SECURITY_NOTE: the server identifies adjacent boxes and awards only
    // boxes whose four authoritative edges are complete.
    edges[action.row][action.column] = true;
    const completedBoxes = this.adjacentBoxes(action).filter(
      ([row, column]) =>
        state.boxes[row][column] === null && this.isBoxComplete(state, row, column),
    );
    completedBoxes.forEach(([row, column]) => {
      state.boxes[row][column] = playerId;
    });

    if (state.boxes.every((row) => row.every((ownerId) => ownerId !== null))) {
      return this.finishBoard(state);
    }

    if (completedBoxes.length === 0) {
      state.currentTurnId = state.players.find(
        (candidate) => candidate.id !== playerId,
      )!.id;
    }
    return { valid: true };
  }

  getPlayerView(
    state: DotsAndBoxesGameState,
    playerId: string,
  ): DotsAndBoxesPlayerView {
    const isPlayer = state.players.some((candidate) => candidate.id === playerId);
    const canAct =
      state.phase === DistinctGamePhase.PLAYING &&
      state.currentTurnId === playerId &&
      isPlayer;
    return {
      players: state.players.map((candidate) => ({ ...candidate })) as [
        DotsAndBoxesGameState['players'][0],
        DotsAndBoxesGameState['players'][1],
      ],
      horizontalEdges: state.horizontalEdges.map((row) => [...row]),
      verticalEdges: state.verticalEdges.map((row) => [...row]),
      boxes: state.boxes.map((row) => [...row]),
      currentTurnId: state.currentTurnId,
      phase: state.phase,
      winnerId: state.winnerId,
      isDraw: state.isDraw,
      youId: playerId,
      canAct,
      legalEdges: canAct ? this.getLegalEdges(state) : [],
    };
  }

  surrender(
    state: DotsAndBoxesGameState,
    playerId: string,
  ): DistinctActionResult<DotsAndBoxesResult> {
    if (state.phase !== DistinctGamePhase.PLAYING) {
      return { valid: false, reason: 'Game already finished' };
    }
    if (!state.players.some((candidate) => candidate.id === playerId)) {
      return { valid: false, reason: 'Player not found' };
    }
    state.phase = DistinctGamePhase.FINISHED;
    state.winnerId = state.players.find((candidate) => candidate.id !== playerId)!.id;
    state.isDraw = false;
    state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: DotsAndBoxesGameState): DotsAndBoxesResult {
    if (!state.finishReason) {
      throw new Error('Dots and Boxes game is not finished');
    }
    return {
      winnerId: state.winnerId,
      isDraw: state.isDraw,
      reason: state.finishReason,
      scores: this.getScores(state),
    };
  }

  private finishBoard(
    state: DotsAndBoxesGameState,
  ): DistinctActionResult<DotsAndBoxesResult> {
    const scores = this.getScores(state);
    state.phase = DistinctGamePhase.FINISHED;
    state.finishReason = 'all_boxes_claimed';
    state.isDraw = scores[state.players[0].id] === scores[state.players[1].id];
    state.winnerId = state.isDraw
      ? null
      : state.players.find(
          (player) =>
            scores[player.id] === Math.max(...Object.values(scores)),
        )!.id;
    return { valid: true, result: this.getResult(state) };
  }

  private adjacentBoxes(action: DotsAndBoxesAction): Array<[number, number]> {
    const boxes: Array<[number, number]> = [];
    if (action.orientation === 'horizontal') {
      if (action.row > 0) boxes.push([action.row - 1, action.column]);
      if (action.row < BOXES_PER_SIDE) boxes.push([action.row, action.column]);
    } else {
      if (action.column > 0) boxes.push([action.row, action.column - 1]);
      if (action.column < BOXES_PER_SIDE) boxes.push([action.row, action.column]);
    }
    return boxes;
  }

  private isBoxComplete(
    state: DotsAndBoxesGameState,
    row: number,
    column: number,
  ): boolean {
    return (
      state.horizontalEdges[row][column] &&
      state.horizontalEdges[row + 1][column] &&
      state.verticalEdges[row][column] &&
      state.verticalEdges[row][column + 1]
    );
  }

  private getLegalEdges(state: DotsAndBoxesGameState): DotsAndBoxesAction[] {
    const edges: DotsAndBoxesAction[] = [];
    state.horizontalEdges.forEach((row, rowIndex) => {
      row.forEach((drawn, column) => {
        if (!drawn) edges.push({ orientation: 'horizontal', row: rowIndex, column });
      });
    });
    state.verticalEdges.forEach((row, rowIndex) => {
      row.forEach((drawn, column) => {
        if (!drawn) edges.push({ orientation: 'vertical', row: rowIndex, column });
      });
    });
    return edges;
  }

  private getScores(state: DotsAndBoxesGameState): Record<string, number> {
    return Object.fromEntries(
      state.players.map((player) => [
        player.id,
        state.boxes.flat().filter((ownerId) => ownerId === player.id).length,
      ]),
    );
  }

  private grid<Value>(rows: number, columns: number, value: Value): Value[][] {
    return Array.from({ length: rows }, () =>
      Array.from({ length: columns }, () => value),
    );
  }

  private isValidEdge(action: DotsAndBoxesAction | undefined): boolean {
    if (!action || !Number.isInteger(action.row) || !Number.isInteger(action.column)) {
      return false;
    }
    if (action.row < 0 || action.column < 0) return false;
    if (action.orientation === 'horizontal') {
      return action.row < DOTS_PER_SIDE && action.column < BOXES_PER_SIDE;
    }
    if (action.orientation === 'vertical') {
      return action.row < BOXES_PER_SIDE && action.column < DOTS_PER_SIDE;
    }
    return false;
  }
}