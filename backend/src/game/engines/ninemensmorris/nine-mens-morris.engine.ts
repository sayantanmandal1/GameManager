import type { MorrisAction, MorrisGameState, MorrisPlayerView, MorrisResult } from '../../../shared';
import { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';
import { hasExactActionShape, isBoundedInteger } from '../action-shape';

export const MORRIS_ADJACENCY: ReadonlyArray<readonly number[]> = [
  [1, 9], [0, 2, 4], [1, 14], [4, 10], [1, 3, 5, 7], [4, 13],
  [7, 11], [4, 6, 8], [7, 12], [0, 10, 21], [3, 9, 11, 18], [6, 10, 15],
  [8, 13, 17], [5, 12, 14, 20], [2, 13, 23], [11, 16], [15, 17, 19], [12, 16],
  [10, 19], [16, 18, 20, 22], [13, 19], [9, 22], [19, 21, 23], [14, 22],
];

export const MORRIS_MILLS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11], [12, 13, 14], [15, 16, 17], [18, 19, 20], [21, 22, 23],
  [0, 9, 21], [3, 10, 18], [6, 11, 15], [1, 4, 7], [16, 19, 22], [8, 12, 17], [5, 13, 20], [2, 14, 23],
];

export class NineMensMorrisEngine implements DistinctGameAdapter<MorrisGameState, MorrisAction, MorrisPlayerView, MorrisResult> {
  readonly key = 'nine-mens-morris' as const;
  readonly rulesetId = 'nine-mens-morris.standard-24-node.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 2;

