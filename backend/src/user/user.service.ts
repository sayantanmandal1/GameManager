import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserEntity } from './user.entity';
import { AVATARS } from '../shared';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async createGuest(username: string): Promise<UserEntity> {
    const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
    const user = this.userRepo.create({ username, avatar });
    return this.userRepo.save(user);
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.userRepo.findOneBy({ id });
  }

  async updateLastActive(id: string): Promise<void> {
    await this.userRepo.update(id, { lastActiveAt: new Date() });
  }

  /** Runs every 15 minutes — deletes users inactive for over 1 hour */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async cleanupInactiveUsers(): Promise<void> {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    const result = await this.userRepo.delete({
      lastActiveAt: LessThan(cutoff),
    });
    if (result.affected && result.affected > 0) {
      this.logger.log(`Cleaned up ${result.affected} inactive user(s)`);
    }
  }
}
