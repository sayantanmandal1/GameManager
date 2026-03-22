import { AuthController } from './auth.controller';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { GuestLoginDto } from './dto/guest-login.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let mockUserService: Partial<Record<keyof UserService, jest.Mock>>;
  let mockJwtService: Partial<Record<keyof JwtService, jest.Mock>>;

  beforeEach(() => {
    mockUserService = {
      createGuest: jest.fn(),
    };
    mockJwtService = {
      sign: jest.fn(),
    };
    controller = new AuthController(
      mockUserService as unknown as UserService,
      mockJwtService as unknown as JwtService,
    );
  });

  describe('guestLogin', () => {
    it('should create a guest user and return user + token', async () => {
      const fakeUser = {
        id: 'u1',
        username: 'TestPlayer',
        avatar: '🦊',
        createdAt: new Date(),
        lastActiveAt: new Date(),
      };
      mockUserService.createGuest!.mockResolvedValue(fakeUser);
      mockJwtService.sign!.mockReturnValue('jwt-token-123');

      const dto: GuestLoginDto = { username: 'TestPlayer' };
      const result = await controller.guestLogin(dto);

      expect(result.user).toEqual({
        id: 'u1',
        username: 'TestPlayer',
        avatar: '🦊',
      });
      expect(result.token).toBe('jwt-token-123');
      expect(mockUserService.createGuest).toHaveBeenCalledWith('TestPlayer');
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: 'u1',
        username: 'TestPlayer',
      });
    });
  });
});
