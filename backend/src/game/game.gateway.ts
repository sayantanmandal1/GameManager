import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import {
  Logger,
  OnModuleDestroy,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { GameService } from './game.service';
import { getSocketUser } from '../auth/ws-jwt.guard';
import {
  GAME_EVENTS,
  BINGO_EVENTS,
  LUDO_EVENTS,
  CHESS_EVENTS,
  GameType,
  LudoMoveAction,
  CHESS_MOVE_RATE_CAPACITY,
  CHESS_MOVE_RATE_REFILL_PER_SEC,
} from '../shared';
import {
  ChessMoveDto,
  ChessResignDto,
  ChessDrawOfferDto,
  ChessDrawResponseDto,
  ChessRejoinDto,
  ChessSpectateDto,
} from './dto/chess.dto';

/**
 * Token-bucket rate limiter state held per socket.
 * Capacity=10, refill 10/s → burst of 10 then sustained 10/s.
 */
interface RateBucket {
  tokens: number;
  lastRefillMs: number;
}

const CHESS_TICK_INTERVAL_MS = 500;

// WebSocket handlers validate their DTOs explicitly via @UsePipes because
// the app-wide ValidationPipe in main.ts does not cover @MessageBody().
const WS_VALIDATION = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

@WebSocketGateway({ cors: { origin: '*' } })
export class GameGateway
  implements OnGatewayInit, OnGatewayDisconnect, OnModuleDestroy
{
  private readonly logger = new Logger(GameGateway.name);

  @WebSocketServer()
  server: Server;

  /** Track socket → active game info for disconnect surrender */
  private socketGameMap = new Map<string, { userId: string; gameId: string; lobbyCode: string; gameType: GameType }>();

  /** socket.id → chess move rate-limit bucket */
  private chessMoveBuckets = new Map<string, RateBucket>();

  private chessTickTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly gameService: GameService,
    private readonly jwtService: JwtService,
  ) {}

  afterInit(): void {
    // Wire callbacks so GameService can broadcast state changes
    this.gameService.onStateChanged = (gameId, lobbyCode) => {
      this.broadcastPlayerViews(gameId, lobbyCode);
    };

    this.gameService.onGameFinished = (gameId, lobbyCode, result) => {
      // Send the final state (with winner) to all players, plus the result event
      this.broadcastPlayerViews(gameId, lobbyCode);
      this.server.to(`game:${lobbyCode}`).emit(GAME_EVENTS.RESULT, {
        gameId,
        winnerId: result.winnerId,
        winnerName: result.winnerName,
        completedLines: result.completedLines,
        surrenderedBy: result.surrenderedBy,
      });
    };

    // Ludo callbacks
    this.gameService.onLudoStateChanged = (gameId, lobbyCode) => {
      this.broadcastLudoPlayerViews(gameId, lobbyCode);
    };

    this.gameService.onLudoGameFinished = (gameId, lobbyCode, result) => {
      this.broadcastLudoPlayerViews(gameId, lobbyCode);
      this.server.to(`game:${lobbyCode}`).emit(GAME_EVENTS.RESULT, {
        gameId,
        winnerId: result.winnerId,
        winnerName: result.winnerName,
        rankings: result.rankings,
        surrenderedBy: result.surrenderedBy,
      });
    };

    this.gameService.onBotTurnNeeded = (gameId, lobbyCode, botId) => {
      this.scheduleBotTurn(gameId, lobbyCode);
    };

    // ─── Chess callbacks ───
    this.gameService.onChessStateChanged = (gameId, lobbyCode) => {
      this.broadcastChessPlayerViews(gameId, lobbyCode);
    };
    this.gameService.onChessMoveApplied = (gameId, lobbyCode, payload) => {
      this.server.to(`game:${lobbyCode}`).emit(CHESS_EVENTS.MOVE_APPLIED, {
        gameId,
        move: payload.move,
        fen: payload.fen,
        pgn: payload.pgn,
        turn: payload.turn,
        clocks: payload.clocks,
        inCheck: payload.inCheck,
        halfmoveClock: payload.halfmoveClock,
        fullmoveNumber: payload.fullmoveNumber,
      });
    };
    this.gameService.onChessClockTick = (gameId, lobbyCode, tick) => {
      this.server.to(`game:${lobbyCode}`).emit(CHESS_EVENTS.CLOCK_TICK, {
        gameId,
        whiteMs: tick.whiteMs,
        blackMs: tick.blackMs,
        turn: tick.turn,
        serverTs: tick.serverTs,
      });
    };
    this.gameService.onChessDrawOfferBroadcast = (gameId, lobbyCode, by, byUserId) => {
      this.server.to(`game:${lobbyCode}`).emit(CHESS_EVENTS.DRAW_OFFER, {
        gameId,
        by,
        byUserId,
      });
    };
    this.gameService.onChessDrawDeclined = (gameId, lobbyCode, by) => {
      this.server.to(`game:${lobbyCode}`).emit(CHESS_EVENTS.DRAW_DECLINED, {
        gameId,
        by,
      });
    };
    this.gameService.onChessGameFinished = (gameId, lobbyCode, payload) => {
      // Send final view to every socket in room (per-user role), then the
      // terminal game_over broadcast.
      this.broadcastChessPlayerViews(gameId, lobbyCode);
      this.server.to(`game:${lobbyCode}`).emit(CHESS_EVENTS.GAME_OVER, payload);
    };

    // Clock-tick loop (server-authoritative, ≤1Hz broadcast per game).
    this.chessTickTimer = setInterval(() => {
      this.gameService.chessTick().catch((err) => {
        this.logger.error(`chess.tick_error: ${err instanceof Error ? err.message : String(err)}`);
      });
    }, CHESS_TICK_INTERVAL_MS);
  }

  async handleDisconnect(client: Socket): Promise<void> {
    // Clean up rate-limit bucket regardless of game type
    this.chessMoveBuckets.delete(client.id);

    const tracked = this.socketGameMap.get(client.id);
    if (!tracked) return;

    this.socketGameMap.delete(client.id);

    // Auto-surrender on disconnect for any active game
    if (tracked.gameType === GameType.LUDO) {
      const state = this.gameService.getLudoState(tracked.gameId);
      if (state && state.phase !== 'finished' && !state.rankings.includes(tracked.userId)) {
        await this.gameService.ludoSurrender(tracked.gameId, tracked.userId, tracked.lobbyCode);
      }
    } else if (tracked.gameType === GameType.BINGO) {
      const state = this.gameService.getState(tracked.gameId);
      if (state && state.phase !== 'finished') {
        await this.gameService.bingoSurrender(tracked.gameId, tracked.userId, tracked.lobbyCode);
      }
    } else if (tracked.gameType === GameType.CHESS) {
      // Per design §7 we do NOT auto-forfeit chess on disconnect; the clock
      // is authoritative. Just unregister spectators.
      this.gameService.chessRemoveSpectator(tracked.gameId, tracked.userId);
    }
  }

  onModuleDestroy(): void {
    if (this.chessTickTimer) {
      clearInterval(this.chessTickTimer);
      this.chessTickTimer = null;
    }
  }

  /** Client requests current game state (e.g. after navigating to play page) */
  @SubscribeMessage(GAME_EVENTS.REQUEST_STATE)
  handleRequestState(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { lobbyCode: string },
  ): void {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;

    const gameId = this.gameService.getGameIdForLobby(data.lobbyCode);
    if (!gameId) {
      client.emit(GAME_EVENTS.ERROR, { message: 'No active game for this lobby' });
      return;
    }

    // Ensure client is in the game room
    client.join(`game:${data.lobbyCode}`);

    const gameType = this.gameService.getGameTypeForLobby(data.lobbyCode);

    // Track socket for disconnect surrender
    if (gameType) {
      this.socketGameMap.set(client.id, {
        userId: user.sub,
        gameId,
        lobbyCode: data.lobbyCode,
        gameType,
      });
    }

    if (gameType === GameType.LUDO) {
      const view = this.gameService.getLudoPlayerView(gameId, user.sub);
      if (view) {
        client.emit(GAME_EVENTS.STATE, { gameId, view, gameType: GameType.LUDO });
      }
    } else {
      const view = this.gameService.getPlayerView(gameId, user.sub);
      if (view) {
        client.emit(GAME_EVENTS.STATE, { gameId, view });
      }
    }
  }

  /** Setup phase: player places a number on their board */
  @SubscribeMessage(BINGO_EVENTS.PLACE_NUMBER)
  handlePlaceNumber(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { gameId: string; lobbyCode: string; row: number; col: number; number: number },
  ): void {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;

    const result = this.gameService.placeNumber(
      data.gameId,
      user.sub,
      data.row,
      data.col,
      data.number,
      data.lobbyCode,
    );

    if (!result.ok) {
      client.emit(GAME_EVENTS.ERROR, { message: result.error });
    }
  }

  /** Setup phase: player randomizes their entire board */
  @SubscribeMessage(BINGO_EVENTS.RANDOMIZE_BOARD)
  handleRandomizeBoard(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; lobbyCode: string },
  ): void {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;

    const result = this.gameService.randomizeBoard(
      data.gameId,
      user.sub,
      data.lobbyCode,
    );

    if (!result.ok) {
      client.emit(GAME_EVENTS.ERROR, { message: result.error });
    }
  }

  /** Play phase: player chooses a number to cross off all boards */
  @SubscribeMessage(BINGO_EVENTS.CHOOSE_NUMBER)
  async handleChooseNumber(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; lobbyCode: string; number: number },
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;

    const result = await this.gameService.chooseNumber(
      data.gameId,
      user.sub,
      data.number,
      data.lobbyCode,
    );

    if (!result.ok) {
      client.emit(GAME_EVENTS.ERROR, { message: result.error });
    }
  }

  private async broadcastPlayerViews(
    gameId: string,
    lobbyCode: string,
  ): Promise<void> {
    const gameRoom = `game:${lobbyCode}`;
    const sockets = await this.server.in(gameRoom).fetchSockets();

    for (const s of sockets) {
      const sUser = s.data?.user;
      if (sUser) {
        const view = this.gameService.getPlayerView(gameId, sUser.sub);
        if (view) {
          s.emit(GAME_EVENTS.STATE, { gameId, view });
        }
      }
    }
  }

  // ─── Ludo-Specific Handlers ───

  @SubscribeMessage(LUDO_EVENTS.ROLL_DICE)
  handleLudoRollDice(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; lobbyCode: string },
  ): void {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;

    const result = this.gameService.ludoRollDice(
      data.gameId,
      user.sub,
      data.lobbyCode,
    );

    if (!result.ok) {
      client.emit(GAME_EVENTS.ERROR, { message: result.error });
    }
  }

  @SubscribeMessage(LUDO_EVENTS.MOVE_TOKEN)
  async handleLudoMoveToken(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; lobbyCode: string; moves: LudoMoveAction[] },
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;

    const result = await this.gameService.ludoMoveToken(
      data.gameId,
      user.sub,
      data.moves,
      data.lobbyCode,
    );

    if (!result.ok) {
      client.emit(GAME_EVENTS.ERROR, { message: result.error });
    }
  }

  // ─── Generic Surrender Handler (works for all game types) ───

  @SubscribeMessage(GAME_EVENTS.SURRENDER)
  async handleSurrender(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; lobbyCode: string },
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;

    const gameType = this.gameService.getGameTypeForLobby(data.lobbyCode);
    let result: { ok: boolean; error?: string };

    if (gameType === GameType.LUDO) {
      result = await this.gameService.ludoSurrender(data.gameId, user.sub, data.lobbyCode);
    } else if (gameType === GameType.BINGO) {
      result = await this.gameService.bingoSurrender(data.gameId, user.sub, data.lobbyCode);
    } else {
      result = { ok: false, error: 'Unknown game type' };
    }

    if (!result.ok) {
      client.emit(GAME_EVENTS.ERROR, { message: result.error });
    }

    // Clean up socket tracking after surrender
    this.socketGameMap.delete(client.id);
  }

  private async broadcastLudoPlayerViews(
    gameId: string,
    lobbyCode: string,
  ): Promise<void> {
    const gameRoom = `game:${lobbyCode}`;
    const sockets = await this.server.in(gameRoom).fetchSockets();

    for (const s of sockets) {
      const sUser = s.data?.user;
      if (sUser) {
        const view = this.gameService.getLudoPlayerView(gameId, sUser.sub);
        if (view) {
          s.emit(GAME_EVENTS.STATE, { gameId, view, gameType: GameType.LUDO });
        }
      }
    }
  }

  /** Schedule bot turns with delays for realistic pacing */
  private scheduleBotTurn(gameId: string, lobbyCode: string): void {
    setTimeout(() => {
      const records = this.gameService.executeLudoBotTurn(gameId, lobbyCode);

      // After bot turn, check if next player is also a bot
      const state = this.gameService.getLudoState(gameId);
      if (state && state.phase !== 'finished') {
        const nextPlayer = state.players[state.currentTurn];
        if (nextPlayer?.isBot) {
          this.scheduleBotTurn(gameId, lobbyCode);
        }
      }
    }, 800);
  }

  // ─── Chess-Specific Handlers ───────────────────────────────────────

  @SubscribeMessage(CHESS_EVENTS.MOVE)
  @UsePipes(WS_VALIDATION)
  async handleChessMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ChessMoveDto,
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) {
      this.emitChessReject(client, data?.gameId ?? '', 'not_a_seat', 'Unauthenticated');
      return;
    }
    if (!this.consumeChessMoveToken(client.id)) {
      this.emitChessReject(client, data.gameId, 'rate_limited', 'Too many moves');
      return;
    }
    const result = await this.gameService.applyChessMove(
      data.gameId,
      user.sub,
      { from: data.from, to: data.to, promotion: data.promotion ?? null },
      data.lobbyCode,
    );
    if (!result.ok) {
      this.emitChessReject(
        client,
        data.gameId,
        (result.errorCode as 'illegal_move') ?? 'illegal_move',
        result.errorMessage ?? 'Move rejected',
      );
    }
  }

  @SubscribeMessage(CHESS_EVENTS.RESIGN)
  @UsePipes(WS_VALIDATION)
  async handleChessResign(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ChessResignDto,
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;
    const res = await this.gameService.chessResign(data.gameId, user.sub, data.lobbyCode);
    if (!res.ok) {
      this.emitChessReject(
        client,
        data.gameId,
        (res.errorCode as 'not_a_seat') ?? 'game_not_active',
        'Resign rejected',
      );
    }
  }

  @SubscribeMessage(CHESS_EVENTS.DRAW_OFFER)
  @UsePipes(WS_VALIDATION)
  async handleChessDrawOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ChessDrawOfferDto,
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;
    const res = await this.gameService.chessDrawOffer(data.gameId, user.sub, data.lobbyCode);
    if (!res.ok) {
      this.emitChessReject(
        client,
        data.gameId,
        (res.errorCode as 'not_a_seat') ?? 'game_not_active',
        'Draw offer rejected',
      );
    }
  }

  @SubscribeMessage(CHESS_EVENTS.DRAW_RESPONSE)
  @UsePipes(WS_VALIDATION)
  async handleChessDrawResponse(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ChessDrawResponseDto,
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;
    const res = await this.gameService.chessDrawResponse(
      data.gameId,
      user.sub,
      data.response === 'accept',
      data.lobbyCode,
    );
    if (!res.ok) {
      this.emitChessReject(
        client,
        data.gameId,
        (res.errorCode as 'not_a_seat') ?? 'game_not_active',
        'Draw response rejected',
      );
    }
  }

  @SubscribeMessage(CHESS_EVENTS.REJOIN)
  @UsePipes(WS_VALIDATION)
  handleChessRejoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ChessRejoinDto,
  ): void {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;
    const res = this.gameService.chessRejoin(data.lobbyCode, user.sub);
    if (!res.ok || !res.view || !res.gameId) {
      this.emitChessReject(client, '', 'game_not_active', 'No active chess game');
      return;
    }
    client.join(`game:${data.lobbyCode}`);
    this.socketGameMap.set(client.id, {
      userId: user.sub,
      gameId: res.gameId,
      lobbyCode: data.lobbyCode,
      gameType: GameType.CHESS,
    });
    client.emit(CHESS_EVENTS.STATE, {
      gameId: res.gameId,
      role: res.view.role,
      view: res.view,
    });
  }

  @SubscribeMessage(CHESS_EVENTS.SPECTATE)
  @UsePipes(WS_VALIDATION)
  handleChessSpectate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ChessSpectateDto,
  ): void {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;
    const res = this.gameService.chessSpectate(data.lobbyCode, user.sub);
    if (!res.ok || !res.view || !res.gameId) {
      this.emitChessReject(
        client,
        '',
        (res.errorCode as 'game_not_active') ?? 'game_not_active',
        res.errorCode ?? 'spectate rejected',
      );
      return;
    }
    client.join(`game:${data.lobbyCode}`);
    this.socketGameMap.set(client.id, {
      userId: user.sub,
      gameId: res.gameId,
      lobbyCode: data.lobbyCode,
      gameType: GameType.CHESS,
    });
    client.emit(CHESS_EVENTS.STATE, {
      gameId: res.gameId,
      role: res.view.role,
      view: res.view,
    });
  }

  // ─── Chess helpers ────────────────────────────────────────────────

  private emitChessReject(
    client: Socket,
    gameId: string,
    code:
      | 'invalid_payload'
      | 'not_a_seat'
      | 'not_your_turn'
      | 'illegal_move'
      | 'game_not_active'
      | 'rate_limited',
    message: string,
  ): void {
    // SECURITY_NOTE: never leak stack traces / internal details; only the
    // allow-listed code enum values are emitted.
    client.emit(CHESS_EVENTS.MOVE_REJECTED, { gameId, code, message });
  }

  /**
   * Token-bucket refill + consume. Returns true on success (a token was
   * consumed), false if the bucket is empty.
   */
  private consumeChessMoveToken(socketId: string): boolean {
    const now = Date.now();
    let b = this.chessMoveBuckets.get(socketId);
    if (!b) {
      b = { tokens: CHESS_MOVE_RATE_CAPACITY - 1, lastRefillMs: now };
      this.chessMoveBuckets.set(socketId, b);
      return true;
    }
    const elapsed = Math.max(0, now - b.lastRefillMs);
    if (elapsed > 0) {
      const refill = (elapsed / 1000) * CHESS_MOVE_RATE_REFILL_PER_SEC;
      b.tokens = Math.min(CHESS_MOVE_RATE_CAPACITY, b.tokens + refill);
      b.lastRefillMs = now;
    }
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  }

  private async broadcastChessPlayerViews(
    gameId: string,
    lobbyCode: string,
  ): Promise<void> {
    const gameRoom = `game:${lobbyCode}`;
    const sockets = await this.server.in(gameRoom).fetchSockets();
    for (const s of sockets) {
      const sUser = s.data?.user;
      if (!sUser) continue;
      const view = this.gameService.getChessView(gameId, sUser.sub);
      if (view) {
        s.emit(CHESS_EVENTS.STATE, { gameId, role: view.role, view });
      }
    }
  }
}
