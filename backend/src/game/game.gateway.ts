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
import { GAME_EVENTS, BINGO_EVENTS } from '../shared';

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
    this.gameService.onStateChanged = (gameId, lobbyCode) => {
      this.broadcastPlayerViews(gameId, lobbyCode);
    };

    this.gameService.onGameFinished = (gameId, lobbyCode, result) => {
      // Send the final state (with winner) to all players, plus the result event
      this.broadcastPlayerViews(gameId, lobbyCode);
      this.server.to(`game:${lobbyCode}`).emit(GAME_EVENTS.RESULT, {
        gameId,
        winnerId: result.winnerId,
        completedLines: result.completedLines,
      });
    };
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

    const view = this.gameService.getPlayerView(gameId, user.sub);
    if (view) {
      client.emit(GAME_EVENTS.STATE, { gameId, view });
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
}