  initGame(playerIds: string[], playerNames: Record<string, string>): MorrisGameState {
    this.requirePlayers(playerIds);
    return {
      players: playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}` })) as MorrisGameState['players'],
      board: new Array<string | null>(24).fill(null),
      stonesPlaced: { [playerIds[0]]: 0, [playerIds[1]]: 0 },
      currentTurnId: playerIds[0],
      phase: 'placement',
      resumePhase: null,
      winnerId: null,
      isDraw: false,
      finishReason: null,
    };
  }

  applyAction(state: MorrisGameState, playerId: string, action: MorrisAction): DistinctActionResult<MorrisResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    if (state.phase === 'removing') return this.removeStone(state, playerId, action);
    if (state.phase === 'placement') return this.placeStone(state, playerId, action);
    return this.moveStone(state, playerId, action);
  }

  getPlayerView(state: MorrisGameState, playerId: string): MorrisPlayerView {
    const ownCount = this.stoneCount(state, playerId);
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({ ...player })) as MorrisGameState['players'],
      youId: playerId,
      board: [...state.board],
      stonesPlaced: { ...state.stonesPlaced },
      currentTurnId: state.currentTurnId,
      phase: state.phase,
      winnerId: state.winnerId,
      canAct: state.phase !== 'finished' && state.currentTurnId === playerId,
      canFly: state.phase === 'movement' && ownCount === 3,
      legalPlacements: state.phase === 'placement' && state.currentTurnId === playerId
        ? state.board.flatMap((stone, node) => stone === null ? [node] : [])
        : [],
      legalMoves: state.phase === 'movement' && state.currentTurnId === playerId ? this.legalMoves(state, playerId) : [],
      removableNodes: state.phase === 'removing' && state.currentTurnId === playerId ? this.removableNodes(state, playerId) : [],
    };
  }

  surrender(state: MorrisGameState, playerId: string): DistinctActionResult<MorrisResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    const opponent = state.players.find((player) => player.id !== playerId);
    if (!opponent || !state.players.some((player) => player.id === playerId)) return { valid: false, reason: 'Player not found' };
    this.finish(state, opponent.id, 'surrender');
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: MorrisGameState): MorrisResult {
    if (!state.finishReason || !state.winnerId) throw new Error("Nine Men's Morris game is not finished");
    return {
      gameKey: this.key,
      winnerId: state.winnerId,
      isDraw: false,
      reason: state.finishReason,
      stoneCounts: Object.fromEntries(state.players.map((player) => [player.id, this.stoneCount(state, player.id)])),
    };
  }

  private placeStone(state: MorrisGameState, playerId: string, action: MorrisAction): DistinctActionResult<MorrisResult> {
    if (!hasExactActionShape(action, 'place_stone', ['node']) || !isBoundedInteger(action.node, 0, 23)) {
      return { valid: false, reason: 'Invalid placement' };
    }
    if (state.board[action.node] !== null) return { valid: false, reason: 'Node is occupied' };
    state.board[action.node] = playerId;
    state.stonesPlaced[playerId] += 1;
    const nextPhase = Object.values(state.stonesPlaced).reduce((sum, count) => sum + count, 0) === 18 ? 'movement' : 'placement';
    if (this.isMill(state.board, action.node, playerId)) {
      state.phase = 'removing';
      state.resumePhase = nextPhase;
      return { valid: true };
    }
    state.phase = nextPhase;
    return this.advanceAndCheck(state, playerId);
  }

  private moveStone(state: MorrisGameState, playerId: string, action: MorrisAction): DistinctActionResult<MorrisResult> {
    if (!hasExactActionShape(action, 'move_stone', ['from', 'to']) || !isBoundedInteger(action.from, 0, 23) || !isBoundedInteger(action.to, 0, 23)) {
      return { valid: false, reason: 'Invalid move' };
    }
    if (state.board[action.from] !== playerId || state.board[action.to] !== null) return { valid: false, reason: 'Invalid move' };
    if (this.stoneCount(state, playerId) > 3 && !MORRIS_ADJACENCY[action.from].includes(action.to)) {
      return { valid: false, reason: 'Stones must move to an adjacent node' };
    }
    state.board[action.from] = null;
    state.board[action.to] = playerId;
    if (this.isMill(state.board, action.to, playerId)) {
      state.phase = 'removing';
      state.resumePhase = 'movement';
      return { valid: true };
    }
    return this.advanceAndCheck(state, playerId);
  }

  private removeStone(state: MorrisGameState, playerId: string, action: MorrisAction): DistinctActionResult<MorrisResult> {
    if (!hasExactActionShape(action, 'remove_stone', ['node']) || !isBoundedInteger(action.node, 0, 23)) {
      return { valid: false, reason: 'Invalid removal' };
    }
    if (!this.removableNodes(state, playerId).includes(action.node)) return { valid: false, reason: 'Stone cannot be removed' };
    const opponentId = state.board[action.node]!;
    state.board[action.node] = null;
    const resumePhase = state.resumePhase!;
    state.phase = resumePhase;
    state.resumePhase = null;
    if (resumePhase === 'movement' && this.stoneCount(state, opponentId) < 3) {
      this.finish(state, playerId, 'fewer_than_three');
      return { valid: true, result: this.getResult(state) };
    }
    return this.advanceAndCheck(state, playerId);
  }

  private advanceAndCheck(state: MorrisGameState, playerId: string): DistinctActionResult<MorrisResult> {
    state.currentTurnId = state.players.find((player) => player.id !== playerId)!.id;
    if (state.phase === 'movement' && this.legalMoves(state, state.currentTurnId).length === 0) {
      this.finish(state, playerId, 'no_legal_moves');
      return { valid: true, result: this.getResult(state) };
    }
    return { valid: true };
  }

  private removableNodes(state: MorrisGameState, playerId: string): number[] {
    const opponentId = state.players.find((player) => player.id !== playerId)!.id;
    const opponentNodes = state.board.flatMap((stone, node) => stone === opponentId ? [node] : []);
    const outsideMills = opponentNodes.filter((node) => !this.isMill(state.board, node, opponentId));
    return outsideMills.length > 0 ? outsideMills : opponentNodes;
  }

  private legalMoves(state: MorrisGameState, playerId: string): Array<{ from: number; to: number }> {
    const nodes = state.board.flatMap((stone, node) => stone === playerId ? [node] : []);
    const emptyNodes = state.board.flatMap((stone, node) => stone === null ? [node] : []);
    if (nodes.length === 3) return nodes.flatMap((from) => emptyNodes.map((to) => ({ from, to })));
    return nodes.flatMap((from) => MORRIS_ADJACENCY[from].filter((to) => state.board[to] === null).map((to) => ({ from, to })));
  }

  private isMill(board: Array<string | null>, node: number, playerId: string): boolean {
    return MORRIS_MILLS.some((mill) => mill.includes(node) && mill.every((position) => board[position] === playerId));
  }

  private stoneCount(state: MorrisGameState, playerId: string): number {
    return state.board.filter((stone) => stone === playerId).length;
  }

  private finish(state: MorrisGameState, winnerId: string, reason: MorrisResult['reason']): void {
    state.phase = 'finished';
    state.winnerId = winnerId;
    state.finishReason = reason;
  }

  private requirePlayers(playerIds: string[]): void {
    if (playerIds.length !== 2 || new Set(playerIds).size !== 2) throw new Error("Nine Men's Morris requires exactly two distinct players");
  }
}