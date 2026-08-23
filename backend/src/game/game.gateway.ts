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
  PHOTOBOOTH_EVENTS,
  UNO_EVENTS,
  TICTACTOE_EVENTS,
  CONNECTFOUR_EVENTS,
  DISTINCT_GAME_EVENTS,
  GameType,
  LudoMoveAction,
  CHESS_MOVE_RATE_CAPACITY,
  CHESS_MOVE_RATE_REFILL_PER_SEC,
  PHOTOBOOTH_CAPTURE_RATE_CAPACITY,
  PHOTOBOOTH_CAPTURE_RATE_REFILL_PER_SEC,
  getCorsOrigins,
} from '../shared';
import {
  ChessMoveDto,
  ChessResignDto,
  ChessDrawOfferDto,
  ChessDrawResponseDto,
  ChessRejoinDto,
  ChessSpectateDto,
} from './dto/chess.dto';
import {
  PhotoboothConfigureDto,
  PhotoboothActionDto,
  PhotoboothCaptureDto,
  PhotoboothFilterDto,
} from './dto/photobooth.dto';
import {
  UnoPlayDto,
  UnoActionDto,
  UnoColorChoiceDto,
  UnoCatchDto,
  UnoRejoinDto,
} from './dto/uno.dto';
import { TicTacToeMoveDto } from './dto/tictactoe.dto';
import { ConnectFourDropDto } from './dto/connectfour.dto';
import { DistinctGameActionDto } from './dto/distinct-game.dto';

/**
 * Token-bucket rate limiter state held per socket.
 * Capacity=10, refill 10/s → burst of 10 then sustained 10/s.
 */
interface RateBucket {
  tokens: number;
  lastRefillMs: number;
}

const CHESS_TICK_INTERVAL_MS = 500;

const UNO_TICK_INTERVAL_MS = 1000;

// Grace period before an empty photobooth room is dissolved. Prevents a
// transient drop (e.g. both partners refreshing at once) from wiping an
// in-progress strip, while still guaranteeing teardown once both truly leave.
const PHOTOBOOTH_CLEANUP_GRACE_MS = 20_000;

// WebSocket handlers validate their DTOs explicitly via @UsePipes because
// the app-wide ValidationPipe in main.ts does not cover @MessageBody().
const WS_VALIDATION = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

