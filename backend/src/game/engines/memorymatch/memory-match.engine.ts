import type { MemoryMatchAction, MemoryMatchGameState, MemoryMatchPlayerView, MemoryMatchResult } from '../../../shared';
import { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';
import { hasExactActionShape, isBoundedInteger } from '../action-shape';
import { secureShuffle } from '../standard-cards';

const SYMBOLS = ['Anchor', 'Bell', 'Crown', 'Diamond', 'Feather', 'Key', 'Lantern', 'Map', 'Shell', 'Star', 'Tree', 'Wave'] as const;
type SymbolShuffler = (symbols: string[]) => string[];

export class MemoryMatchEngine implements DistinctGameAdapter<MemoryMatchGameState, MemoryMatchAction, MemoryMatchPlayerView, MemoryMatchResult> {
  readonly key = 'memory-match' as const;
  readonly rulesetId = 'memory-match.standard-24-tile.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 4;

  constructor(private readonly shuffleSymbols: SymbolShuffler = secureShuffle) {}

  initGame(playerIds: string[], playerNames: Record<string, string>): MemoryMatchGameState {
    this.requirePlayers(playerIds);
    const shuffled = this.shuffleSymbols([...SYMBOLS, ...SYMBOLS]);
    return {
      players: playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}` })),
      tiles: shuffled.map((symbol, id) => ({ id, symbol, matchedBy: null })),
      scores: Object.fromEntries(playerIds.map((id) => [id, 0])),
      revealedIndices: [],
      currentTurnId: playerIds[0],
      phase: 'playing',
      winnerId: null,
      isDraw: false,
      finishReason: null,
    };
  }

  applyAction(state: MemoryMatchGameState, playerId: string, action: MemoryMatchAction): DistinctActionResult<MemoryMatchResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };

    if (state.phase === 'awaiting_ack') {
      if (!hasExactActionShape(action, 'acknowledge_mismatch', [])) return { valid: false, reason: 'Mismatch must be acknowledged' };
      state.revealedIndices = [];
      state.phase = 'playing';
      return { valid: true };
    }
    if (!hasExactActionShape(action, 'reveal_tile', ['tileIndex']) || !isBoundedInteger(action.tileIndex, 0, 23)) {
      return { valid: false, reason: 'Invalid tile' };
    }
    const tile = state.tiles[action.tileIndex];
    if (tile.matchedBy || state.revealedIndices.includes(action.tileIndex)) return { valid: false, reason: 'Tile is not hidden' };
    state.revealedIndices.push(action.tileIndex);
    if (state.revealedIndices.length === 1) return { valid: true };

    const [firstIndex, secondIndex] = state.revealedIndices;
    const first = state.tiles[firstIndex];
    const second = state.tiles[secondIndex];
    if (first.symbol === second.symbol) {
      first.matchedBy = playerId;
      second.matchedBy = playerId;
      state.scores[playerId] += 1;
      state.revealedIndices = [];
      if (state.tiles.every((entry) => entry.matchedBy !== null)) {
        this.finishByScores(state, 'all_pairs');
        return { valid: true, result: this.getResult(state) };
      }
      return { valid: true };
    }
    state.currentTurnId = this.nextPlayerId(state, playerId);
    state.phase = 'awaiting_ack';
    return { valid: true };
  }

  getPlayerView(state: MemoryMatchGameState, playerId: string): MemoryMatchPlayerView {
    const visible = new Set(state.revealedIndices);
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({ ...player })),
      youId: playerId,
      tiles: state.tiles.map((tile, index) => ({
        id: tile.id,
        symbol: tile.matchedBy || visible.has(index) ? tile.symbol : null,
        matchedBy: tile.matchedBy,
        revealed: visible.has(index),
      })),
      scores: { ...state.scores },
      revealedIndices: [...state.revealedIndices],
      currentTurnId: state.currentTurnId,
      phase: state.phase,
      winnerId: state.winnerId,
      isDraw: state.isDraw,
      canAct: state.phase !== 'finished' && state.currentTurnId === playerId,
      legalTileIndices: state.phase === 'playing' && state.currentTurnId === playerId
        ? state.tiles.flatMap((tile, index) => !tile.matchedBy && !visible.has(index) ? [index] : [])
        : [],
    };
  }

  surrender(state: MemoryMatchGameState, playerId: string): DistinctActionResult<MemoryMatchResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (!state.players.some((player) => player.id === playerId)) return { valid: false, reason: 'Player not found' };
    const candidates = state.players.filter((player) => player.id !== playerId);
    const highScore = Math.max(...candidates.map((player) => state.scores[player.id]));
    state.phase = 'finished';
    state.winnerId = candidates.find((player) => state.scores[player.id] === highScore)!.id;
    state.isDraw = false;
    state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: MemoryMatchGameState): MemoryMatchResult {
    if (!state.finishReason) throw new Error('Memory Match game is not finished');
    return { gameKey: this.key, winnerId: state.winnerId, isDraw: state.isDraw, reason: state.finishReason, scores: { ...state.scores } };
  }

  private finishByScores(state: MemoryMatchGameState, reason: 'all_pairs'): void {
    const highScore = Math.max(...Object.values(state.scores));
    const leaders = state.players.filter((player) => state.scores[player.id] === highScore);
    state.phase = 'finished';
    state.winnerId = leaders.length === 1 ? leaders[0].id : null;
    state.isDraw = leaders.length > 1;
    state.finishReason = reason;
  }

  private nextPlayerId(state: MemoryMatchGameState, playerId: string): string {
    const index = state.players.findIndex((player) => player.id === playerId);
    return state.players[(index + 1) % state.players.length].id;
  }

  private requirePlayers(playerIds: string[]): void {
    if (playerIds.length < 2 || playerIds.length > 4 || new Set(playerIds).size !== playerIds.length) {
      throw new Error('Memory Match requires two to four distinct players');
    }
  }
}