import { randomInt } from 'crypto';
import {
  ArcadeAction,
  ArcadeGameState,
  ArcadePhase,
  ArcadePlayerView,
  ArcadeResult,
  GameCatalogEntry,
} from '../../../shared';

interface ArcadeActionResult {
  valid: boolean;
  reason?: string;
  result?: ArcadeResult;
}

type ArcadeDefinition = GameCatalogEntry & {
  family: 'alignment' | 'takeaway' | 'race' | 'memory';
};

export class ArcadeEngine {
  initGame(
    gameId: string,
    lobbyCode: string,
    definition: ArcadeDefinition,
    playerIds: string[],
    playerNames: Record<string, string>,
  ): ArcadeGameState {
    if (playerIds.length < definition.minPlayers || playerIds.length > definition.maxPlayers) {
      throw new Error('invalid_player_count');
    }

    const state: ArcadeGameState = {
      gameId,
      lobbyCode,
      gameKey: definition.key,
      family: definition.family,
      phase: ArcadePhase.PLAYING,
      players: playerIds.map((id) => ({ id, name: playerNames[id] ?? 'Player', score: 0 })),
      playerOrder: [...playerIds],
      currentTurn: playerIds[0],
      winnerId: null,
      isDraw: false,
      alignment: null,
      takeaway: null,
      race: null,
      memory: null,
    };

    if (definition.family === 'alignment') {
      const size = this.integerRule(definition, 'size', 3, 13);
      const connect = this.integerRule(definition, 'connect', 3, size);
      const pieceLimit = this.integerRule(definition, 'pieceLimit', 0, size * size);
      state.alignment = {
        board: Array<string | null>(size * size).fill(null),
        size,
        connect,
        gravity: definition.rules.gravity === true,
        misere: definition.rules.misere === true,
        pieceLimit,
        placements: Object.fromEntries(playerIds.map((id) => [id, []])),
      };
    } else if (definition.family === 'takeaway') {
      const heaps = Array.isArray(definition.rules.heaps)
        ? definition.rules.heaps.map((value) => Number(value))
        : [];
      if (
        heaps.length < 1 ||
        heaps.length > 8 ||
        heaps.some((value) => !Number.isInteger(value) || value < 1 || value > 100)
      ) {
        throw new Error('invalid_takeaway_rules');
      }
      state.takeaway = {
        heaps,
        maxTake: this.integerRule(definition, 'maxTake', 0, 100),
        misere: definition.rules.misere === true,
      };
    } else if (definition.family === 'race') {
      const boardSize = this.integerRule(definition, 'boardSize', 20, 200);
      state.race = {
        boardSize,
        dieSides: this.integerRule(definition, 'dieSides', 4, 20),
        exactFinish: definition.rules.exactFinish === true,
        positions: Object.fromEntries(playerIds.map((id) => [id, 0])),
        jumps: this.createJumps(
          boardSize,
          this.integerRule(definition, 'jumpCount', 0, 30),
          this.integerRule(definition, 'seed', 1, 1_000_000),
        ),
        lastRoll: null,
      };
    } else {
      const pairs = this.integerRule(definition, 'pairs', 2, 30);
      const theme = typeof definition.rules.theme === 'string'
        ? definition.rules.theme.slice(0, 24)
        : 'symbols';
      const cards = Array.from({ length: pairs }, (_, index) => `${theme}-${index + 1}`);
      state.memory = {
        deck: this.shuffle([...cards, ...cards]),
        matchedBy: Array<string | null>(pairs * 2).fill(null),
        revealed: [],
        pairs,
        theme,
        pendingContinue: false,
      };
    }

    return state;
  }

  applyAction(
    state: ArcadeGameState,
    playerId: string,
    action: ArcadeAction,
  ): ArcadeActionResult {
    if (state.phase !== ArcadePhase.PLAYING) return { valid: false, reason: 'game_finished' };
    if (state.currentTurn !== playerId) return { valid: false, reason: 'not_your_turn' };

    if (state.family === 'alignment' && action.type === 'place') {
      return this.placeAlignment(state, playerId, action.index);
    }
    if (state.family === 'takeaway' && action.type === 'take') {
      return this.takeCounters(state, playerId, action.heap, action.count);
    }
    if (state.family === 'race' && action.type === 'roll') {
      return this.rollRace(state, playerId);
    }
    if (state.family === 'memory' && action.type === 'flip') {
      return this.flipMemory(state, playerId, action.index);
    }
    if (state.family === 'memory' && action.type === 'continue') {
      return this.continueMemory(state);
    }
    return { valid: false, reason: 'invalid_action' };
  }

