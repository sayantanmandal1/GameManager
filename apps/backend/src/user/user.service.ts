import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './user.entity';
import { AVATARS } from '@multiplayer-games/shared';

@Injectable()
export class UserService {
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
}
