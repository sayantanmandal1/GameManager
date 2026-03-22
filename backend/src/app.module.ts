import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { LobbyModule } from './lobby/lobby.module';
import { GameModule } from './game/game.module';
import { VoiceModule } from './voice/voice.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    ScheduleModule.forRoot(),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>('DATABASE_URL');
        const isProduction = config.get('NODE_ENV') === 'production';
        const needsSsl = databaseUrl && (databaseUrl.includes('?sslmode=require') || isProduction);
        
        if (databaseUrl) {
          return {
            type: 'postgres',
            url: databaseUrl,
            ssl: needsSsl ? { rejectUnauthorized: false } : false,
            autoLoadEntities: true,
            synchronize: config.get('NODE_ENV') !== 'production',
            extra: needsSsl ? {
              ssl: {
                rejectUnauthorized: false,
              },
            } : {},
          };
        }
        return {
          type: 'postgres',
          host: config.get('DATABASE_HOST', 'localhost'),
          port: config.get<number>('DATABASE_PORT', 5432),
          username: config.get('DATABASE_USER', 'postgres'),
          password: config.get('DATABASE_PASSWORD', 'postgres_dev'),
          database: config.get('DATABASE_NAME', 'multiplayer_games'),
          autoLoadEntities: true,
          synchronize: config.get('NODE_ENV') !== 'production',
        };
      },
    }),

    ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),

    RedisModule,
    AuthModule,
    UserModule,
    LobbyModule,
    GameModule,
    VoiceModule,
  ],
})
export class AppModule {}
