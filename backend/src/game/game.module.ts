import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameEntity } from './game.entity';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { LobbyModule } from '../lobby/lobby.module';
import { AuthModule } from '../auth/auth.module';
import { GameRegistry } from './game-registry';
import { GameCatalogController } from './game-catalog.controller';
import { DistinctGameLifecycle } from './distinct-game.lifecycle';

@Module({
  imports: [
    TypeOrmModule.forFeature([GameEntity]),
    forwardRef(() => LobbyModule),
    AuthModule,
  ],
  controllers: [GameCatalogController],
  providers: [GameService, GameGateway, GameRegistry, DistinctGameLifecycle],
  exports: [GameService, GameRegistry],
})
export class GameModule {}
