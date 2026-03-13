import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { LobbyService } from './lobby.service';
import { getSocketUser } from '../auth/ws-jwt.guard';
import {
  LOBBY_EVENTS,
  GameType,
  CreateLobbyPayload,
  JoinLobbyPayload,
} from '@multiplayer-games/shared';

@WebSocketGateway({ cors: { origin: '*' } })
export class LobbyGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  /** Track which lobby each socket is in: socketId → lobbyCode */
  private socketLobbyMap = new Map<string, string>();

  constructor(
    private readonly lobbyService: LobbyService,
    private readonly jwtService: JwtService,
  ) {}

  handleConnection(client: Socket): void {
    const user = getSocketUser(client, this.jwtService);
    if (!user) {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const user = client.data?.user;
    const code = this.socketLobbyMap.get(client.id);
    if (user && code) {
      try {
        const lobby = await this.lobbyService.leaveLobby(code, user.sub);
        this.socketLobbyMap.delete(client.id);
        client.leave(`lobby:${code}`);
        if (lobby) {
          this.server.to(`lobby:${code}`).emit(LOBBY_EVENTS.STATE, { lobby });
        }
      } catch {
        // Player already cleaned up
      }
    }
  }

  @SubscribeMessage(LOBBY_EVENTS.CREATE)
  async handleCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CreateLobbyPayload,
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;

    try {
      const lobby = await this.lobbyService.createLobby(
        user.sub,
        data.gameType || GameType.BINGO,
        data.maxPlayers,
      );
      client.join(`lobby:${lobby.code}`);
      this.socketLobbyMap.set(client.id, lobby.code);
      client.emit(LOBBY_EVENTS.STATE, { lobby });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create lobby';
      client.emit(LOBBY_EVENTS.ERROR, { message, code: 'CREATE_FAILED' });
    }
  }

  @SubscribeMessage(LOBBY_EVENTS.JOIN)
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinLobbyPayload,
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;

    try {
      const lobby = await this.lobbyService.joinLobby(data.code, user.sub);
      client.join(`lobby:${lobby.code}`);
      this.socketLobbyMap.set(client.id, lobby.code);
      this.server.to(`lobby:${lobby.code}`).emit(LOBBY_EVENTS.STATE, { lobby });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to join lobby';
      client.emit(LOBBY_EVENTS.ERROR, { message, code: 'JOIN_FAILED' });
    }
  }

  @SubscribeMessage(LOBBY_EVENTS.LEAVE)
  async handleLeave(@ConnectedSocket() client: Socket): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;

    const code = this.socketLobbyMap.get(client.id);
    if (!code) return;

    try {
      const lobby = await this.lobbyService.leaveLobby(code, user.sub);
      this.socketLobbyMap.delete(client.id);
      client.leave(`lobby:${code}`);
      if (lobby) {
        this.server.to(`lobby:${code}`).emit(LOBBY_EVENTS.STATE, { lobby });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to leave lobby';
      client.emit(LOBBY_EVENTS.ERROR, { message, code: 'LEAVE_FAILED' });
    }
  }

  @SubscribeMessage(LOBBY_EVENTS.PLAYER_READY)
  async handleReady(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { ready: boolean },
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;

    const code = this.socketLobbyMap.get(client.id);
    if (!code) return;

    try {
      const lobby = await this.lobbyService.setReady(
        code,
        user.sub,
        data.ready,
      );
      this.server.to(`lobby:${code}`).emit(LOBBY_EVENTS.STATE, { lobby });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to set ready';
      client.emit(LOBBY_EVENTS.ERROR, { message, code: 'READY_FAILED' });
    }
  }

  @SubscribeMessage(LOBBY_EVENTS.START_GAME)
  async handleStartGame(@ConnectedSocket() client: Socket): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;

    const code = this.socketLobbyMap.get(client.id);
    if (!code) return;

    try {
      const lobby = await this.lobbyService.getLobby(code);
      if (!lobby) {
        client.emit(LOBBY_EVENTS.ERROR, {
          message: 'Lobby not found',
          code: 'NOT_FOUND',
        });
        return;
      }

      const check = this.lobbyService.canStartGame(lobby, user.sub);
      if (!check.ok) {
        client.emit(LOBBY_EVENTS.ERROR, {
          message: check.reason,
          code: 'START_FAILED',
        });
        return;
      }

      // Tell all clients the game is starting
      this.server
        .to(`lobby:${code}`)
        .emit(LOBBY_EVENTS.GAME_STARTING, { lobbyCode: code });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start game';
      client.emit(LOBBY_EVENTS.ERROR, { message, code: 'START_FAILED' });
    }
  }

  getSocketLobbyMap(): Map<string, string> {
    return this.socketLobbyMap;
  }
}
