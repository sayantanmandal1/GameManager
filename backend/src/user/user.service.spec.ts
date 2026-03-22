import { UserService } from './user.service';
import { UserEntity } from './user.entity';
import { Repository, LessThan } from 'typeorm';

describe('UserService', () => {
  let service: UserService;
  let mockRepo: Partial<Record<keyof Repository<UserEntity>, jest.Mock>>;

  beforeEach(() => {
    mockRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOneBy: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    service = new UserService(mockRepo as unknown as Repository<UserEntity>);
  });

  describe('createGuest', () => {
    it('should create a user with the given username and a random avatar', async () => {
      const fakeUser = { id: 'u1', username: 'TestPlayer', avatar: '🦊' } as UserEntity;
      mockRepo.create!.mockReturnValue(fakeUser);
      mockRepo.save!.mockResolvedValue(fakeUser);

      const result = await service.createGuest('TestPlayer');

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'TestPlayer' }),
      );
      expect(mockRepo.save).toHaveBeenCalledWith(fakeUser);
      expect(result).toEqual(fakeUser);
    });

    it('should assign an avatar from the AVATARS list', async () => {
      const fakeUser = { id: 'u1', username: 'Player', avatar: '🐱' } as UserEntity;
      mockRepo.create!.mockReturnValue(fakeUser);
      mockRepo.save!.mockResolvedValue(fakeUser);

      await service.createGuest('Player');

      const call = mockRepo.create!.mock.calls[0][0];
      expect(call.avatar).toBeDefined();
      expect(typeof call.avatar).toBe('string');
    });
  });

  describe('findById', () => {
    it('should return a user when found', async () => {
      const fakeUser = { id: 'u1', username: 'A' } as UserEntity;
      mockRepo.findOneBy!.mockResolvedValue(fakeUser);

      const result = await service.findById('u1');
      expect(result).toEqual(fakeUser);
      expect(mockRepo.findOneBy).toHaveBeenCalledWith({ id: 'u1' });
    });

    it('should return null when user not found', async () => {
      mockRepo.findOneBy!.mockResolvedValue(null);
      const result = await service.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('updateLastActive', () => {
    it('should update the lastActiveAt timestamp', async () => {
      mockRepo.update!.mockResolvedValue({ affected: 1 });

      await service.updateLastActive('u1');

      expect(mockRepo.update).toHaveBeenCalledWith('u1', {
        lastActiveAt: expect.any(Date),
      });
    });
  });

  describe('cleanupInactiveUsers', () => {
    it('should delete users inactive for over 1 hour', async () => {
      mockRepo.delete!.mockResolvedValue({ affected: 3 });

      await service.cleanupInactiveUsers();

      expect(mockRepo.delete).toHaveBeenCalledWith({
        lastActiveAt: expect.anything(),
      });
    });

    it('should not log when no users deleted', async () => {
      mockRepo.delete!.mockResolvedValue({ affected: 0 });

      await service.cleanupInactiveUsers();

      expect(mockRepo.delete).toHaveBeenCalled();
    });
  });
});