  surrender(state: ArcadeGameState, playerId: string): ArcadeActionResult {
    if (state.phase !== ArcadePhase.PLAYING) return { valid: false, reason: 'game_finished' };
    if (!state.playerOrder.includes(playerId)) return { valid: false, reason: 'not_a_player' };
    const remaining = state.playerOrder.filter((id) => id !== playerId);
    return this.finish(state, remaining.length === 1 ? remaining[0] : null, remaining.length !== 1);
  }

  getPlayerView(state: ArcadeGameState, playerId: string): ArcadePlayerView | null {
    if (!state.playerOrder.includes(playerId)) return null;
    const memory = state.memory
      ? {
          tiles: state.memory.deck.map((value, index) =>
            state.memory!.matchedBy[index] || state.memory!.revealed.includes(index) ? value : null,
          ),
          matchedBy: [...state.memory.matchedBy],
          revealed: [...state.memory.revealed],
          pairs: state.memory.pairs,
          theme: state.memory.theme,
          pendingContinue: state.memory.pendingContinue,
        }
      : null;

    return {
      gameKey: state.gameKey,
      family: state.family,
      phase: state.phase,
      players: state.players.map((player) => ({ ...player })),
      currentTurn: state.currentTurn,
      canAct: state.phase === ArcadePhase.PLAYING && state.currentTurn === playerId,
      winnerId: state.winnerId,
      isDraw: state.isDraw,
      alignment: state.alignment
        ? {
            board: [...state.alignment.board],
            size: state.alignment.size,
            connect: state.alignment.connect,
            gravity: state.alignment.gravity,
            misere: state.alignment.misere,
            pieceLimit: state.alignment.pieceLimit,
          }
        : null,
      takeaway: state.takeaway ? { ...state.takeaway, heaps: [...state.takeaway.heaps] } : null,
      race: state.race
        ? {
            ...state.race,
            positions: { ...state.race.positions },
            jumps: { ...state.race.jumps },
            lastRoll: state.race.lastRoll ? { ...state.race.lastRoll } : null,
          }
        : null,
      memory,
    };
  }

  private placeAlignment(
    state: ArcadeGameState,
    playerId: string,
    requestedIndex: number,
  ): ArcadeActionResult {
    const game = state.alignment!;
    let index = requestedIndex;
    if (!Number.isInteger(index) || index < 0 || index >= game.board.length) {
      return { valid: false, reason: 'invalid_cell' };
    }
    if (game.gravity) {
      const column = index % game.size;
      index = -1;
      for (let row = game.size - 1; row >= 0; row -= 1) {
        const candidate = row * game.size + column;
        if (!game.board[candidate]) {
          index = candidate;
          break;
        }
      }
      if (index < 0) return { valid: false, reason: 'column_full' };
    } else if (game.board[index]) {
      return { valid: false, reason: 'cell_occupied' };
    }

    const history = game.placements[playerId];
    if (game.pieceLimit > 0 && history.length >= game.pieceLimit) {
      const removed = history.shift();
      if (removed !== undefined) game.board[removed] = null;
    }
    game.board[index] = playerId;
    history.push(index);

    if (this.hasAlignment(game.board, game.size, game.connect, playerId)) {
      const winnerId = game.misere ? this.nextPlayerId(state, playerId) : playerId;
      return this.finish(state, winnerId, false);
    }
    if (game.pieceLimit === 0 && game.board.every(Boolean)) {
      return this.finish(state, null, true);
    }
    this.advanceTurn(state);
    return { valid: true };
  }

  private takeCounters(
    state: ArcadeGameState,
    playerId: string,
    heapIndex: number,
    count: number,
  ): ArcadeActionResult {
    const game = state.takeaway!;
    if (!Number.isInteger(heapIndex) || heapIndex < 0 || heapIndex >= game.heaps.length) {
      return { valid: false, reason: 'invalid_heap' };
    }
    if (
      !Number.isInteger(count) ||
      count < 1 ||
      count > game.heaps[heapIndex] ||
      (game.maxTake > 0 && count > game.maxTake)
    ) {
      return { valid: false, reason: 'invalid_count' };
    }
    game.heaps[heapIndex] -= count;
    if (game.heaps.every((heap) => heap === 0)) {
      const winnerId = game.misere ? this.nextPlayerId(state, playerId) : playerId;
      return this.finish(state, winnerId, false);
    }
    this.advanceTurn(state);
    return { valid: true };
  }

