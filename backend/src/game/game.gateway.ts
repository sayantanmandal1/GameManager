import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { GameService } from './game.service';
import { getSocketUser } from '../auth/ws-jwt.guard';
import { GAME_EVENTS, BINGO_EVENTS, LUDO_EVENTS, GameType, LudoMoveAction } from '../shared';

@WebSocketGateway({ cors: { origin: '*' } })
export class GameGateway implements OnGatewayInit, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  /** Track socket → active game info for disconnect surrender */
  private socketGameMap = new Map<string, { userId: string; gameId: string; lobbyCode: string; gameType: GameType }>();

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
  }

  async handleDisconnect(client: Socket): Promise<void> {
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
}
