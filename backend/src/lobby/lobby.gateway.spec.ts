import { LobbyGateway } from './lobby.gateway';
import { LobbyService } from './lobby.service';
import { GameService } from '../game/game.service';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { LOBBY_EVENTS, LobbyStatus } from '../shared';

describe('LobbyGateway disconnect handling', () => {
  let gateway: LobbyGateway;
  let lobbyService: {
    getLobby: jest.Mock;
    leaveLobby: jest.Mock;
  };
  let roomEmit: jest.Mock;

  const makeSocket = () => ({
    id: 'socket-1',
    data: { user: { sub: 'user-1', username: 'Alice' } },
    leave: jest.fn(),
  });

  beforeEach(() => {
    lobbyService = {
      getLobby: jest.fn(),
      leaveLobby: jest.fn(),
    };
    roomEmit = jest.fn();
    gateway = new LobbyGateway(
      lobbyService as unknown as LobbyService,
      {} as JwtService,
      {} as GameService,
      {} as UserService,
    );
    gateway.server = {
      to: jest.fn().mockReturnValue({ emit: roomEmit }),
    } as never;
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
});