import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LobbyEntity } from './lobby.entity';
import { LobbyService } from './lobby.service';
import { LobbyGateway } from './lobby.gateway';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([LobbyEntity]), AuthModule, UserModule],
  providers: [LobbyService, LobbyGateway],
  exports: [LobbyService, LobbyGateway],
})
export class LobbyModule {}
