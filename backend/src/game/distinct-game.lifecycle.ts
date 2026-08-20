import { Injectable } from '@nestjs/common';
import type { DistinctGameKey } from '../shared';
import type {
  DistinctActionResult,
  DistinctGameResult,
  RuntimeDistinctGameAdapter,
} from './engines/distinct-game.adapter';
import { GameRegistry } from './game-registry';

interface DistinctGameSession {
  gameKey: DistinctGameKey;
  playerIds: string[];
  state: object;
}

@Injectable()
export class DistinctGameLifecycle {
  private readonly sessions = new Map<string, DistinctGameSession>();

  constructor(private readonly registry: GameRegistry = new GameRegistry()) {}

  getDefinition(gameKey: string): RuntimeDistinctGameAdapter {
    return this.registry.getDistinctGame(gameKey);
  }

  start(
    gameId: string,
    gameKey: string,
    playerIds: string[],
    playerNames: Record<string, string>,
  ): object {
    const adapter = this.registry.getDistinctGame(gameKey);
    if (
      playerIds.length < adapter.minPlayers ||
      playerIds.length > adapter.maxPlayers ||
      new Set(playerIds).size !== playerIds.length
    ) {
      throw new Error('invalid_distinct_player_count');
    }
    const state = adapter.initGame(playerIds, playerNames);
    this.sessions.set(gameId, {
      gameKey: adapter.key,
      playerIds: [...playerIds],
      state,
    });
    return state;
  }

  getState(gameId: string): object | undefined {
    return this.sessions.get(gameId)?.state;
  }

  getGameKey(gameId: string): DistinctGameKey | undefined {
    return this.sessions.get(gameId)?.gameKey;
  }

  getPlayerView(gameId: string, playerId: string): object | null {
    const session = this.sessions.get(gameId);
    if (!session || !session.playerIds.includes(playerId)) return null;
    return this.registry
      .getDistinctGame(session.gameKey)
      .getPlayerView(session.state, playerId);
  }

  applyAction(
    gameId: string,
    playerId: string,
    action: object,
  ): DistinctActionResult<DistinctGameResult> {
    const session = this.sessions.get(gameId);
    if (!session) return { valid: false, reason: 'Game not found' };
    if (!session.playerIds.includes(playerId)) {
      return { valid: false, reason: 'Player not found' };
    }
    return this.registry
      .getDistinctGame(session.gameKey)
      .applyAction(session.state, playerId, action);
  }

  surrender(
    gameId: string,
    playerId: string,
  ): DistinctActionResult<DistinctGameResult> {
    const session = this.sessions.get(gameId);
    if (!session) return { valid: false, reason: 'Game not found' };
    if (!session.playerIds.includes(playerId)) {
      return { valid: false, reason: 'Player not found' };
    }
    return this.registry
      .getDistinctGame(session.gameKey)
      .surrender(session.state, playerId);
  }
}