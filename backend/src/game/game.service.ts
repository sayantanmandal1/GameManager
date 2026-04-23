import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { GameEntity } from './game.entity';
import { LobbyService } from '../lobby/lobby.service';
import { BingoEngine } from './engines/bingo/bingo.engine';
import { LudoEngine } from './engines/ludo/ludo.engine';
import { ChessEngine } from './engines/chess/chess.engine';
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
  ChessGameState,
  ChessPlayerView,
  ChessMove,
  TimeControl,
  CHESS_SPECTATOR_CAP,
} from '../shared';

export interface ChessMoveApplied {
  move: ChessMove;
  fen: string;
  pgn: string;
  turn: 'w' | 'b';
  clocks: ChessGameState['clocks'];
  inCheck: boolean;
  halfmoveClock: number;
  fullmoveNumber: number;
}

export interface ChessGameOverPayload {
  gameId: string;
  result: '1-0' | '0-1' | '1/2-1/2';
  termination: NonNullable<ChessGameState['termination']>;
  winnerId: string | null;
  finalFen: string;
  pgn: string;
  endedAt: number;
}

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);
  private gameStates = new Map<string, BingoGameState>();
  private ludoGameStates = new Map<string, LudoGameState>();
  private chessGameStates = new Map<string, ChessGameState>();
  /** lobbyCode → gameId lookup */
  private lobbyGameMap = new Map<string, string>();
  /** lobbyCode → gameType lookup */
  private lobbyGameTypeMap = new Map<string, GameType>();
  private engine = new BingoEngine();
  private ludoEngine = new LudoEngine();
  private chessEngine = new ChessEngine();

  /** Callbacks set by the gateway to broadcast state */
  onStateChanged: ((gameId: string, lobbyCode: string) => void) | null = null;
  onGameFinished: ((gameId: string, lobbyCode: string, result: BingoWinResult) => void) | null =
    null;

  /** Ludo-specific callbacks */
  onLudoStateChanged: ((gameId: string, lobbyCode: string) => void) | null = null;
  onLudoGameFinished: ((gameId: string, lobbyCode: string, result: LudoWinResult) => void) | null =
    null;
  onBotTurnNeeded: ((gameId: string, lobbyCode: string, botId: string) => void) | null = null;

  /** Chess-specific callbacks */
  onChessStateChanged: ((gameId: string, lobbyCode: string) => void) | null = null;
  onChessMoveApplied:
    | ((gameId: string, lobbyCode: string, payload: ChessMoveApplied) => void)
    | null = null;
  onChessClockTick:
    | ((gameId: string, lobbyCode: string, tick: { whiteMs: number; blackMs: number; turn: 'w' | 'b'; serverTs: number }) => void)
    | null = null;
  onChessDrawOfferBroadcast:
    | ((gameId: string, lobbyCode: string, by: 'w' | 'b', byUserId: string) => void)
    | null = null;
  onChessDrawDeclined:
    | ((gameId: string, lobbyCode: string, by: 'w' | 'b') => void)
    | null = null;
  onChessGameFinished:
    | ((gameId: string, lobbyCode: string, payload: ChessGameOverPayload) => void)
    | null = null;

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

  // ─── Chess Game Methods ───────────────────────────────────────────────

  /**
   * Start a chess game for a 2-player lobby. Creates the `GameEntity` row,
   * seats the first joiner as white and the second as black, initializes
   * the engine with the lobby's optional `timeControl`, and caches state
   * in memory + Redis. Throws if the lobby is missing or does not have
   * exactly two players.
   */
  async startChessGame(
    lobbyCode: string,
  ): Promise<{ gameId: string; state: ChessGameState }> {
    const lobby = await this.lobbyService.getLobby(lobbyCode);
    if (!lobby) throw new Error('Lobby not found');
    if (lobby.players.length !== 2) {
      throw new Error('Chess requires exactly 2 players');
    }

    // Seat assignment: first joiner = white, second = black. (Deterministic
    // and broadcast to clients via chess:state.)
    const [white, black] = lobby.players;
    const playerIds = [white.id, black.id];
    const playerNames: Record<string, string> = {
      [white.id]: white.username,
      [black.id]: black.username,
    };

    const entity = this.gameRepo.create({
      lobbyId: lobby.id,
      gameType: GameType.CHESS,
      playerIds,
      status: GameStatus.IN_PROGRESS,
      startedAt: new Date(),
    });
    const saved = await this.gameRepo.save(entity);
    const gameId = saved.id;

    const tc: TimeControl | null = lobby.timeControl ?? null;
    const state = this.chessEngine.initGame(
      gameId,
      lobbyCode,
      white.id,
      black.id,
      playerNames,
      tc,
    );

    this.chessGameStates.set(gameId, state);
    this.lobbyGameMap.set(lobbyCode, gameId);
    this.lobbyGameTypeMap.set(lobbyCode, GameType.CHESS);

    await this.redis.set(`game:${gameId}`, JSON.stringify(state), 'EX', 3600);
    await this.lobbyService.setStatus(lobbyCode, LobbyStatus.IN_PROGRESS);

    this.logger.log(
      `chess.started gameId=${gameId} lobbyCode=${lobbyCode} timed=${!!tc}`,
    );

    return { gameId, state };
  }

  getChessState(gameId: string): ChessGameState | undefined {
    return this.chessGameStates.get(gameId);
  }

  getChessView(gameId: string, userId: string): ChessPlayerView | null {
    const state = this.chessGameStates.get(gameId);
    if (!state) return null;
    return this.chessEngine.getPlayerView(state, userId);
  }

  /**
   * Apply a chess move. On success schedules broadcast + persistence; on
   * termination updates GameEntity and fires finish callback.
   */
  async applyChessMove(
    gameId: string,
    userId: string,
    move: { from: string; to: string; promotion?: string | null },
    lobbyCode: string,
  ): Promise<{ ok: boolean; errorCode?: string; errorMessage?: string }> {
    const state = this.chessGameStates.get(gameId);
    if (!state) {
      return { ok: false, errorCode: 'game_not_active', errorMessage: 'Game not found' };
    }
    const res = this.chessEngine.applyMove(state, userId, move);
    if (!res.valid || !res.move) {
      this.logger.warn(
        `chess.illegal_move gameId=${gameId} userId=${userId} code=${res.errorCode}`,
      );
      return {
        ok: false,
        errorCode: res.errorCode,
        errorMessage: res.errorMessage,
      };
    }

    // Persist snapshot
    await this.redis
      .set(`game:${gameId}`, JSON.stringify(state), 'EX', 3600)
      .catch(() => {});

    // Broadcast move
    if (this.onChessMoveApplied) {
      const halfmoveClock = parseInt(state.fen.split(' ')[4] ?? '0', 10) || 0;
      const fullmoveNumber = parseInt(state.fen.split(' ')[5] ?? '1', 10) || 1;
      // `inCheck` is encoded in the FEN via side-to-move — cheap reconstruct.
      const inCheck = this.computeInCheck(state);
      this.onChessMoveApplied(gameId, lobbyCode, {
        move: res.move,
        fen: state.fen,
        pgn: state.pgn,
        turn: state.turn,
        clocks: { ...state.clocks },
        inCheck,
        halfmoveClock,
        fullmoveNumber,
      });
    }

    this.logger.log(
      `chess.move gameId=${gameId} userId=${userId} san=${res.move.san} lobbyCode=${lobbyCode}`,
    );

    if (state.status === 'finished') {
      await this.finalizeChess(gameId, lobbyCode, state);
    }

    return { ok: true };
  }

  /** Resign the active chess game for `userId`; opponent wins. */
  async chessResign(
    gameId: string,
    userId: string,
    lobbyCode: string,
  ): Promise<{ ok: boolean; errorCode?: string }> {
    const state = this.chessGameStates.get(gameId);
    if (!state) return { ok: false, errorCode: 'game_not_active' };
    const res = this.chessEngine.resign(state, userId);
    if (!res.valid) return { ok: false, errorCode: res.errorCode };
    this.logger.log(
      `chess.resigned gameId=${gameId} userId=${userId} lobbyCode=${lobbyCode}`,
    );
    await this.finalizeChess(gameId, lobbyCode, state);
    return { ok: true };
  }

  /** Open a draw offer from `userId`; broadcast to the room on success. */
  async chessDrawOffer(
    gameId: string,
    userId: string,
    lobbyCode: string,
  ): Promise<{ ok: boolean; errorCode?: string }> {
    const state = this.chessGameStates.get(gameId);
    if (!state) return { ok: false, errorCode: 'game_not_active' };
    const res = this.chessEngine.offerDraw(state, userId);
    if (!res.valid) return { ok: false, errorCode: res.errorCode };
    const by = state.drawOffer!.by;
    await this.redis
      .set(`game:${gameId}`, JSON.stringify(state), 'EX', 3600)
      .catch(() => {});
    if (this.onChessDrawOfferBroadcast) {
      this.onChessDrawOfferBroadcast(gameId, lobbyCode, by, userId);
    }
    this.logger.log(
      `chess.draw_offered gameId=${gameId} userId=${userId} by=${by} lobbyCode=${lobbyCode}`,
    );
    return { ok: true };
  }

  /**
   * Respond to an open draw offer. `accept=true` ends the game 1/2-1/2 via
   * draw-agreement; `accept=false` clears the offer and emits
   * `chess:draw_declined` to the room.
   */
  async chessDrawResponse(
    gameId: string,
    userId: string,
    accept: boolean,
    lobbyCode: string,
  ): Promise<{ ok: boolean; errorCode?: string }> {
    const state = this.chessGameStates.get(gameId);
    if (!state) return { ok: false, errorCode: 'game_not_active' };
    const res = this.chessEngine.respondDraw(state, userId, accept);
    if (!res.valid) return { ok: false, errorCode: res.errorCode };
    this.logger.log(
      `chess.draw_response gameId=${gameId} userId=${userId} accept=${accept} lobbyCode=${lobbyCode}`,
    );
    if (res.accepted) {
      await this.finalizeChess(gameId, lobbyCode, state);
    } else {
      await this.redis
        .set(`game:${gameId}`, JSON.stringify(state), 'EX', 3600)
        .catch(() => {});
      if (this.onChessDrawDeclined && res.by) {
        this.onChessDrawDeclined(gameId, lobbyCode, res.by);
      }
    }
    return { ok: true };
  }

  /**
   * Called by the gateway clock-tick loop (every 500ms). Iterates active
   * chess games: updates clocks, detects flag-fall, and emits a ≤1Hz
   * `chess:clock_tick` broadcast per game.
   */
  async chessTick(nowMs: number = Date.now()): Promise<void> {
    for (const [lobbyCode, gameId] of this.lobbyGameMap.entries()) {
      if (this.lobbyGameTypeMap.get(lobbyCode) !== GameType.CHESS) continue;
      const state = this.chessGameStates.get(gameId);
      if (!state) continue;
      if (state.status !== 'in_progress') continue;
      if (!state.timeControl) continue;

      const tick = this.chessEngine.tickClocks(state, nowMs);
      if (tick.flagged) {
        this.logger.log(
          `chess.flagged gameId=${gameId} color=${tick.flaggedColor} insufficient=${tick.insufficientMaterialForOpponent}`,
        );
        await this.finalizeChess(gameId, lobbyCode, state);
        continue;
      }

      // 1Hz throttle on tick broadcast
      if (nowMs - state.lastEmittedTickAt >= 1000 && this.onChessClockTick) {
        state.lastEmittedTickAt = nowMs;
        this.onChessClockTick(gameId, lobbyCode, {
          whiteMs: state.clocks.whiteMs,
          blackMs: state.clocks.blackMs,
          turn: state.turn,
          serverTs: nowMs,
        });
      }
    }
  }

  /** Handle a player or spectator rejoining an active chess game. */
  chessRejoin(
    lobbyCode: string,
    userId: string,
  ): { ok: boolean; errorCode?: string; gameId?: string; view?: ChessPlayerView } {
    const gameId = this.lobbyGameMap.get(lobbyCode);
    if (!gameId || this.lobbyGameTypeMap.get(lobbyCode) !== GameType.CHESS) {
      return { ok: false, errorCode: 'no_active_game' };
    }
    const state = this.chessGameStates.get(gameId);
    if (!state) return { ok: false, errorCode: 'no_active_game' };
    const view = this.chessEngine.getPlayerView(state, userId);
    this.logger.log(
      `chess.rejoin gameId=${gameId} userId=${userId} role=${view.role}`,
    );
    return { ok: true, gameId, view };
  }

  /**
   * Add `userId` to the spectator list for the lobby's active chess game
   * and return the clamped player view. Rejects with `already_seated` if
   * the user is a seat and `spectator_cap` when the cap is reached.
   */
  chessSpectate(
    lobbyCode: string,
    userId: string,
  ): { ok: boolean; errorCode?: string; gameId?: string; view?: ChessPlayerView } {
    const gameId = this.lobbyGameMap.get(lobbyCode);
    if (!gameId || this.lobbyGameTypeMap.get(lobbyCode) !== GameType.CHESS) {
      return { ok: false, errorCode: 'no_active_game' };
    }
    const state = this.chessGameStates.get(gameId);
    if (!state) return { ok: false, errorCode: 'no_active_game' };
    if (this.chessEngine.isSeat(state, userId)) {
      return { ok: false, errorCode: 'already_seated' };
    }
    if (state.spectators.length >= CHESS_SPECTATOR_CAP) {
      return { ok: false, errorCode: 'spectator_cap' };
    }
    if (!state.spectators.includes(userId)) {
      state.spectators.push(userId);
    }
    const view = this.chessEngine.getPlayerView(state, userId);
    return { ok: true, gameId, view };
  }

  /** Remove a spectator on disconnect (best-effort). */
  chessRemoveSpectator(gameId: string, userId: string): void {
    const state = this.chessGameStates.get(gameId);
    if (!state) return;
    const i = state.spectators.indexOf(userId);
    if (i >= 0) state.spectators.splice(i, 1);
  }

  private async finalizeChess(
    gameId: string,
    lobbyCode: string,
    state: ChessGameState,
  ): Promise<void> {
    const result = state.result!;
    const termination = state.termination!;
    const endedAt = state.endedAt ?? Date.now();
    const winnerId =
      result === '1-0'
        ? state.whitePlayerId
        : result === '0-1'
          ? state.blackPlayerId
          : null;

    await this.gameRepo
      .update(gameId, {
        status: GameStatus.FINISHED,
        finishedAt: new Date(endedAt),
        winnerId,
        result,
        termination,
        pgn: state.pgn,
        finalFen: state.fen,
      })
      .catch(() => {});
    await this.lobbyService.setStatus(lobbyCode, LobbyStatus.WAITING).catch(() => {});
    await this.redis
      .set(`game:${gameId}`, JSON.stringify(state), 'EX', 3600)
      .catch(() => {});

    this.logger.log(
      `chess.ended gameId=${gameId} result=${result} termination=${termination} winnerId=${winnerId ?? 'null'}`,
    );

    if (this.onChessGameFinished) {
      this.onChessGameFinished(gameId, lobbyCode, {
        gameId,
        result,
        termination,
        winnerId,
        finalFen: state.fen,
        pgn: state.pgn,
        endedAt,
      });
    }
  }

  private computeInCheck(state: ChessGameState): boolean {
    // Lazy import avoids a hard dep for consumers of the service who don't
    // use chess.js directly. chess.js itself is already pulled in by the
    // engine; this import is a no-op at runtime after that.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Chess } = require('chess.js');
      const c = new Chess();
      if (state.pgn) {
        try {
          c.loadPgn(state.pgn);
        } catch {
          c.load(state.fen);
        }
      } else {
        c.load(state.fen);
      }
      return c.inCheck();
    } catch {
      return false;
    }
  }

  /** Find active chess game a user is seated in. */
  findChessGameForPlayer(playerId: string): { gameId: string; lobbyCode: string } | null {
    for (const [lobbyCode, gameId] of this.lobbyGameMap.entries()) {
      if (this.lobbyGameTypeMap.get(lobbyCode) !== GameType.CHESS) continue;
      const state = this.chessGameStates.get(gameId);
      if (!state) continue;
      if (state.status !== 'in_progress') continue;
      if (state.whitePlayerId === playerId || state.blackPlayerId === playerId) {
        return { gameId, lobbyCode };
      }
    }
    return null;
  }
}
