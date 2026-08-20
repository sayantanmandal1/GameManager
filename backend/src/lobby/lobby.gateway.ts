import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Inject, forwardRef } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { LobbyService } from './lobby.service';
import { GameService } from '../game/game.service';
import { UserService } from '../user/user.service';
import { getSocketUser } from '../auth/ws-jwt.guard';
import {
  LOBBY_EVENTS,
  GAME_EVENTS,
  CHESS_EVENTS,
  PHOTOBOOTH_EVENTS,
  UNO_EVENTS,
  TICTACTOE_EVENTS,
  CONNECTFOUR_EVENTS,
  DISTINCT_GAME_EVENTS,
  AUTH_EVENTS,
  GameType,
  LobbyStatus,
  CreateLobbyPayload,
  JoinLobbyPayload,
  LobbyTeam,
  getCorsOrigins,
} from '../shared';

@WebSocketGateway({ cors: { origin: getCorsOrigins(), credentials: true } })
export class LobbyGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  /** Track which lobby each socket is in: socketId → lobbyCode */
  private socketLobbyMap = new Map<string, string>();
  private rematchVotes = new Map<string, Set<string>>();

  constructor(
    private readonly lobbyService: LobbyService,
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => GameService))
    private readonly gameService: GameService,
    private readonly userService: UserService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) {
      client.emit(AUTH_EVENTS.SESSION_INVALID, { reason: 'invalid_token' });
      client.disconnect(true);
      return;
    }

    try {
      const storedUser = await this.userService.findById(user.sub);
      if (!storedUser) {
        client.emit(AUTH_EVENTS.SESSION_INVALID, { reason: 'user_not_found' });
        client.disconnect(true);
        return;
      }
      await this.userService.updateLastActive(user.sub);
    } catch {
      client.emit(AUTH_EVENTS.ERROR, { message: 'Session validation unavailable' });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const user = client.data?.user;
    const code = this.socketLobbyMap.get(client.id);
    if (user && code) {
      this.socketLobbyMap.delete(client.id);
      const votes = this.rematchVotes.get(code);
      if (user) votes?.delete(user.sub);
      client.leave(`lobby:${code}`);
      try {
        const currentLobby = await this.lobbyService.getLobby(code);
        // Active game gateways own disconnect presence and rejoin. Removing the
        // lobby member here would turn a returning player into a new joiner and
        // make the in-progress guard reject their reconnect.
        if (currentLobby?.status === LobbyStatus.IN_PROGRESS) return;

        const lobby = await this.lobbyService.leaveLobby(code, user.sub);
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
        data.timeControl ?? null,
        data.unoRules ?? null,
        data.tictactoeMode ?? null,
        data.gameKey ?? null,
      );
      client.join(`lobby:${lobby.code}`);
      this.socketLobbyMap.set(client.id, lobby.code);
      client.emit(LOBBY_EVENTS.STATE, { lobby });
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Failed to create lobby';
      // SECURITY_NOTE: map internal error strings to public codes; never leak
      // arbitrary error text that could carry internal detail.
      let code = 'CREATE_FAILED';
      let message = 'Failed to create lobby';
      if (raw === 'invalid_time_control') {
        code = 'INVALID_TIME_CONTROL';
        message =
          'baseMs and incrementMs must be non-negative integers within allowed range';
      } else if (raw === 'invalid_uno_rules') {
        code = 'INVALID_UNO_RULES';
        message = 'Invalid UNO rules';
      } else if (raw === 'invalid_tictactoe_mode') {
        code = 'INVALID_TICTACTOE_MODE';
        message = 'Invalid Tic Tac Toe mode';
      } else if (raw === 'invalid_game_type') {
        code = 'INVALID_GAME_TYPE';
        message = 'Invalid game type';
      } else if (raw === 'invalid_game_key') {
        code = 'INVALID_GAME_KEY';
        message = 'Invalid game selection';
      } else if (raw === 'mismatched_game_key') {
        code = 'MISMATCHED_GAME_KEY';
        message = 'Game selection does not match the game type';
      }
      client.emit(LOBBY_EVENTS.ERROR, { message, code });
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

      // Chess auto-start: exactly 2 players in a chess lobby triggers game creation.
      if (
        lobby.gameType === GameType.CHESS &&
        lobby.players.length === 2 &&
        lobby.status !== 'in_progress'
      ) {
        await this.autoStartChess(lobby.code);
      }
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
      this.rematchVotes.get(code)?.delete(user.sub);
      if (this.socketLobbyMap.get(client.id) === code) {
        this.socketLobbyMap.delete(client.id);
      }
      client.leave(`lobby:${code}`);
      client.emit(LOBBY_EVENTS.LEFT, { lobbyCode: code });
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

  @SubscribeMessage(LOBBY_EVENTS.TEAM_SELECT)
  async handleTeamSelect(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { team: LobbyTeam },
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;
    const code = this.socketLobbyMap.get(client.id);
    if (!code) return;

    try {
      const lobby = await this.lobbyService.setTeam(code, user.sub, data?.team);
      this.server.to(`lobby:${code}`).emit(LOBBY_EVENTS.STATE, { lobby });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to select team';
      client.emit(LOBBY_EVENTS.ERROR, { message, code: 'TEAM_FAILED' });
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
      this.rematchVotes.delete(code);

      // Start the game based on game type
      let gameId: string;
      if (lobby.gameType === GameType.LUDO) {
        const result = await this.gameService.startLudoGame(code);
        gameId = result.gameId;
      } else if (lobby.gameType === GameType.CHESS) {
        const result = await this.gameService.startChessGame(code);
        gameId = result.gameId;
      } else if (lobby.gameType === GameType.PHOTOBOOTH) {
        const result = await this.gameService.startPhotoboothGame(code);
        gameId = result.gameId;
      } else if (lobby.gameType === GameType.UNO) {
        const result = await this.gameService.startUnoGame(code);
        gameId = result.gameId;
      } else if (lobby.gameType === GameType.TICTACTOE) {
        const result = await this.gameService.startTicTacToeGame(code);
        gameId = result.gameId;
      } else if (lobby.gameType === GameType.CONNECTFOUR) {
        const result = await this.gameService.startConnectFourGame(code);
        gameId = result.gameId;
      } else if (lobby.gameType === GameType.DISTINCT) {
        const result = await this.gameService.startDistinctGame(code);
        gameId = result.gameId;
      } else {
        const result = await this.gameService.startBingoGame(code);
        gameId = result.gameId;
      }

      // Move all lobby sockets to the game room and send each player their view
      const lobbyRoom = `lobby:${code}`;
      const gameRoom = `game:${code}`;
      const sockets = await this.server.in(lobbyRoom).fetchSockets();

      for (const s of sockets) {
        s.join(gameRoom);
        const sUser = s.data?.user;
        if (sUser) {
          if (lobby.gameType === GameType.LUDO) {
            const view = this.gameService.getLudoPlayerView(gameId, sUser.sub);
            if (view) {
              s.emit(GAME_EVENTS.STATE, { gameId, view, gameType: GameType.LUDO });
            }
          } else if (lobby.gameType === GameType.CHESS) {
            const view = this.gameService.getChessView(gameId, sUser.sub);
            if (view) {
              s.emit(CHESS_EVENTS.STATE, { gameId, role: view.role, view });
            }
          } else if (lobby.gameType === GameType.PHOTOBOOTH) {
            const view = this.gameService.getPhotoboothPlayerView(
              gameId,
              sUser.sub,
            );
            if (view) {
              s.emit(PHOTOBOOTH_EVENTS.STATE, { gameId, view });
            }
          } else if (lobby.gameType === GameType.UNO) {
            const view = this.gameService.getUnoPlayerView(gameId, sUser.sub);
            if (view) {
              s.emit(UNO_EVENTS.STATE, { gameId, view });
            }
          } else if (lobby.gameType === GameType.TICTACTOE) {
            const view = this.gameService.getTicTacToePlayerView(gameId, sUser.sub);
            if (view) {
              s.emit(TICTACTOE_EVENTS.STATE, { gameId, lobbyCode: code, view });
            }
          } else if (lobby.gameType === GameType.CONNECTFOUR) {
            const view = this.gameService.getConnectFourPlayerView(gameId, sUser.sub);
            if (view) {
              s.emit(CONNECTFOUR_EVENTS.STATE, { gameId, lobbyCode: code, view });
            }
          } else if (lobby.gameType === GameType.DISTINCT) {
            const view = this.gameService.getDistinctPlayerView(gameId, sUser.sub);
            if (view && lobby.gameKey) {
              s.emit(DISTINCT_GAME_EVENTS.STATE, {
                gameId,
                lobbyCode: code,
                gameKey: lobby.gameKey,
                view,
              });
            }
          } else {
            const view = this.gameService.getPlayerView(gameId, sUser.sub);
            if (view) {
              s.emit(GAME_EVENTS.STATE, { gameId, view });
            }
          }
        }
      }

      // Tell all clients the game is starting (triggers frontend navigation)
      this.server
        .to(lobbyRoom)
        .emit(LOBBY_EVENTS.GAME_STARTING, { lobbyCode: code });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start game';
      client.emit(LOBBY_EVENTS.ERROR, { message, code: 'START_FAILED' });
    }
  }

  @SubscribeMessage(LOBBY_EVENTS.BACK_TO_LOBBY)
  async handleBackToLobby(@ConnectedSocket() client: Socket): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;

    const code = this.socketLobbyMap.get(client.id);
    if (!code) return;

    try {
      const lobby = await this.lobbyService.resetForNewGame(code);
      if (!lobby) return;

      // Broadcast the refreshed lobby to everyone
      this.server.to(`lobby:${code}`).emit(LOBBY_EVENTS.STATE, { lobby });
    } catch {
      // ignore
    }
  }

  @SubscribeMessage(LOBBY_EVENTS.REMATCH_REQUEST)
  async handleRematchRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { lobbyCode?: string } = {},
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;
    const requestedCode = data.lobbyCode;
    const code = /^\d{6}$/.test(requestedCode ?? '')
      ? requestedCode!
      : this.socketLobbyMap.get(client.id);
    if (!code) {
      client.emit(LOBBY_EVENTS.ERROR, { message: 'Lobby not found', code: 'NOT_FOUND' });
      return;
    }

    const lobby = await this.lobbyService.getLobby(code);
    if (!lobby || !lobby.players.some((player) => player.id === user.sub)) {
      client.emit(LOBBY_EVENTS.ERROR, { message: 'Lobby not found', code: 'NOT_FOUND' });
      return;
    }
    client.join(`lobby:${code}`);
    this.socketLobbyMap.set(client.id, code);
    if (lobby.status !== LobbyStatus.WAITING) {
      client.emit(LOBBY_EVENTS.ERROR, {
        message: 'Rematch is available after the current game ends',
        code: 'REMATCH_UNAVAILABLE',
      });
      return;
    }
    if (!this.gameService.getGameIdForLobby(code)) {
      client.emit(LOBBY_EVENTS.ERROR, {
        message: 'No completed game is available to replay',
        code: 'REMATCH_UNAVAILABLE',
      });
      return;
    }

    const votes = this.rematchVotes.get(code) ?? new Set<string>();
    votes.add(user.sub);
    this.rematchVotes.set(code, votes);
    this.server.to(`lobby:${code}`).emit(LOBBY_EVENTS.REMATCH_STATE, {
      requestedBy: [...votes],
      required: lobby.players.length,
    });

    if (votes.size !== lobby.players.length) return;
    const sockets = await this.server.in(`lobby:${code}`).fetchSockets();
    const hostSocket = sockets.find((socket) => socket.data?.user?.sub === lobby.hostId);
    if (!hostSocket) {
      client.emit(LOBBY_EVENTS.ERROR, {
        message: 'The host must be connected to restart',
        code: 'HOST_OFFLINE',
      });
      return;
    }

    for (const player of lobby.players) {
      if (!player.isHost && !player.isReady) {
        await this.lobbyService.setReady(code, player.id, true);
      }
    }

    this.rematchVotes.delete(code);
    this.server.to(`lobby:${code}`).emit(LOBBY_EVENTS.REMATCH_STATE, {
      requestedBy: [],
      required: lobby.players.length,
      starting: true,
    });
    await this.handleStartGame(hostSocket as unknown as Socket);
  }

  @SubscribeMessage(LOBBY_EVENTS.CHAT_MESSAGE)
  handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { message: string },
  ): void {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;

    const code = this.socketLobbyMap.get(client.id);
    if (!code) return;

    // Sanitize: limit length, strip dangerous content
    const message = (data.message || '').slice(0, 500).trim();
    if (!message) return;

    this.server.to(`lobby:${code}`).emit(LOBBY_EVENTS.CHAT_MESSAGE, {
      userId: user.sub,
      username: user.username,
      message,
      timestamp: Date.now(),
    });
  }

  getSocketLobbyMap(): Map<string, string> {
    return this.socketLobbyMap;
  }

  /**
   * Auto-start a chess game when exactly 2 players are present in the
   * lobby. Emits lobby:game_starting, joins the game room, and sends the
   * initial chess:state to each seat.
   */
  private async autoStartChess(code: string): Promise<void> {
    try {
      const result = await this.gameService.startChessGame(code);
      const gameId = result.gameId;

      const lobbyRoom = `lobby:${code}`;
      const gameRoom = `game:${code}`;
      const sockets = await this.server.in(lobbyRoom).fetchSockets();

      for (const s of sockets) {
        s.join(gameRoom);
        const sUser = s.data?.user;
        if (sUser) {
          const view = this.gameService.getChessView(gameId, sUser.sub);
          if (view) {
            s.emit(CHESS_EVENTS.STATE, { gameId, role: view.role, view });
          }
        }
      }
      this.server
        .to(lobbyRoom)
        .emit(LOBBY_EVENTS.GAME_STARTING, { lobbyCode: code });
    } catch {
      // Never surface internal errors to the room. Join handler already
      // broadcast lobby:state so clients can retry via lobby:start_game.
    }
  }
}
