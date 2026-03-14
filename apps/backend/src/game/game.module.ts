import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameEntity } from './game.entity';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { LobbyModule } from '../lobby/lobby.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GameEntity]),
    forwardRef(() => LobbyModule),
    AuthModule,
  ],
  providers: [GameService, GameGateway],
  exports: [GameService],
})
export class GameModule {}
