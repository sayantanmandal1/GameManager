import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { GameService } from './game.service';
import { getSocketUser } from '../auth/ws-jwt.guard';
import {
  GAME_EVENTS,
  BINGO_EVENTS,
  BingoWinResult,
} from '@multiplayer-games/shared';

/** Maps lobbyCode → gameId for quick lookups */
const lobbyGameMap = new Map<string, string>();

@WebSocketGateway({ cors: { origin: '*' } })
export class GameGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly gameService: GameService,
    private readonly jwtService: JwtService,
  ) {}

  afterInit(): void {
    // Wire callbacks so GameService can broadcast state changes
    this.gameService.onNumberCalled = (gameId, lobbyCode) => {
      this.broadcastPlayerViews(gameId, lobbyCode);
    };

    this.gameService.onGameFinished = (gameId, lobbyCode, result) => {
      this.server.to(`game:${lobbyCode}`).emit(GAME_EVENTS.RESULT, {
        gameId,
        winnerId: result.winnerId,
        pattern: result.pattern,
        winningCells: result.winningCells,
      });
    };
  }

  @SubscribeMessage(BINGO_EVENTS.MARK_NUMBER)
  async handleMarkNumber(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; number: number },
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;

    const result = await this.gameService.markNumber(
      data.gameId,
      user.sub,
      data.number,
    );

    if ('error' in result) {
      client.emit(GAME_EVENTS.ERROR, { message: result.error });
    } else {
      client.emit(GAME_EVENTS.STATE, { gameId: data.gameId, view: result.view });
    }
  }

  @SubscribeMessage(BINGO_EVENTS.CLAIM)
  async handleBingoClaim(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; lobbyCode: string },
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;

    const result = await this.gameService.claimBingo(
      data.gameId,
      user.sub,
      data.lobbyCode,
    );

    if ('error' in result) {
      client.emit(BINGO_EVENTS.CLAIM_REJECTED, { message: result.error });
    }
    // If valid, onGameFinished callback handles broadcasting
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
}
