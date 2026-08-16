import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from './cache/cache.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { LobbyModule } from './lobby/lobby.module';
import { GameModule } from './game/game.module';
import { VoiceModule } from './voice/voice.module';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    ScheduleModule.forRoot(),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>('DATABASE_URL');
        const isProduction = config.get('NODE_ENV') === 'production';
        const databaseSslCa = config.get<string>('DATABASE_SSL_CA');
        if (isProduction && !databaseSslCa) {
          throw new Error('DATABASE_SSL_CA is required in production');
        }
        const ssl = isProduction
          ? {
              ca: databaseSslCa!.replace(/\\n/g, '\n'),
              rejectUnauthorized: true,
            }
          : false;
        if (databaseUrl) {
          return {
            type: 'postgres',
            url: databaseUrl,
            ssl,
            autoLoadEntities: true,
            synchronize: !isProduction,
          };
        }
        return {
          type: 'postgres',
          host: config.get('DATABASE_HOST', 'localhost'),
          port: config.get<number>('DATABASE_PORT', 5432),
          username: config.get('DATABASE_USER', 'postgres'),
          password: config.get('DATABASE_PASSWORD', 'postgres_dev'),
          database: config.get('DATABASE_NAME', 'multiplayer_games'),
          ssl,
          autoLoadEntities: true,
          synchronize: !isProduction,
        };
      },
    }),

    ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),

    CacheModule,
    AuthModule,
    UserModule,
    LobbyModule,
    GameModule,
    VoiceModule,
  ],
})
export class AppModule {}
