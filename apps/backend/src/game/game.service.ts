import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { GameEntity } from './game.entity';
import { LobbyService } from '../lobby/lobby.service';
import { GameRegistry } from './game-registry';
import { BingoEngine } from './engines/bingo/bingo.engine';
import {
  GameType,
  GameStatus,
  LobbyStatus,
  BingoGameState,
  BingoPlayerView,
  BingoWinResult,
  BINGO_CONSTANTS,
} from '@multiplayer-games/shared';

@Injectable()
export class GameService {
  private drawTimers = new Map<string, ReturnType<typeof setInterval>>();
  private gameStates = new Map<string, BingoGameState>();

  /** Callbacks set by the gateway to broadcast state */
  onNumberCalled: ((gameId: string, lobbyCode: string) => void) | null = null;
  onGameFinished: ((gameId: string, lobbyCode: string, result: BingoWinResult) => void) | null = null;

  constructor(
    @InjectRepository(GameEntity)
    private readonly gameRepo: Repository<GameEntity>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly lobbyService: LobbyService,
    private readonly gameRegistry: GameRegistry,
    private readonly config: ConfigService,
  ) {}

  async startBingoGame(lobbyCode: string): Promise<{ gameId: string; state: BingoGameState }> {
    const lobby = await this.lobbyService.getLobby(lobbyCode);
    if (!lobby) throw new Error('Lobby not found');

    const engine = this.gameRegistry.getEngine<BingoEngine>(GameType.BINGO);
    const playerIds = lobby.players.map((p) => p.id);
    const state = engine.initGame(playerIds);

    // Persist game record
    const entity = this.gameRepo.create({
      lobbyId: lobby.id,
      gameType: GameType.BINGO,
      playerIds,
      status: GameStatus.IN_PROGRESS,
    });
    const saved = await this.gameRepo.save(entity);
    const gameId = saved.id;

    // Store state in memory
    this.gameStates.set(gameId, state);

    // Cache in Redis for resilience
    await this.redis.set(
      `game:${gameId}`,
      JSON.stringify(state),
      'EX',
      3600,
    );

    // Update lobby status
    await this.lobbyService.setStatus(lobbyCode, LobbyStatus.IN_PROGRESS);

    // Start auto-draw timer
    this.startDrawTimer(gameId, lobbyCode);

    return { gameId, state };
  }

  getPlayerView(gameId: string, playerId: string): BingoPlayerView | null {
    const state = this.gameStates.get(gameId);
    if (!state) return null;

    const engine = this.gameRegistry.getEngine<BingoEngine>(GameType.BINGO);
    return engine.getPlayerView(state, playerId);
  }

  async markNumber(
    gameId: string,
    playerId: string,
    number: number,
  ): Promise<{ view: BingoPlayerView } | { error: string }> {
    const state = this.gameStates.get(gameId);
    if (!state) return { error: 'Game not found' };

    const engine = this.gameRegistry.getEngine<BingoEngine>(GameType.BINGO);
    const validation = engine.validateMove(state, playerId, { number });
    if (!validation.valid) return { error: validation.reason || 'Invalid move' };

    engine.processMove(state, playerId, { number });
    this.gameStates.set(gameId, state);

    return { view: engine.getPlayerView(state, playerId) };
  }

  async claimBingo(
    gameId: string,
    playerId: string,
    lobbyCode: string,
  ): Promise<BingoWinResult | { error: string }> {
    const state = this.gameStates.get(gameId);
    if (!state) return { error: 'Game not found' };
    if (state.winnerId) return { error: 'Game already has a winner' };

    const engine = this.gameRegistry.getEngine<BingoEngine>(GameType.BINGO);
    const result = engine.validateClaim(state, playerId);

    if (!result) return { error: 'No winning pattern found — claim rejected' };

    // Valid win!
    state.winnerId = playerId;
    state.winPattern = result.pattern;
    this.gameStates.set(gameId, state);

    // Stop the draw timer
    this.stopDrawTimer(gameId);

    // Persist
    await this.gameRepo.update(gameId, {
      winnerId: playerId,
      status: GameStatus.FINISHED,
      finishedAt: new Date(),
    });
    await this.lobbyService.setStatus(lobbyCode, LobbyStatus.FINISHED);

    // Notify via callback
    if (this.onGameFinished) {
      this.onGameFinished(gameId, lobbyCode, result);
    }

    return result;
  }

  private startDrawTimer(gameId: string, lobbyCode: string): void {
    const interval = this.config.get<number>(
      'BINGO_DRAW_INTERVAL_MS',
      BINGO_CONSTANTS.DEFAULT_DRAW_INTERVAL_MS,
    );

    const timer = setInterval(() => {
      this.drawNextNumber(gameId, lobbyCode);
    }, interval);

    this.drawTimers.set(gameId, timer);
  }

  stopDrawTimer(gameId: string): void {
    const timer = this.drawTimers.get(gameId);
    if (timer) {
      clearInterval(timer);
      this.drawTimers.delete(gameId);
    }
  }

  private drawNextNumber(gameId: string, lobbyCode: string): void {
    const state = this.gameStates.get(gameId);
    if (!state || state.winnerId) {
      this.stopDrawTimer(gameId);
      return;
    }

    const engine = this.gameRegistry.getEngine<BingoEngine>(GameType.BINGO);
    const { state: newState, number } = engine.drawNumber(state);

    if (number === null) {
      this.stopDrawTimer(gameId);
      return;
    }

    this.gameStates.set(gameId, newState);

    if (this.onNumberCalled) {
      this.onNumberCalled(gameId, lobbyCode);
    }
  }

  getState(gameId: string): BingoGameState | undefined {
    return this.gameStates.get(gameId);
  }
}
