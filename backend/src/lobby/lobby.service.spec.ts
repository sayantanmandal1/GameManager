import { LobbyService } from './lobby.service';
import { LobbyEntity } from './lobby.entity';
import { UserService } from '../user/user.service';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { LobbyStatus, GameType, Lobby, GAME_CONSTANTS } from '../shared';

describe('LobbyService', () => {
  let service: LobbyService;
  let mockLobbyRepo: Partial<Record<keyof Repository<LobbyEntity>, jest.Mock>>;
  let mockRedis: Partial<Record<'get' | 'set' | 'del', jest.Mock>>;
  let mockUserService: Partial<Record<keyof UserService, jest.Mock>>;
  let mockConfigService: Partial<Record<keyof ConfigService, jest.Mock>>;

  const fakeUser = {
    id: 'user1',
    username: 'Alice',
    avatar: '🦊',
    createdAt: new Date(),
    lastActiveAt: new Date(),
  };

  beforeEach(() => {
    mockLobbyRepo = {
      create: jest.fn().mockImplementation((data) => ({ ...data })),
      save: jest.fn().mockImplementation((data) => Promise.resolve({ ...data, id: 'lobby1' })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    mockRedis = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };
    mockUserService = {
      findById: jest.fn(),
      createGuest: jest.fn(),
      updateLastActive: jest.fn(),
    };
    mockConfigService = {
      get: jest.fn().mockReturnValue(GAME_CONSTANTS.LOBBY_TTL_SECONDS),
    };

    service = new LobbyService(
      mockLobbyRepo as unknown as Repository<LobbyEntity>,
      mockRedis as unknown as Redis,
      mockUserService as unknown as UserService,
      mockConfigService as unknown as ConfigService,
    );
  });

  describe('createLobby', () => {
    it('should create a lobby and persist to Redis and DB', async () => {
      mockUserService.findById!.mockResolvedValue(fakeUser);

      const lobby = await service.createLobby('user1', GameType.BINGO);

      expect(lobby.code).toBeDefined();
      expect(lobby.code).toHaveLength(6);
      expect(lobby.hostId).toBe('user1');
      expect(lobby.gameType).toBe(GameType.BINGO);
      expect(lobby.players).toHaveLength(1);
      expect(lobby.players[0].isHost).toBe(true);
      expect(lobby.status).toBe(LobbyStatus.WAITING);
      expect(mockLobbyRepo.save).toHaveBeenCalled();
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('should throw if user not found', async () => {
      mockUserService.findById!.mockResolvedValue(null);
      await expect(service.createLobby('nonexistent', GameType.BINGO)).rejects.toThrow('User not found');
    });
  });

  describe('getLobby', () => {
    it('should return a lobby from Redis cache', async () => {
      const fakeLobby: Lobby = {
        id: 'lobby1',
        code: '123456',
        hostId: 'user1',
        gameType: GameType.BINGO,
        players: [],
        status: LobbyStatus.WAITING,
        maxPlayers: 8,
        createdAt: new Date(),
      };
      mockRedis.get!.mockResolvedValue(JSON.stringify(fakeLobby));

      const lobby = await service.getLobby('123456');
      expect(lobby).toBeTruthy();
      expect(lobby!.code).toBe('123456');
    });

    it('should return null when not in cache', async () => {
      mockRedis.get!.mockResolvedValue(null);
      const lobby = await service.getLobby('000000');
      expect(lobby).toBeNull();
    });
  });

  describe('joinLobby', () => {
    it('should add a player to the lobby', async () => {
      const fakeLobby: Lobby = {
        id: 'lobby1',
        code: '123456',
        hostId: 'user1',
        gameType: GameType.BINGO,
        players: [{ id: 'user1', username: 'Alice', avatar: '🦊', isReady: false, isHost: true, joinedAt: new Date() }],
        status: LobbyStatus.WAITING,
        maxPlayers: 8,
        createdAt: new Date(),
      };
      mockRedis.get!.mockResolvedValue(JSON.stringify(fakeLobby));
      mockUserService.findById!.mockResolvedValue({
        id: 'user2',
        username: 'Bob',
        avatar: '🐱',
        createdAt: new Date(),
        lastActiveAt: new Date(),
      });

      const result = await service.joinLobby('123456', 'user2');
      expect(result.players).toHaveLength(2);
      expect(result.players[1].id).toBe('user2');
    });

    it('should return current lobby if player is already in it (reconnect)', async () => {
      const fakeLobby: Lobby = {
        id: 'lobby1',
        code: '123456',
        hostId: 'user1',
        gameType: GameType.BINGO,
        players: [{ id: 'user1', username: 'Alice', avatar: '🦊', isReady: false, isHost: true, joinedAt: new Date() }],
        status: LobbyStatus.WAITING,
        maxPlayers: 8,
        createdAt: new Date(),
      };
      mockRedis.get!.mockResolvedValue(JSON.stringify(fakeLobby));

      const result = await service.joinLobby('123456', 'user1');
      expect(result.players).toHaveLength(1); // No duplicate
    });

    it('should throw if lobby not found', async () => {
      mockRedis.get!.mockResolvedValue(null);
      await expect(service.joinLobby('000000', 'user1')).rejects.toThrow('Lobby not found');
    });

    it('should throw if lobby is in progress', async () => {
      const fakeLobby: Lobby = {
        id: 'lobby1',
        code: '123456',
        hostId: 'user1',
        gameType: GameType.BINGO,
        players: [{ id: 'user1', username: 'Alice', avatar: '🦊', isReady: false, isHost: true, joinedAt: new Date() }],
        status: LobbyStatus.IN_PROGRESS,
        maxPlayers: 8,
        createdAt: new Date(),
      };
      mockRedis.get!.mockResolvedValue(JSON.stringify(fakeLobby));

      await expect(service.joinLobby('123456', 'user2')).rejects.toThrow('Game already in progress');
    });

    it('should throw if lobby is full', async () => {
      const fakeLobby: Lobby = {
        id: 'lobby1',
        code: '123456',
        hostId: 'user1',
        gameType: GameType.BINGO,
        players: [
          { id: 'user1', username: 'Alice', avatar: '🦊', isReady: false, isHost: true, joinedAt: new Date() },
          { id: 'user2', username: 'Bob', avatar: '🐱', isReady: false, isHost: false, joinedAt: new Date() },
        ],
        status: LobbyStatus.WAITING,
        maxPlayers: 2,
        createdAt: new Date(),
      };
      mockRedis.get!.mockResolvedValue(JSON.stringify(fakeLobby));

      await expect(service.joinLobby('123456', 'user3')).rejects.toThrow('Lobby is full');
    });
  });

  describe('leaveLobby', () => {
    it('should remove a player from the lobby', async () => {
      const fakeLobby: Lobby = {
        id: 'lobby1',
        code: '123456',
        hostId: 'user1',
        gameType: GameType.BINGO,
        players: [
          { id: 'user1', username: 'Alice', avatar: '🦊', isReady: false, isHost: true, joinedAt: new Date() },
          { id: 'user2', username: 'Bob', avatar: '🐱', isReady: false, isHost: false, joinedAt: new Date() },
        ],
        status: LobbyStatus.WAITING,
        maxPlayers: 8,
        createdAt: new Date(),
      };
      mockRedis.get!.mockResolvedValue(JSON.stringify(fakeLobby));

      const result = await service.leaveLobby('123456', 'user2');
      expect(result).toBeTruthy();
      expect(result!.players).toHaveLength(1);
    });

    it('should delete lobby and return null when last player leaves', async () => {
      const fakeLobby: Lobby = {
        id: 'lobby1',
        code: '123456',
        hostId: 'user1',
        gameType: GameType.BINGO,
        players: [
          { id: 'user1', username: 'Alice', avatar: '🦊', isReady: false, isHost: true, joinedAt: new Date() },
        ],
        status: LobbyStatus.WAITING,
        maxPlayers: 8,
        createdAt: new Date(),
      };
      mockRedis.get!.mockResolvedValue(JSON.stringify(fakeLobby));

      const result = await service.leaveLobby('123456', 'user1');
      expect(result).toBeNull();
      expect(mockRedis.del).toHaveBeenCalledWith('lobby:123456');
    });

    it('should transfer host when host leaves', async () => {
      const fakeLobby: Lobby = {
        id: 'lobby1',
        code: '123456',
        hostId: 'user1',
        gameType: GameType.BINGO,
        players: [
          { id: 'user1', username: 'Alice', avatar: '🦊', isReady: false, isHost: true, joinedAt: new Date() },
          { id: 'user2', username: 'Bob', avatar: '🐱', isReady: false, isHost: false, joinedAt: new Date() },
        ],
        status: LobbyStatus.WAITING,
        maxPlayers: 8,
        createdAt: new Date(),
      };
      mockRedis.get!.mockResolvedValue(JSON.stringify(fakeLobby));

      const result = await service.leaveLobby('123456', 'user1');
      expect(result).toBeTruthy();
      expect(result!.hostId).toBe('user2');
      expect(result!.players[0].isHost).toBe(true);
    });
  });

  describe('setReady', () => {
    it('should toggle a player ready status', async () => {
      const fakeLobby: Lobby = {
        id: 'lobby1',
        code: '123456',
        hostId: 'user1',
        gameType: GameType.BINGO,
        players: [
          { id: 'user1', username: 'Alice', avatar: '🦊', isReady: false, isHost: true, joinedAt: new Date() },
          { id: 'user2', username: 'Bob', avatar: '🐱', isReady: false, isHost: false, joinedAt: new Date() },
        ],
        status: LobbyStatus.WAITING,
        maxPlayers: 8,
        createdAt: new Date(),
      };
      mockRedis.get!.mockResolvedValue(JSON.stringify(fakeLobby));

      const result = await service.setReady('123456', 'user2', true);
      expect(result.players.find((p) => p.id === 'user2')?.isReady).toBe(true);
    });

    it('should throw if player not in lobby', async () => {
      const fakeLobby: Lobby = {
        id: 'lobby1',
        code: '123456',
        hostId: 'user1',
        gameType: GameType.BINGO,
        players: [{ id: 'user1', username: 'Alice', avatar: '🦊', isReady: false, isHost: true, joinedAt: new Date() }],
        status: LobbyStatus.WAITING,
        maxPlayers: 8,
        createdAt: new Date(),
      };
      mockRedis.get!.mockResolvedValue(JSON.stringify(fakeLobby));

      await expect(service.setReady('123456', 'user99', true)).rejects.toThrow('Not in lobby');
    });
  });

  describe('canStartGame', () => {
    it('should return ok when host starts with all ready', () => {
      const lobby: Lobby = {
        id: 'lobby1',
        code: '123456',
        hostId: 'user1',
        gameType: GameType.BINGO,
        players: [
          { id: 'user1', username: 'Alice', avatar: '🦊', isReady: false, isHost: true, joinedAt: new Date() },
          { id: 'user2', username: 'Bob', avatar: '🐱', isReady: true, isHost: false, joinedAt: new Date() },
        ],
        status: LobbyStatus.WAITING,
        maxPlayers: 8,
        createdAt: new Date(),
      };

      expect(service.canStartGame(lobby, 'user1')).toEqual({ ok: true });
    });

    it('should reject if not the host', () => {
      const lobby: Lobby = {
        id: 'lobby1',
        code: '123456',
        hostId: 'user1',
        gameType: GameType.BINGO,
        players: [
          { id: 'user1', username: 'Alice', avatar: '🦊', isReady: false, isHost: true, joinedAt: new Date() },
          { id: 'user2', username: 'Bob', avatar: '🐱', isReady: true, isHost: false, joinedAt: new Date() },
        ],
        status: LobbyStatus.WAITING,
        maxPlayers: 8,
        createdAt: new Date(),
      };

      const result = service.canStartGame(lobby, 'user2');
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('host');
    });

    it('should reject with fewer than min players', () => {
      const lobby: Lobby = {
        id: 'lobby1',
        code: '123456',
        hostId: 'user1',
        gameType: GameType.BINGO,
        players: [
          { id: 'user1', username: 'Alice', avatar: '🦊', isReady: false, isHost: true, joinedAt: new Date() },
        ],
        status: LobbyStatus.WAITING,
        maxPlayers: 8,
        createdAt: new Date(),
      };

      const result = service.canStartGame(lobby, 'user1');
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('at least');
    });

    it('should reject when not all players are ready', () => {
      const lobby: Lobby = {
        id: 'lobby1',
        code: '123456',
        hostId: 'user1',
        gameType: GameType.BINGO,
        players: [
          { id: 'user1', username: 'Alice', avatar: '🦊', isReady: false, isHost: true, joinedAt: new Date() },
          { id: 'user2', username: 'Bob', avatar: '🐱', isReady: false, isHost: false, joinedAt: new Date() },
        ],
        status: LobbyStatus.WAITING,
        maxPlayers: 8,
        createdAt: new Date(),
      };

      const result = service.canStartGame(lobby, 'user1');
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('ready');
    });
  });

  describe('setStatus', () => {
    it('should update lobby status in Redis and DB', async () => {
      const fakeLobby: Lobby = {
        id: 'lobby1',
        code: '123456',
        hostId: 'user1',
        gameType: GameType.BINGO,
        players: [],
        status: LobbyStatus.WAITING,
        maxPlayers: 8,
        createdAt: new Date(),
      };
      mockRedis.get!.mockResolvedValue(JSON.stringify(fakeLobby));

      await service.setStatus('123456', LobbyStatus.IN_PROGRESS);

      expect(mockRedis.set).toHaveBeenCalled();
      expect(mockLobbyRepo.update).toHaveBeenCalledWith(
        { code: '123456' },
        { status: LobbyStatus.IN_PROGRESS },
      );
    });
  });

  describe('resetForNewGame', () => {
    it('should reset lobby status and clear ready flags', async () => {
      const fakeLobby: Lobby = {
        id: 'lobby1',
        code: '123456',
        hostId: 'user1',
        gameType: GameType.BINGO,
        players: [
          { id: 'user1', username: 'Alice', avatar: '🦊', isReady: true, isHost: true, joinedAt: new Date() },
          { id: 'user2', username: 'Bob', avatar: '🐱', isReady: true, isHost: false, joinedAt: new Date() },
        ],
        status: LobbyStatus.IN_PROGRESS,
        maxPlayers: 8,
        createdAt: new Date(),
      };
      mockRedis.get!.mockResolvedValue(JSON.stringify(fakeLobby));

      const result = await service.resetForNewGame('123456');
      expect(result).toBeTruthy();
      expect(result!.status).toBe(LobbyStatus.WAITING);
      expect(result!.players.every((p) => p.isReady === false)).toBe(true);
    });
  });
});
