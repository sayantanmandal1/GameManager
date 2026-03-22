import { WsJwtGuard, getSocketUser, JwtPayload } from './ws-jwt.guard';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';

describe('WsJwtGuard / getSocketUser', () => {
  let mockJwtService: Partial<Record<keyof JwtService, jest.Mock>>;

  beforeEach(() => {
    mockJwtService = {
      verify: jest.fn(),
    };
  });

  function createMockSocket(overrides: Partial<Socket> = {}): Socket {
    return {
      data: {},
      handshake: {
        auth: {},
        headers: {},
      },
      ...overrides,
    } as unknown as Socket;
  }

  describe('getSocketUser', () => {
    it('should return cached user from socket.data', () => {
      const cachedUser: JwtPayload = { sub: 'u1', username: 'Alice' };
      const client = createMockSocket({ data: { user: cachedUser } });

      const result = getSocketUser(client, mockJwtService as unknown as JwtService);
      expect(result).toEqual(cachedUser);
      expect(mockJwtService.verify).not.toHaveBeenCalled();
    });

    it('should verify token from handshake.auth.token', () => {
      const payload: JwtPayload = { sub: 'u1', username: 'Alice' };
      mockJwtService.verify!.mockReturnValue(payload);

      const client = createMockSocket({
        handshake: { auth: { token: 'valid-token' }, headers: {} } as any,
      });

      const result = getSocketUser(client, mockJwtService as unknown as JwtService);
      expect(result).toEqual(payload);
      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-token');
    });

    it('should verify token from authorization header', () => {
      const payload: JwtPayload = { sub: 'u1', username: 'Alice' };
      mockJwtService.verify!.mockReturnValue(payload);

      const client = createMockSocket({
        handshake: {
          auth: {},
          headers: { authorization: 'Bearer jwt-token' },
        } as any,
      });

      const result = getSocketUser(client, mockJwtService as unknown as JwtService);
      expect(result).toEqual(payload);
      expect(mockJwtService.verify).toHaveBeenCalledWith('jwt-token');
    });

    it('should return null when no token present', () => {
      const client = createMockSocket();
      const result = getSocketUser(client, mockJwtService as unknown as JwtService);
      expect(result).toBeNull();
    });

    it('should return null when token verification fails', () => {
      mockJwtService.verify!.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const client = createMockSocket({
        handshake: { auth: { token: 'invalid-token' }, headers: {} } as any,
      });

      const result = getSocketUser(client, mockJwtService as unknown as JwtService);
      expect(result).toBeNull();
    });

    it('should cache verified user on socket.data', () => {
      const payload: JwtPayload = { sub: 'u1', username: 'Alice' };
      mockJwtService.verify!.mockReturnValue(payload);

      const client = createMockSocket({
        handshake: { auth: { token: 'valid-token' }, headers: {} } as any,
      });

      getSocketUser(client, mockJwtService as unknown as JwtService);
      expect(client.data.user).toEqual(payload);
    });
  });

  describe('WsJwtGuard.canActivate', () => {
    it('should return true when user is authenticated', () => {
      const guard = new WsJwtGuard(mockJwtService as unknown as JwtService);
      const payload: JwtPayload = { sub: 'u1', username: 'Alice' };

      const mockContext = {
        switchToWs: () => ({
          getClient: () => createMockSocket({ data: { user: payload } }),
        }),
      };

      expect(guard.canActivate(mockContext as any)).toBe(true);
    });

    it('should return false when no user', () => {
      const guard = new WsJwtGuard(mockJwtService as unknown as JwtService);

      const mockContext = {
        switchToWs: () => ({
          getClient: () => createMockSocket(),
        }),
      };

      expect(guard.canActivate(mockContext as any)).toBe(false);
    });
  });
});