@WebSocketGateway({
  cors: {
    origin: getCorsOrigins(),
    credentials: true,
  },
})
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

  /** socket.id → photobooth capture rate-limit bucket */
  private photoboothCaptureBuckets = new Map<string, RateBucket>();

  /** photobooth gameId → pending room-teardown timer (grace period). */
  private photoboothCleanupTimers = new Map<string, NodeJS.Timeout>();

  /** uno gameId → pending room-teardown timer (grace period). */
  private unoCleanupTimers = new Map<string, NodeJS.Timeout>();

  private chessTickTimer: NodeJS.Timeout | null = null;

  private unoTickTimer: NodeJS.Timeout | null = null;

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

    // ─── Photobooth callbacks ───
    this.gameService.onPhotoboothStateChanged = (gameId, lobbyCode) => {
      this.broadcastPhotoboothPlayerViews(gameId, lobbyCode);
    };
    this.gameService.onPhotoboothFinished = (gameId, lobbyCode) => {
      this.broadcastPhotoboothPlayerViews(gameId, lobbyCode);
      this.server
        .to(`game:${lobbyCode}`)
        .emit(PHOTOBOOTH_EVENTS.COMPLETE, { gameId });
    };

    // ─── UNO callbacks ───
    this.gameService.onUnoStateChanged = (gameId, lobbyCode) => {
      return this.broadcastUnoPlayerViews(gameId, lobbyCode);
    };
    this.gameService.onUnoRoundOver = (gameId, lobbyCode, result) => {
      this.server.to(`game:${lobbyCode}`).emit(UNO_EVENTS.ROUND_OVER, {
        gameId,
        result,
      });
    };
    this.gameService.onUnoGameOver = (gameId, lobbyCode, result) => {
      this.server.to(`game:${lobbyCode}`).emit(UNO_EVENTS.GAME_OVER, {
        gameId,
        result,
      });
    };

    this.gameService.onTicTacToeStateChanged = (gameId, lobbyCode) => {
      this.broadcastTicTacToePlayerViews(gameId, lobbyCode);
    };
    this.gameService.onTicTacToeGameFinished = (gameId, lobbyCode, result) => {
      this.broadcastTicTacToePlayerViews(gameId, lobbyCode);
      this.server.to(`game:${lobbyCode}`).emit(TICTACTOE_EVENTS.RESULT, {
        gameId,
        result,
      });
    };
    this.gameService.onConnectFourStateChanged = (gameId, lobbyCode) => {
      this.broadcastConnectFourPlayerViews(gameId, lobbyCode);
    };
    this.gameService.onConnectFourGameFinished = (gameId, lobbyCode, result) => {
      this.broadcastConnectFourPlayerViews(gameId, lobbyCode);
      this.server.to(`game:${lobbyCode}`).emit(CONNECTFOUR_EVENTS.RESULT, {
        gameId,
        result,
      });
    };
    this.gameService.onDistinctGameStateChanged = (gameId, lobbyCode) => {
      return this.broadcastDistinctPlayerViews(gameId, lobbyCode);
    };
    this.gameService.onDistinctGameFinished = async (gameId, lobbyCode, gameKey, result) => {
      await this.broadcastDistinctPlayerViews(gameId, lobbyCode);
      this.server.to(`game:${lobbyCode}`).emit(DISTINCT_GAME_EVENTS.RESULT, {
        gameId,
        lobbyCode,
        gameKey,
        result,
      });
    };
    // Clock-tick loop (server-authoritative, ≤1Hz broadcast per game).
    this.chessTickTimer = setInterval(() => {
      this.gameService.chessTick().catch((err) => {
        this.logger.error(`chess.tick_error: ${err instanceof Error ? err.message : String(err)}`);
      });
    }, CHESS_TICK_INTERVAL_MS);

    // UNO turn-timer / round-pacing loop.
    this.unoTickTimer = setInterval(() => {
      this.gameService.unoTick().catch((err) => {
        this.logger.error(`uno.tick_error: ${err instanceof Error ? err.message : String(err)}`);
      });
    }, UNO_TICK_INTERVAL_MS);
  }

  async handleDisconnect(client: Socket): Promise<void> {
    // Clean up rate-limit bucket regardless of game type
    this.chessMoveBuckets.delete(client.id);
    this.photoboothCaptureBuckets.delete(client.id);

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
    } else if (tracked.gameType === GameType.PHOTOBOOTH) {
      // Flag presence so the partner sees "reconnecting…". Photos survive in
      // memory for the session so a refresh/rejoin restores everything.
      this.gameService.photoboothSetConnected(
        tracked.gameId,
        tracked.userId,
        false,
        tracked.lobbyCode,
      );
      // If nobody remains in the room, schedule teardown after a grace period
      // so the ephemeral session (and its photos) is deleted once both truly
      // leave — but a quick double-refresh won't wipe an in-progress strip.
      const remaining = await this.server
        .in(`game:${tracked.lobbyCode}`)
        .fetchSockets();
      if (remaining.length === 0) {
        this.schedulePhotoboothCleanup(tracked.gameId, tracked.lobbyCode);
      }
    } else if (tracked.gameType === GameType.UNO) {
      // Keep the seat — the turn timer auto-plays for a dropped player, and a
      // refresh/rejoin restores their hand. Dissolve only once the room empties.
      this.gameService.unoHandleDisconnect(
        tracked.gameId,
        tracked.userId,
        tracked.lobbyCode,
      );
      const remaining = await this.server
        .in(`game:${tracked.lobbyCode}`)
        .fetchSockets();
      if (remaining.length === 0) {
        this.scheduleUnoCleanup(tracked.gameId, tracked.lobbyCode);
      }
    } else if (tracked.gameType === GameType.TICTACTOE) {
      // Preserve the seat and board through transient disconnects. The player
      // can replay state through GAME_EVENTS.REQUEST_STATE on reconnect.
    } else if (tracked.gameType === GameType.CONNECTFOUR) {
      // Preserve the seat and board for reconnect; resignation is explicit.
    } else if (tracked.gameType === GameType.DISTINCT) {
      // Preserve the authoritative session for reconnect; surrender is explicit.
    }
  }

  onModuleDestroy(): void {
    if (this.chessTickTimer) {
      clearInterval(this.chessTickTimer);
      this.chessTickTimer = null;
    }
    if (this.unoTickTimer) {
      clearInterval(this.unoTickTimer);
      this.unoTickTimer = null;
    }
    for (const timer of this.photoboothCleanupTimers.values()) {
      clearTimeout(timer);
    }
    this.photoboothCleanupTimers.clear();
    for (const timer of this.unoCleanupTimers.values()) {
      clearTimeout(timer);
    }
    this.unoCleanupTimers.clear();
    this.chessMoveBuckets.clear();
    this.photoboothCaptureBuckets.clear();
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
    client.join(`lobby:${data.lobbyCode}`);

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
    } else if (gameType === GameType.TICTACTOE) {
      const view = this.gameService.getTicTacToePlayerView(gameId, user.sub);
      if (view) {
        client.emit(TICTACTOE_EVENTS.STATE, {
          gameId,
          lobbyCode: data.lobbyCode,
          view,
        });
      }
    } else if (gameType === GameType.CONNECTFOUR) {
      const view = this.gameService.getConnectFourPlayerView(gameId, user.sub);
      if (view) {
        client.emit(CONNECTFOUR_EVENTS.STATE, {
          gameId,
          lobbyCode: data.lobbyCode,
          view,
        });
      }
    } else if (gameType === GameType.DISTINCT) {
      const view = this.gameService.getDistinctPlayerView(gameId, user.sub);
      const gameKey = this.gameService.getDistinctGameKey(gameId);
      if (view && gameKey) {
        client.emit(DISTINCT_GAME_EVENTS.STATE, {
          gameId,
          lobbyCode: data.lobbyCode,
          gameKey,
          view,
        });
      }
    } else if (gameType === GameType.PHOTOBOOTH) {
      // Reconnect: cancel any pending teardown, clear the "disconnected" flag
      // (broadcasts presence to the partner) and replay the current view.
      this.cancelPhotoboothCleanup(gameId);
      this.gameService.photoboothSetConnected(
        gameId,
        user.sub,
        true,
        data.lobbyCode,
      );
      const view = this.gameService.getPhotoboothPlayerView(gameId, user.sub);
      if (view) {
        client.emit(PHOTOBOOTH_EVENTS.STATE, { gameId, view });
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

    if (this.gameService.getGameIdForLobby(data.lobbyCode) !== data.gameId) {
      client.emit(GAME_EVENTS.ERROR, { message: 'Game does not belong to this lobby' });
      return;
    }

    const result = this.gameService.ludoRollDice(
      data.gameId,
      user.sub,
      data.lobbyCode,
    );

    if (!result.ok) {
      client.emit(GAME_EVENTS.ERROR, { message: result.error });
      return;
    }

    if (result.dice !== undefined) {
      this.server.to(`game:${data.lobbyCode}`).emit(LUDO_EVENTS.DICE_ROLLED, {
        gameId: data.gameId,
        playerId: user.sub,
        dice: result.dice,
        turnSkipped: result.turnSkipped ?? false,
        turnCanceled: result.turnCanceled ?? false,
      });
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

  @SubscribeMessage(TICTACTOE_EVENTS.MOVE)
  @UsePipes(WS_VALIDATION)
  async handleTicTacToeMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: TicTacToeMoveDto,
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;
    const result = await this.gameService.tictactoeMove(
      data.gameId,
      user.sub,
      { from: data.from, to: data.to },
      data.lobbyCode,
    );
    if (!result.ok) {
      client.emit(TICTACTOE_EVENTS.ERROR, { message: result.error });
    }
  }

  @SubscribeMessage(CONNECTFOUR_EVENTS.DROP)
  @UsePipes(WS_VALIDATION)
  async handleConnectFourDrop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ConnectFourDropDto,
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;
    const result = await this.gameService.connectfourDrop(
      data.gameId,
      user.sub,
      data.column,
      data.lobbyCode,
    );
    if (!result.ok) {
      client.emit(CONNECTFOUR_EVENTS.ERROR, { message: result.error });
    }
  }

  @SubscribeMessage(DISTINCT_GAME_EVENTS.ACTION)
  @UsePipes(WS_VALIDATION)
  async handleDistinctGameAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: DistinctGameActionDto,
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;
    const result = await this.gameService.distinctGameAction(
      data.gameId,
      user.sub,
      data.action,
      data.lobbyCode,
    );
    if (!result.ok) {
      client.emit(DISTINCT_GAME_EVENTS.ERROR, { message: result.error });
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
    } else if (gameType === GameType.TICTACTOE) {
      result = await this.gameService.tictactoeSurrender(
        data.gameId,
        user.sub,
        data.lobbyCode,
      );
    } else if (gameType === GameType.CONNECTFOUR) {
      result = await this.gameService.connectfourSurrender(
        data.gameId,
        user.sub,
        data.lobbyCode,
      );
    } else if (gameType === GameType.DISTINCT) {
      result = await this.gameService.distinctGameSurrender(
        data.gameId,
        user.sub,
        data.lobbyCode,
      );
    } else {
      result = { ok: false, error: 'Unknown game type' };
    }

    if (!result.ok) {
      client.emit(
        gameType === GameType.DISTINCT
          ? DISTINCT_GAME_EVENTS.ERROR
          : GAME_EVENTS.ERROR,
        { message: result.error },
      );
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

  private async broadcastTicTacToePlayerViews(
    gameId: string,
    lobbyCode: string,
  ): Promise<void> {
    const sockets = await this.server.in(`game:${lobbyCode}`).fetchSockets();
    for (const socket of sockets) {
      const user = socket.data?.user;
      if (!user) continue;
      const view = this.gameService.getTicTacToePlayerView(gameId, user.sub);
      if (view) socket.emit(TICTACTOE_EVENTS.STATE, { gameId, lobbyCode, view });
    }
  }

  private async broadcastConnectFourPlayerViews(
    gameId: string,
    lobbyCode: string,
  ): Promise<void> {
    const sockets = await this.server.in(`game:${lobbyCode}`).fetchSockets();
    for (const socket of sockets) {
      const user = socket.data?.user;
      if (!user) continue;
      const view = this.gameService.getConnectFourPlayerView(gameId, user.sub);
      if (view) socket.emit(CONNECTFOUR_EVENTS.STATE, { gameId, lobbyCode, view });
    }
  }

  private async broadcastDistinctPlayerViews(
    gameId: string,
    lobbyCode: string,
  ): Promise<void> {
    try {
      const sockets = await this.server.in(`game:${lobbyCode}`).fetchSockets();
      const gameKey = this.gameService.getDistinctGameKey(gameId);
      if (!gameKey) return;
      for (const socket of sockets) {
        const user = socket.data?.user;
        if (!user) continue;
        const view = this.gameService.getDistinctPlayerView(gameId, user.sub);
        if (view) {
          socket.emit(DISTINCT_GAME_EVENTS.STATE, {
            gameId,
            lobbyCode,
            gameKey,
            view,
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`distinct.broadcast_failed gameId=${gameId} lobbyCode=${lobbyCode}: ${message}`);
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
    return this.consumeToken(
      this.chessMoveBuckets,
      socketId,
      CHESS_MOVE_RATE_CAPACITY,
      CHESS_MOVE_RATE_REFILL_PER_SEC,
    );
  }

  private consumePhotoboothCaptureToken(socketId: string): boolean {
    return this.consumeToken(
      this.photoboothCaptureBuckets,
      socketId,
      PHOTOBOOTH_CAPTURE_RATE_CAPACITY,
      PHOTOBOOTH_CAPTURE_RATE_REFILL_PER_SEC,
    );
  }

  private consumeToken(
    buckets: Map<string, RateBucket>,
    socketId: string,
    capacity: number,
    refillPerSecond: number,
  ): boolean {
    const now = Date.now();
    let b = buckets.get(socketId);
    if (!b) {
      b = { tokens: capacity - 1, lastRefillMs: now };
      buckets.set(socketId, b);
      return true;
    }
    const elapsed = Math.max(0, now - b.lastRefillMs);
    if (elapsed > 0) {
      const refill = (elapsed / 1000) * refillPerSecond;
      b.tokens = Math.min(capacity, b.tokens + refill);
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

  // ─── Photobooth-Specific Handlers ──────────────────────────────────

  @SubscribeMessage(PHOTOBOOTH_EVENTS.CONFIGURE)
  @UsePipes(WS_VALIDATION)
  handlePhotoboothConfigure(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: PhotoboothConfigureDto,
  ): void {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;
    const result = this.gameService.photoboothConfigure(
      data.gameId,
      user.sub,
      data.layout,
      data.theme,
      data.lobbyCode,
    );
    if (!result.ok) {
      client.emit(GAME_EVENTS.ERROR, { message: result.error });
    }
  }

  @SubscribeMessage(PHOTOBOOTH_EVENTS.START_CAPTURE)
  @UsePipes(WS_VALIDATION)
  handlePhotoboothStartCapture(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: PhotoboothActionDto,
  ): void {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;
    const result = this.gameService.photoboothStartCapture(
      data.gameId,
      user.sub,
      data.lobbyCode,
    );
    if (!result.ok) {
      client.emit(GAME_EVENTS.ERROR, { message: result.error });
    }
  }

  @SubscribeMessage(PHOTOBOOTH_EVENTS.CAPTURE)
  @UsePipes(WS_VALIDATION)
  async handlePhotoboothCapture(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: PhotoboothCaptureDto,
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;
    if (!this.consumePhotoboothCaptureToken(client.id)) {
      client.emit(GAME_EVENTS.ERROR, { message: 'Capture rate limit exceeded' });
      return;
    }
    const result = await this.gameService.photoboothCapture(
      data.gameId,
      user.sub,
      data.image,
      data.lobbyCode,
    );
    if (!result.ok) {
      client.emit(GAME_EVENTS.ERROR, { message: result.error });
    }
  }

  @SubscribeMessage(PHOTOBOOTH_EVENTS.RETAKE)
  @UsePipes(WS_VALIDATION)
  handlePhotoboothRetake(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: PhotoboothActionDto,
  ): void {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;
    const result = this.gameService.photoboothRetake(
      data.gameId,
      user.sub,
      data.lobbyCode,
    );
    if (!result.ok) {
      client.emit(GAME_EVENTS.ERROR, { message: result.error });
    }
  }

  @SubscribeMessage(PHOTOBOOTH_EVENTS.CONFIRM)
  @UsePipes(WS_VALIDATION)
  async handlePhotoboothConfirm(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: PhotoboothActionDto,
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;
    const result = await this.gameService.photoboothConfirm(
      data.gameId,
      user.sub,
      data.lobbyCode,
    );
    if (!result.ok) {
      client.emit(GAME_EVENTS.ERROR, { message: result.error });
    }
  }

  @SubscribeMessage(PHOTOBOOTH_EVENTS.SET_FILTER)
  @UsePipes(WS_VALIDATION)
  handlePhotoboothSetFilter(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: PhotoboothFilterDto,
  ): void {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;
    const result = this.gameService.photoboothSetFilter(
      data.gameId,
      user.sub,
      data.filter,
      data.lobbyCode,
    );
    if (!result.ok) {
      client.emit(GAME_EVENTS.ERROR, { message: result.error });
    }
  }

  private async broadcastPhotoboothPlayerViews(
    gameId: string,
    lobbyCode: string,
  ): Promise<void> {
    const gameRoom = `game:${lobbyCode}`;
    const sockets = await this.server.in(gameRoom).fetchSockets();
    for (const s of sockets) {
      const sUser = s.data?.user;
      if (!sUser) continue;
      const view = this.gameService.getPhotoboothPlayerView(gameId, sUser.sub);
      if (view) {
        s.emit(PHOTOBOOTH_EVENTS.STATE, { gameId, view });
      }
    }
  }

  /**
   * Schedule an empty photobooth room for teardown after a grace period. If a
   * partner reconnects in the meantime the timer is cancelled; otherwise the
   * callback re-checks emptiness before deleting so nothing is lost while
   * either partner is still present.
   */
  private schedulePhotoboothCleanup(gameId: string, lobbyCode: string): void {
    const existing = this.photoboothCleanupTimers.get(gameId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.photoboothCleanupTimers.delete(gameId);
      this.server
        .in(`game:${lobbyCode}`)
        .fetchSockets()
        .then((sockets) => {
          if (sockets.length === 0) {
            this.gameService.photoboothCleanup(gameId, lobbyCode);
          }
        })
        .catch(() => {
          // On error, err on the side of cleanup (session is ephemeral).
          this.gameService.photoboothCleanup(gameId, lobbyCode);
        });
    }, PHOTOBOOTH_CLEANUP_GRACE_MS);

    // Don't keep the event loop alive solely for this timer.
    timer.unref?.();
    this.photoboothCleanupTimers.set(gameId, timer);
  }

  private cancelPhotoboothCleanup(gameId: string): void {
    const timer = this.photoboothCleanupTimers.get(gameId);
    if (timer) {
      clearTimeout(timer);
      this.photoboothCleanupTimers.delete(gameId);
    }
  }

  // ─── UNO-Specific Handlers ─────────────────────────────────────────

  @SubscribeMessage(UNO_EVENTS.PLAY)
  @UsePipes(WS_VALIDATION)
  async handleUnoPlay(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: UnoPlayDto,
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;
    const res = await this.gameService.unoPlay(
      data.gameId,
      user.sub,
      data.cardId,
      data.chosenColor,
      data.lobbyCode,
    );
    if (!res.ok) client.emit(UNO_EVENTS.ERROR, { message: res.error });
  }

  @SubscribeMessage(UNO_EVENTS.DRAW)
  @UsePipes(WS_VALIDATION)
  async handleUnoDraw(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: UnoActionDto,
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;
    const res = await this.gameService.unoDraw(data.gameId, user.sub, data.lobbyCode);
    if (!res.ok) client.emit(UNO_EVENTS.ERROR, { message: res.error });
  }

  @SubscribeMessage(UNO_EVENTS.PASS)
  @UsePipes(WS_VALIDATION)
  async handleUnoPass(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: UnoActionDto,
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;
    const res = await this.gameService.unoPass(data.gameId, user.sub, data.lobbyCode);
    if (!res.ok) client.emit(UNO_EVENTS.ERROR, { message: res.error });
  }

  @SubscribeMessage(UNO_EVENTS.TAKE)
  @UsePipes(WS_VALIDATION)
  async handleUnoTake(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: UnoActionDto,
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;
    const res = await this.gameService.unoTake(data.gameId, user.sub, data.lobbyCode);
    if (!res.ok) client.emit(UNO_EVENTS.ERROR, { message: res.error });
  }

  @SubscribeMessage(UNO_EVENTS.CHALLENGE)
  @UsePipes(WS_VALIDATION)
  async handleUnoChallenge(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: UnoActionDto,
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;
    const res = await this.gameService.unoChallenge(data.gameId, user.sub, data.lobbyCode);
    if (!res.ok) client.emit(UNO_EVENTS.ERROR, { message: res.error });
  }

  @SubscribeMessage(UNO_EVENTS.CALL_UNO)
  @UsePipes(WS_VALIDATION)
  async handleUnoCallUno(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: UnoActionDto,
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;
    const res = await this.gameService.unoCallUno(data.gameId, user.sub, data.lobbyCode);
    if (!res.ok) client.emit(UNO_EVENTS.ERROR, { message: res.error });
  }

  @SubscribeMessage(UNO_EVENTS.CATCH)
  @UsePipes(WS_VALIDATION)
  async handleUnoCatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: UnoCatchDto,
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;
    const res = await this.gameService.unoCatch(
      data.gameId,
      user.sub,
      data.targetId,
      data.lobbyCode,
    );
    if (!res.ok) client.emit(UNO_EVENTS.ERROR, { message: res.error });
  }

  @SubscribeMessage(UNO_EVENTS.SURRENDER)
  @UsePipes(WS_VALIDATION)
  async handleUnoSurrender(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: UnoActionDto,
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;
    const res = await this.gameService.unoSurrender(data.gameId, user.sub, data.lobbyCode);
    if (!res.ok) client.emit(UNO_EVENTS.ERROR, { message: res.error });
  }

  @SubscribeMessage(UNO_EVENTS.CHOOSE_SEVEN)
  @UsePipes(WS_VALIDATION)
  async handleUnoChooseSeven(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: UnoCatchDto,
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;
    const res = await this.gameService.unoChooseSeven(
      data.gameId,
      user.sub,
      data.targetId,
      data.lobbyCode,
    );
    if (!res.ok) client.emit(UNO_EVENTS.ERROR, { message: res.error });
  }

  @SubscribeMessage(UNO_EVENTS.CHOOSE_ROULETTE_COLOR)
  @UsePipes(WS_VALIDATION)
  async handleUnoChooseRouletteColor(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: UnoColorChoiceDto,
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;
    const res = await this.gameService.unoChooseRouletteColor(
      data.gameId,
      user.sub,
      data.chosenColor,
      data.lobbyCode,
    );
    if (!res.ok) client.emit(UNO_EVENTS.ERROR, { message: res.error });
  }

  @SubscribeMessage(UNO_EVENTS.CHOOSE_OPENING_COLOR)
  @UsePipes(WS_VALIDATION)
  async handleUnoChooseOpeningColor(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: UnoColorChoiceDto,
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;
    const res = await this.gameService.unoChooseOpeningColor(
      data.gameId,
      user.sub,
      data.chosenColor,
      data.lobbyCode,
    );
    if (!res.ok) client.emit(UNO_EVENTS.ERROR, { message: res.error });
  }

  @SubscribeMessage(UNO_EVENTS.JUMP_IN)
  @UsePipes(WS_VALIDATION)
  async handleUnoJumpIn(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: UnoPlayDto,
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;
    const res = await this.gameService.unoJumpIn(
      data.gameId,
      user.sub,
      data.cardId,
      data.chosenColor,
      data.lobbyCode,
    );
    if (!res.ok) client.emit(UNO_EVENTS.ERROR, { message: res.error });
  }

  @SubscribeMessage(UNO_EVENTS.REJOIN)
  @UsePipes(WS_VALIDATION)
  handleUnoRejoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: UnoRejoinDto,
  ): void {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;
    const res = this.gameService.unoRejoin(data.lobbyCode, user.sub);
    if (!res.ok || !res.view || !res.gameId) {
      client.emit(UNO_EVENTS.ERROR, { message: 'No active UNO game' });
      return;
    }
    this.cancelUnoCleanup(res.gameId);
    client.join(`game:${data.lobbyCode}`);
    this.socketGameMap.set(client.id, {
      userId: user.sub,
      gameId: res.gameId,
      lobbyCode: data.lobbyCode,
      gameType: GameType.UNO,
    });
    client.emit(UNO_EVENTS.STATE, { gameId: res.gameId, view: res.view });
    // Refresh presence for everyone (this player just (re)connected).
    this.broadcastUnoPlayerViews(res.gameId, data.lobbyCode);
  }

  @SubscribeMessage(UNO_EVENTS.SPECTATE)
  @UsePipes(WS_VALIDATION)
  handleUnoSpectate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: UnoRejoinDto,
  ): void {
    // Spectating shares the same rejoin path — the service seats non-players as
    // spectators, and getPlayerView redacts every hand for them.
    this.handleUnoRejoin(client, data);
  }

  private async broadcastUnoPlayerViews(
    gameId: string,
    lobbyCode: string,
  ): Promise<void> {
    const gameRoom = `game:${lobbyCode}`;
    const sockets = await this.server.in(gameRoom).fetchSockets();
    for (const s of sockets) {
      const sUser = s.data?.user;
      if (!sUser) continue;
      const view = this.gameService.getUnoPlayerView(gameId, sUser.sub);
      if (view) s.emit(UNO_EVENTS.STATE, { gameId, view });
    }
  }

  private scheduleUnoCleanup(gameId: string, lobbyCode: string): void {
    const existing = this.unoCleanupTimers.get(gameId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.unoCleanupTimers.delete(gameId);
      this.server
        .in(`game:${lobbyCode}`)
        .fetchSockets()
        .then((sockets) => {
          if (sockets.length === 0)
            this.gameService.unoCleanup(gameId, lobbyCode);
        })
        .catch(() => this.gameService.unoCleanup(gameId, lobbyCode));
    }, PHOTOBOOTH_CLEANUP_GRACE_MS);
    timer.unref?.();
    this.unoCleanupTimers.set(gameId, timer);
  }

  private cancelUnoCleanup(gameId: string): void {
    const timer = this.unoCleanupTimers.get(gameId);
    if (timer) {
      clearTimeout(timer);
      this.unoCleanupTimers.delete(gameId);
    }
  }
}
