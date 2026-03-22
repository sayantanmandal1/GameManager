import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { GameEntity } from './game.entity';
import { LobbyService } from '../lobby/lobby.service';
import { BingoEngine } from './engines/bingo/bingo.engine';
import {
  GameType,
  GameStatus,
  LobbyStatus,
  BingoGameState,
  BingoPlayerView,
  BingoWinResult,
} from '../shared';

@Injectable()
export class GameService {
  private gameStates = new Map<string, BingoGameState>();
  /** lobbyCode → gameId lookup */
  private lobbyGameMap = new Map<string, string>();
  private engine = new BingoEngine();

  /** Callbacks set by the gateway to broadcast state */
  onStateChanged: ((gameId: string, lobbyCode: string) => void) | null = null;
  onGameFinished: ((gameId: string, lobbyCode: string, result: BingoWinResult) => void) | null =
    null;

  constructor(
    @InjectRepository(GameEntity)
    private readonly gameRepo: Repository<GameEntity>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly lobbyService: LobbyService,
  ) {}

  async startBingoGame(
    lobbyCode: string,
  ): Promise<{ gameId: string; state: BingoGameState }> {
    const lobby = await this.lobbyService.getLobby(lobbyCode);
    if (!lobby) throw new Error('Lobby not found');

    const playerIds = lobby.players.map((p) => p.id);
    const playerNames: Record<string, string> = {};
    for (const p of lobby.players) {
      playerNames[p.id] = p.username;
    }
    const state = this.engine.initGame(playerIds, playerNames);

    // Persist game record
    const entity = this.gameRepo.create({
      lobbyId: lobby.id,
      gameType: GameType.BINGO,
      playerIds,
      status: GameStatus.IN_PROGRESS,
    });
    const saved = await this.gameRepo.save(entity);
    const gameId = saved.id;

    // Store state in memory & map
    this.gameStates.set(gameId, state);
    this.lobbyGameMap.set(lobbyCode, gameId);

    // Cache in Redis for resilience
    await this.redis.set(`game:${gameId}`, JSON.stringify(state), 'EX', 3600);

    // Update lobby status
    await this.lobbyService.setStatus(lobbyCode, LobbyStatus.IN_PROGRESS);

    return { gameId, state };
  }

  getPlayerView(gameId: string, playerId: string): BingoPlayerView | null {
    const state = this.gameStates.get(gameId);
    if (!state) return null;
    return this.engine.getPlayerView(state, playerId);
  }

  placeNumber(
    gameId: string,
    playerId: string,
    row: number,
    col: number,
    number: number,
    lobbyCode: string,
  ): { ok: boolean; error?: string } {
    const state = this.gameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };

    const result = this.engine.placeNumber(state, playerId, row, col, number);
    if (!result.valid) return { ok: false, error: result.reason };

    this.gameStates.set(gameId, state);

    // Broadcast updated state to all players
    if (this.onStateChanged) {
      this.onStateChanged(gameId, lobbyCode);
    }

    return { ok: true };
  }

  randomizeBoard(
    gameId: string,
    playerId: string,
    lobbyCode: string,
  ): { ok: boolean; error?: string } {
    const state = this.gameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };

    const result = this.engine.randomizeBoard(state, playerId);
    if (!result.valid) return { ok: false, error: result.reason };

    this.gameStates.set(gameId, state);

    if (this.onStateChanged) {
      this.onStateChanged(gameId, lobbyCode);
    }

    return { ok: true };
  }

  async chooseNumber(
    gameId: string,
    playerId: string,
    number: number,
    lobbyCode: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const state = this.gameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };

    const result = this.engine.chooseNumber(state, playerId, number);
    if (!result.valid) return { ok: false, error: result.reason };

    this.gameStates.set(gameId, state);

    if (result.winner) {
      // Game over
      await this.gameRepo.update(gameId, {
        winnerId: result.winner.winnerId,
        status: GameStatus.FINISHED,
        finishedAt: new Date(),
      });
      await this.lobbyService.setStatus(lobbyCode, LobbyStatus.WAITING);

      if (this.onGameFinished) {
        this.onGameFinished(gameId, lobbyCode, result.winner);
      }
    } else {
      // Broadcast updated state
      if (this.onStateChanged) {
        this.onStateChanged(gameId, lobbyCode);
      }
    }

    return { ok: true };
  }

  getGameIdForLobby(lobbyCode: string): string | undefined {
    return this.lobbyGameMap.get(lobbyCode);
  }

  getState(gameId: string): BingoGameState | undefined {
    return this.gameStates.get(gameId);
  }
}
