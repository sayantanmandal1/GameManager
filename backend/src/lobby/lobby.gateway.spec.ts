import { LobbyGateway } from './lobby.gateway';
import { LobbyService } from './lobby.service';
import { GameService } from '../game/game.service';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { AUTH_EVENTS, GameType, LOBBY_EVENTS, LobbyStatus } from '../shared';

describe('LobbyGateway connection handling', () => {
  let gateway: LobbyGateway;
  let lobbyService: {
    getLobby: jest.Mock;
    joinLobby: jest.Mock;
    leaveLobby: jest.Mock;
    removePlayer: jest.Mock;
    resetForNewGame: jest.Mock;
    setReady: jest.Mock;
    setTeam: jest.Mock;
  };
  let roomEmit: jest.Mock;
  let roomSockets: Array<ReturnType<typeof makeSocket>>;
  let gameService: { getGameIdForLobby: jest.Mock };
  let userService: {
    findById: jest.Mock;
    updateLastActive: jest.Mock;
  };

  const makeSocket = () => ({
    id: 'socket-1',
    data: { user: { sub: 'user-1', username: 'Alice' } },
    emit: jest.fn(),
    disconnect: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
  });

  beforeEach(() => {
    lobbyService = {
      getLobby: jest.fn(),
      joinLobby: jest.fn(),
      leaveLobby: jest.fn(),
      removePlayer: jest.fn(),
      resetForNewGame: jest.fn(),
      setReady: jest.fn().mockResolvedValue(undefined),
      setTeam: jest.fn(),
    };
    roomEmit = jest.fn();
    roomSockets = [];
    userService = {
      findById: jest.fn().mockResolvedValue({ id: 'user-1' }),
      updateLastActive: jest.fn().mockResolvedValue(undefined),
    };
    gameService = {
      getGameIdForLobby: jest.fn().mockReturnValue('game-1'),
    };
    gateway = new LobbyGateway(
      lobbyService as unknown as LobbyService,
      {} as JwtService,
      gameService as unknown as GameService,
      userService as unknown as UserService,
    );
    gateway.server = {
      to: jest.fn().mockReturnValue({ emit: roomEmit }),
      in: jest.fn().mockReturnValue({ fetchSockets: jest.fn().mockImplementation(async () => roomSockets) }),
    } as never;
  });

  it('accepts a persisted session whose guest user still exists', async () => {
    const socket = makeSocket();

    await gateway.handleConnection(socket as never);

    expect(userService.findById).toHaveBeenCalledWith('user-1');
    expect(userService.updateLastActive).toHaveBeenCalledWith('user-1');
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('invalidates a persisted session whose guest user was cleaned up', async () => {
    const socket = makeSocket();
    userService.findById.mockResolvedValue(null);

    await gateway.handleConnection(socket as never);

    expect(socket.emit).toHaveBeenCalledWith(AUTH_EVENTS.SESSION_INVALID, {
      reason: 'user_not_found',
    });
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('does not classify a database outage as an invalid user session', async () => {
    const socket = makeSocket();
    userService.findById.mockRejectedValue(new Error('database unavailable'));

    await gateway.handleConnection(socket as never);

    expect(socket.emit).toHaveBeenCalledWith(AUTH_EVENTS.ERROR, {
      message: 'Session validation unavailable',
    });
    expect(socket.emit).not.toHaveBeenCalledWith(
      AUTH_EVENTS.SESSION_INVALID,
      expect.anything(),
    );
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('does not let a stale leave completion erase a newer lobby mapping', async () => {
    const socket = makeSocket();
    let completeLeave!: (lobby: null) => void;
    lobbyService.leaveLobby.mockReturnValue(new Promise((resolve) => {
      completeLeave = resolve;
    }));
    gateway.getSocketLobbyMap().set(socket.id, '111111');

    const leaving = gateway.handleLeave(socket as never);
    await Promise.resolve();
    gateway.getSocketLobbyMap().set(socket.id, '222222');
    completeLeave(null);
    await leaving;

    expect(gateway.getSocketLobbyMap().get(socket.id)).toBe('222222');
    expect(socket.leave).toHaveBeenCalledWith('lobby:111111');
    expect(socket.emit).toHaveBeenCalledWith(LOBBY_EVENTS.LEFT, {
      lobbyCode: '111111',
    });
  });

  it('broadcasts rematch vote progress without restarting early', async () => {
    const socket = makeSocket();
    gateway.getSocketLobbyMap().set(socket.id, '123456');
    lobbyService.getLobby.mockResolvedValue({
      code: '123456',
      hostId: 'user-1',
      status: LobbyStatus.WAITING,
      players: [
        { id: 'user-1', isHost: true, isReady: false },
        { id: 'user-2', isHost: false, isReady: false },
      ],
    });
    const start = jest.spyOn(gateway, 'handleStartGame').mockResolvedValue();

    await gateway.handleRematchRequest(socket as never);

    expect(roomEmit).toHaveBeenCalledWith(LOBBY_EVENTS.REMATCH_STATE, {
      requestedBy: ['user-1'],
      required: 2,
    });
    expect(start).not.toHaveBeenCalled();
  });

  it('restores lobby-room membership when a refreshed player votes by code', async () => {
    const socket = makeSocket();
    lobbyService.getLobby.mockResolvedValue({
      code: '123456',
      hostId: 'user-1',
      status: LobbyStatus.WAITING,
      players: [
        { id: 'user-1', isHost: true, isReady: false },
        { id: 'user-2', isHost: false, isReady: false },
      ],
    });

    await gateway.handleRematchRequest(socket as never, { lobbyCode: '123456' });

    expect(socket.join).toHaveBeenCalledWith('lobby:123456');
    expect(gateway.getSocketLobbyMap().get(socket.id)).toBe('123456');
    expect(roomEmit).toHaveBeenCalledWith(LOBBY_EVENTS.REMATCH_STATE, {
      requestedBy: ['user-1'],
      required: 2,
    });
  });

  it('starts a fresh game through the host socket after every player votes', async () => {
    const hostSocket = makeSocket();
    const guestSocket = {
      ...makeSocket(),
      id: 'socket-2',
      data: { user: { sub: 'user-2', username: 'Bob' } },
    };
    gateway.getSocketLobbyMap().set(hostSocket.id, '123456');
    gateway.getSocketLobbyMap().set(guestSocket.id, '123456');
    roomSockets = [hostSocket, guestSocket];
    lobbyService.getLobby.mockResolvedValue({
      code: '123456',
      hostId: 'user-1',
      status: LobbyStatus.WAITING,
      players: [
        { id: 'user-1', isHost: true, isReady: false },
        { id: 'user-2', isHost: false, isReady: false },
      ],
    });
    const start = jest.spyOn(gateway, 'handleStartGame').mockResolvedValue();

    await gateway.handleRematchRequest(hostSocket as never);
    await gateway.handleRematchRequest(guestSocket as never);

    expect(roomEmit).toHaveBeenCalledWith(LOBBY_EVENTS.REMATCH_STATE, {
      requestedBy: [],
      required: 2,
      starting: true,
    });
    expect(start).toHaveBeenCalledWith(hostSocket);
    expect(lobbyService.setReady).toHaveBeenCalledWith('123456', 'user-2', true);
  });

  it('rejects rematch votes before the current game ends', async () => {
    const socket = makeSocket();
    gateway.getSocketLobbyMap().set(socket.id, '123456');
    lobbyService.getLobby.mockResolvedValue({
      code: '123456',
      hostId: 'user-1',
      status: LobbyStatus.IN_PROGRESS,
      players: [{ id: 'user-1' }, { id: 'user-2' }],
    });

    await gateway.handleRematchRequest(socket as never);

    expect(socket.emit).toHaveBeenCalledWith(LOBBY_EVENTS.ERROR, {
      message: 'Rematch is available after the current game ends',
      code: 'REMATCH_UNAVAILABLE',
    });
  });

  it('does not let rematch voting bypass the first game ready flow', async () => {
    const socket = makeSocket();
    gateway.getSocketLobbyMap().set(socket.id, '123456');
    gameService.getGameIdForLobby.mockReturnValue(undefined);
    lobbyService.getLobby.mockResolvedValue({
      code: '123456',
      hostId: 'user-1',
      status: LobbyStatus.WAITING,
      players: [{ id: 'user-1' }, { id: 'user-2' }],
    });

    await gateway.handleRematchRequest(socket as never, { lobbyCode: '123456' });

    expect(socket.emit).toHaveBeenCalledWith(LOBBY_EVENTS.ERROR, {
      message: 'No completed game is available to replay',
      code: 'REMATCH_UNAVAILABLE',
    });
  });

  it('preserves membership when a player disconnects during an active game', async () => {
    const socket = makeSocket();
    gateway.getSocketLobbyMap().set(socket.id, '123456');
    lobbyService.getLobby.mockResolvedValue({
      code: '123456',
      status: LobbyStatus.IN_PROGRESS,
    });

    await gateway.handleDisconnect(socket as never);

    expect(lobbyService.leaveLobby).not.toHaveBeenCalled();
    expect(socket.leave).toHaveBeenCalledWith('lobby:123456');
    expect(gateway.getSocketLobbyMap().has(socket.id)).toBe(false);
  });

  it('preserves the active seat on explicit leave and acknowledges detach', async () => {
    const socket = makeSocket();
    gateway.getSocketLobbyMap().set(socket.id, '123456');
    lobbyService.getLobby.mockResolvedValue({
      code: '123456',
      status: LobbyStatus.IN_PROGRESS,
    });

    await gateway.handleLeave(socket as never);

    expect(lobbyService.leaveLobby).not.toHaveBeenCalled();
    expect(gateway.getSocketLobbyMap().has(socket.id)).toBe(false);
    expect(socket.leave).toHaveBeenCalledWith('lobby:123456');
    expect(socket.leave).toHaveBeenCalledWith('game:123456');
    expect(socket.emit).toHaveBeenCalledWith(LOBBY_EVENTS.LEFT, {
      lobbyCode: '123456',
      seatPreserved: true,
    });
  });

  it('routes an existing member back to an in-progress game', async () => {
    const socket = makeSocket();
    const lobby = {
      code: '123456',
      status: LobbyStatus.IN_PROGRESS,
      gameType: GameType.DISTINCT,
      gameKey: 'contract-bridge',
      players: [{ id: 'user-1' }, { id: 'user-2' }],
    };
    lobbyService.joinLobby.mockResolvedValue(lobby);

    await gateway.handleJoin(socket as never, { code: '123456' });

    expect(socket.join).toHaveBeenCalledWith('lobby:123456');
    expect(gateway.getSocketLobbyMap().get(socket.id)).toBe('123456');
    expect(roomEmit).toHaveBeenCalledWith(LOBBY_EVENTS.STATE, { lobby });
    expect(socket.emit).toHaveBeenCalledWith(LOBBY_EVENTS.GAME_STARTING, {
      lobbyCode: '123456',
    });
  });

  it('does not reset an in-progress lobby when a client requests back-to-lobby', async () => {
    const socket = makeSocket();
    const lobby = {
      code: '123456',
      status: LobbyStatus.IN_PROGRESS,
      players: [{ id: 'user-1' }],
    };
    gateway.getSocketLobbyMap().set(socket.id, '123456');
    lobbyService.getLobby.mockResolvedValue(lobby);

    await gateway.handleBackToLobby(socket as never);

    expect(lobbyService.resetForNewGame).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith(LOBBY_EVENTS.STATE, { lobby });
    expect(socket.join).toHaveBeenCalledWith('lobby:123456');
  });

  it('removes a waiting-room member on host request and ejects every target socket', async () => {
    const hostSocket = makeSocket();
    const targetSocket = {
      ...makeSocket(),
      id: 'socket-2',
      data: { user: { sub: 'user-2', username: 'Bob' } },
    };
    const lobby = { code: '123456', status: LobbyStatus.WAITING, players: [{ id: 'user-1' }] };
    gateway.getSocketLobbyMap().set(hostSocket.id, '123456');
    gateway.getSocketLobbyMap().set(targetSocket.id, '123456');
    roomSockets = [hostSocket, targetSocket];
    lobbyService.removePlayer.mockResolvedValue(lobby);

    await gateway.handleRemovePlayer(hostSocket as never, { targetUserId: 'user-2' });

    expect(lobbyService.removePlayer).toHaveBeenCalledWith('123456', 'user-1', 'user-2');
    expect(targetSocket.leave).toHaveBeenCalledWith('lobby:123456');
    expect(targetSocket.emit).toHaveBeenCalledWith(LOBBY_EVENTS.REMOVED, {
      lobbyCode: '123456',
    });
    expect(gateway.getSocketLobbyMap().has(targetSocket.id)).toBe(false);
    expect(roomEmit).toHaveBeenCalledWith(LOBBY_EVENTS.STATE, { lobby });
  });

  it('reports a rejected removal without changing room membership', async () => {
    const socket = makeSocket();
    gateway.getSocketLobbyMap().set(socket.id, '123456');
    lobbyService.removePlayer.mockRejectedValue(new Error('Only the host can remove players'));

    await gateway.handleRemovePlayer(socket as never, { targetUserId: 'user-2' });

    expect(socket.emit).toHaveBeenCalledWith(LOBBY_EVENTS.ERROR, {
      message: 'Only the host can remove players',
      code: 'REMOVE_FAILED',
    });
    expect(roomEmit).not.toHaveBeenCalledWith(LOBBY_EVENTS.STATE, expect.anything());
  });

  it('removes a disconnected player from a waiting lobby and broadcasts state', async () => {
    const socket = makeSocket();
    const lobby = { code: '123456', status: LobbyStatus.WAITING };
    gateway.getSocketLobbyMap().set(socket.id, '123456');
    lobbyService.getLobby.mockResolvedValue(lobby);
    lobbyService.leaveLobby.mockResolvedValue(lobby);

    await gateway.handleDisconnect(socket as never);

    expect(lobbyService.leaveLobby).toHaveBeenCalledWith('123456', 'user-1');
    expect(roomEmit).toHaveBeenCalledWith(LOBBY_EVENTS.STATE, { lobby });
    expect(socket.leave).toHaveBeenCalledWith('lobby:123456');
  });

  it('broadcasts an accepted team selection', async () => {
    const socket = makeSocket();
    const lobby = { code: '123456', players: [{ id: 'user-1', team: 1 }] };
    gateway.getSocketLobbyMap().set(socket.id, '123456');
    lobbyService.setTeam.mockResolvedValue(lobby);

    await gateway.handleTeamSelect(socket as never, { team: 1 });

    expect(lobbyService.setTeam).toHaveBeenCalledWith('123456', 'user-1', 1);
    expect(roomEmit).toHaveBeenCalledWith(LOBBY_EVENTS.STATE, { lobby });
  });

  it('rejects a forged team without broadcasting state', async () => {
    const socket = makeSocket();
    gateway.getSocketLobbyMap().set(socket.id, '123456');
    lobbyService.setTeam.mockRejectedValue(new Error('Invalid team'));

    await gateway.handleTeamSelect(socket as never, { team: 9 as never });

    expect(socket.emit).toHaveBeenCalledWith(LOBBY_EVENTS.ERROR, {
      message: 'Invalid team',
      code: 'TEAM_FAILED',
    });
    expect(roomEmit).not.toHaveBeenCalledWith(LOBBY_EVENTS.STATE, expect.anything());
  });
});