import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { GameEntity } from './game.entity';
import { LobbyService } from '../lobby/lobby.service';
import { BingoEngine } from './engines/bingo/bingo.engine';
import { LudoEngine } from './engines/ludo/ludo.engine';
import {
  GameType,
  GameStatus,
  LobbyStatus,
  BingoGameState,
  BingoPlayerView,
  BingoWinResult,
  LudoGameState,
  LudoPlayerView,
  LudoWinResult,
  LudoMoveAction,
  LudoMoveRecord,
} from '../shared';

@Injectable()
export class GameService {
  private gameStates = new Map<string, BingoGameState>();
  private ludoGameStates = new Map<string, LudoGameState>();
  /** lobbyCode → gameId lookup */
  private lobbyGameMap = new Map<string, string>();
  /** lobbyCode → gameType lookup */
  private lobbyGameTypeMap = new Map<string, GameType>();
  private engine = new BingoEngine();
  private ludoEngine = new LudoEngine();

  /** Callbacks set by the gateway to broadcast state */
  onStateChanged: ((gameId: string, lobbyCode: string) => void) | null = null;
  onGameFinished: ((gameId: string, lobbyCode: string, result: BingoWinResult) => void) | null =
    null;

  /** Ludo-specific callbacks */
  onLudoStateChanged: ((gameId: string, lobbyCode: string) => void) | null = null;
  onLudoGameFinished: ((gameId: string, lobbyCode: string, result: LudoWinResult) => void) | null =
    null;
  onBotTurnNeeded: ((gameId: string, lobbyCode: string, botId: string) => void) | null = null;

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
    this.lobbyGameTypeMap.set(lobbyCode, GameType.BINGO);

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

  getGameTypeForLobby(lobbyCode: string): GameType | undefined {
    return this.lobbyGameTypeMap.get(lobbyCode);
  }

  getState(gameId: string): BingoGameState | undefined {
    return this.gameStates.get(gameId);
  }

  async bingoSurrender(
    gameId: string,
    playerId: string,
    lobbyCode: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const state = this.gameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };

    const result = this.engine.surrender(state, playerId);
    if (!result.valid) return { ok: false, error: result.reason };

    this.gameStates.set(gameId, state);

    if (result.winner) {
      await this.gameRepo.update(gameId, {
        winnerId: result.winner.winnerId,
        status: GameStatus.FINISHED,
        finishedAt: new Date(),
      });
      await this.lobbyService.setStatus(lobbyCode, LobbyStatus.WAITING);

      if (this.onGameFinished) {
        this.onGameFinished(gameId, lobbyCode, result.winner);
      }
    }