  private rollRace(state: ArcadeGameState, playerId: string): ArcadeActionResult {
    const game = state.race!;
    const value = randomInt(1, game.dieSides + 1);
    const from = game.positions[playerId];
    let destination = from + value;
    if (destination > game.boardSize && game.exactFinish) destination = from;
    else destination = Math.min(destination, game.boardSize);
    destination = game.jumps[destination] ?? destination;
    game.positions[playerId] = destination;
    game.lastRoll = { playerId, value, from, to: destination };
    if (destination >= game.boardSize) return this.finish(state, playerId, false);
    this.advanceTurn(state);
    return { valid: true };
  }

  private flipMemory(
    state: ArcadeGameState,
    playerId: string,
    index: number,
  ): ArcadeActionResult {
    const game = state.memory!;
    if (game.pendingContinue) return { valid: false, reason: 'continue_required' };
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= game.deck.length ||
      game.matchedBy[index] ||
      game.revealed.includes(index)
    ) {
      return { valid: false, reason: 'invalid_tile' };
    }
    game.revealed.push(index);
    if (game.revealed.length === 1) return { valid: true };

    const [first, second] = game.revealed;
    if (game.deck[first] === game.deck[second]) {
      game.matchedBy[first] = playerId;
      game.matchedBy[second] = playerId;
      game.revealed = [];
      const player = state.players.find((candidate) => candidate.id === playerId)!;
      player.score += 1;
      if (game.matchedBy.every(Boolean)) return this.finishMemory(state);
      return { valid: true };
    }

    game.pendingContinue = true;
    state.currentTurn = this.nextPlayerId(state, playerId);
    return { valid: true };
  }

  private continueMemory(state: ArcadeGameState): ArcadeActionResult {
    const game = state.memory!;
    if (!game.pendingContinue) return { valid: false, reason: 'nothing_to_continue' };
    game.revealed = [];
    game.pendingContinue = false;
    return { valid: true };
  }

  private finishMemory(state: ArcadeGameState): ArcadeActionResult {
    const highest = Math.max(...state.players.map((player) => player.score));
    const leaders = state.players.filter((player) => player.score === highest);
    return this.finish(state, leaders.length === 1 ? leaders[0].id : null, leaders.length !== 1);
  }

  private finish(
    state: ArcadeGameState,
    winnerId: string | null,
    isDraw: boolean,
  ): ArcadeActionResult {
    state.phase = ArcadePhase.FINISHED;
    state.winnerId = winnerId;
    state.isDraw = isDraw;
    return {
      valid: true,
      result: {
        winnerId,
        isDraw,
        scores: Object.fromEntries(state.players.map((player) => [player.id, player.score])),
      },
    };
  }

  private advanceTurn(state: ArcadeGameState): void {
    state.currentTurn = this.nextPlayerId(state, state.currentTurn);
  }

  private nextPlayerId(state: ArcadeGameState, playerId: string): string {
    const index = state.playerOrder.indexOf(playerId);
    return state.playerOrder[(index + 1) % state.playerOrder.length];
  }

  private hasAlignment(
    board: Array<string | null>,
    size: number,
    target: number,
    playerId: string,
  ): boolean {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]] as const;
    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < size; column += 1) {
        if (board[row * size + column] !== playerId) continue;
        for (const [rowStep, columnStep] of directions) {
          let count = 1;
          for (let step = 1; step < target; step += 1) {
            const nextRow = row + rowStep * step;
            const nextColumn = column + columnStep * step;
            if (
              nextRow < 0 ||
              nextRow >= size ||
              nextColumn < 0 ||
              nextColumn >= size ||
              board[nextRow * size + nextColumn] !== playerId
            ) break;
            count += 1;
          }
          if (count >= target) return true;
        }
      }
    }
    return false;
  }

  private createJumps(boardSize: number, count: number, seed: number): Record<number, number> {
    const jumps: Record<number, number> = {};
    let value = seed >>> 0;
    const next = () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value;
    };
    let attempts = 0;
    while (Object.keys(jumps).length < count && attempts < count * 20) {
      attempts += 1;
      const from = 2 + (next() % (boardSize - 3));
      const distance = 3 + (next() % Math.max(3, Math.floor(boardSize / 4)));
      const upward = Object.keys(jumps).length % 2 === 0;
      const to = upward
        ? Math.min(boardSize - 1, from + distance)
        : Math.max(1, from - distance);
      if (from !== to && !jumps[from]) jumps[from] = to;
    }
    return jumps;
  }

  private shuffle<T>(values: T[]): T[] {
    for (let index = values.length - 1; index > 0; index -= 1) {
      const swapIndex = randomInt(0, index + 1);
      [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
    }
    return values;
  }

  private integerRule(
    definition: GameCatalogEntry,
    name: string,
    minimum: number,
    maximum: number,
  ): number {
    const value = Number(definition.rules[name]);
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      throw new Error(`invalid_${name}_rule`);
    }
    return value;
  }
}