    return { ok: true };
  }

  // ─── Ludo Game Methods ───

  async startLudoGame(
    lobbyCode: string,
    botIds: string[] = [],
  ): Promise<{ gameId: string; state: LudoGameState }> {
    const lobby = await this.lobbyService.getLobby(lobbyCode);
    if (!lobby) throw new Error('Lobby not found');

    const playerIds = lobby.players.map((p) => p.id);
    const playerNames: Record<string, string> = {};
    for (const p of lobby.players) {
      playerNames[p.id] = p.username;
    }
    const state = this.ludoEngine.initGame(playerIds, playerNames, botIds);

    const entity = this.gameRepo.create({
      lobbyId: lobby.id,
      gameType: GameType.LUDO,
      playerIds,
      status: GameStatus.IN_PROGRESS,
    });
    const saved = await this.gameRepo.save(entity);
    const gameId = saved.id;

    this.ludoGameStates.set(gameId, state);
    this.lobbyGameMap.set(lobbyCode, gameId);
    this.lobbyGameTypeMap.set(lobbyCode, GameType.LUDO);

    await this.redis.set(`game:${gameId}`, JSON.stringify(state), 'EX', 3600);
    await this.lobbyService.setStatus(lobbyCode, LobbyStatus.IN_PROGRESS);

    return { gameId, state };
  }

  getLudoPlayerView(gameId: string, playerId: string): LudoPlayerView | null {
    const state = this.ludoGameStates.get(gameId);
    if (!state) return null;
    return this.ludoEngine.getPlayerView(state, playerId);
  }

  getLudoState(gameId: string): LudoGameState | undefined {
    return this.ludoGameStates.get(gameId);
  }

  ludoRollDice(
    gameId: string,
    playerId: string,
    lobbyCode: string,
  ): { ok: boolean; error?: string; dice?: number; turnSkipped?: boolean; turnCanceled?: boolean } {
    const state = this.ludoGameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };

    const result = this.ludoEngine.rollDice(state, playerId);
    if (!result.valid) return { ok: false, error: result.reason };

    this.ludoGameStates.set(gameId, state);

    if (this.onLudoStateChanged) {
      this.onLudoStateChanged(gameId, lobbyCode);
    }

    // If no moves / turn skipped / canceled, check if next player is a bot
    if (result.turnSkipped || result.turnCanceled) {
      this.checkBotTurn(gameId, lobbyCode, state);
    }

    return { ok: true, dice: result.dice, turnSkipped: result.turnSkipped, turnCanceled: result.turnCanceled };
  }

  async ludoMoveToken(
    gameId: string,
    playerId: string,
    moves: LudoMoveAction[],
    lobbyCode: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const state = this.ludoGameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };

    const result = this.ludoEngine.moveToken(state, playerId, moves);
    if (!result.valid) return { ok: false, error: result.reason };

    this.ludoGameStates.set(gameId, state);

    if (result.winner) {
      await this.gameRepo.update(gameId, {
        winnerId: result.winner.winnerId,
        status: GameStatus.FINISHED,
        finishedAt: new Date(),
      });
      await this.lobbyService.setStatus(lobbyCode, LobbyStatus.WAITING);

      if (this.onLudoGameFinished) {
        this.onLudoGameFinished(gameId, lobbyCode, result.winner);
      }
    } else {
      if (this.onLudoStateChanged) {
        this.onLudoStateChanged(gameId, lobbyCode);
      }
      // Check if next turn is a bot
      this.checkBotTurn(gameId, lobbyCode, state);
    }

    return { ok: true };
  }

  executeLudoBotTurn(
    gameId: string,
    lobbyCode: string,
  ): LudoMoveRecord[] {
    const state = this.ludoGameStates.get(gameId);
    if (!state) return [];

    const botId = state.currentTurn;
    const player = state.players[botId];
    if (!player || !player.isBot) return [];

    const records = this.ludoEngine.executeBotTurn(state, botId);
    this.ludoGameStates.set(gameId, state);

    // Check for game over after bot turn
    if (state.winnerId && this.onLudoGameFinished) {
      this.gameRepo.update(gameId, {
        winnerId: state.winnerId,
        status: GameStatus.FINISHED,
        finishedAt: new Date(),
      }).catch(() => {});
      this.lobbyService.setStatus(lobbyCode, LobbyStatus.WAITING).catch(() => {});

      this.onLudoGameFinished(gameId, lobbyCode, {
        winnerId: state.winnerId,
        winnerName: state.players[state.winnerId]?.username || 'Unknown',
        rankings: [...state.rankings],
      });
    } else if (this.onLudoStateChanged) {
      this.onLudoStateChanged(gameId, lobbyCode);
    }

    return records;
  }

  private checkBotTurn(gameId: string, lobbyCode: string, state: LudoGameState): void {
    const nextPlayer = state.players[state.currentTurn];
    if (nextPlayer?.isBot && this.onBotTurnNeeded) {
      this.onBotTurnNeeded(gameId, lobbyCode, state.currentTurn);
    }
  }

  async ludoSurrender(
    gameId: string,
    playerId: string,
    lobbyCode: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const state = this.ludoGameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };

    const result = this.ludoEngine.surrender(state, playerId);
    if (!result.valid) return { ok: false, error: result.reason };

    this.ludoGameStates.set(gameId, state);

    if (result.winner) {
      await this.gameRepo.update(gameId, {
        winnerId: result.winner.winnerId,
        status: GameStatus.FINISHED,
        finishedAt: new Date(),
      });
      await this.lobbyService.setStatus(lobbyCode, LobbyStatus.WAITING);

      if (this.onLudoGameFinished) {
        this.onLudoGameFinished(gameId, lobbyCode, result.winner);
      }
    } else {
      if (this.onLudoStateChanged) {
        this.onLudoStateChanged(gameId, lobbyCode);
      }
      this.checkBotTurn(gameId, lobbyCode, state);
    }

    return { ok: true };
  }

  /** Find active Ludo game for a player by scanning all active games */
  findLudoGameForPlayer(playerId: string): { gameId: string; lobbyCode: string } | null {
    for (const [lobbyCode, gameId] of this.lobbyGameMap.entries()) {
      if (this.lobbyGameTypeMap.get(lobbyCode) !== GameType.LUDO) continue;
      const state = this.ludoGameStates.get(gameId);
      if (!state) continue;
      if (state.phase === 'finished') continue;
      if (state.players[playerId] && !state.rankings.includes(playerId)) {
        return { gameId, lobbyCode };
      }
    }
    return null;
  }
}
