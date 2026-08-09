import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { WsJwtGuard } from './ws-jwt.guard';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    UserModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret || secret === '<REPLACE_ME>' || secret.length < 32) {
          throw new Error('JWT_SECRET must contain at least 32 characters');
        }
        return {
          secret,
          signOptions: {
            expiresIn: config.get('JWT_EXPIRATION', '7d'),
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [WsJwtGuard],
  exports: [JwtModule, WsJwtGuard],
})
export class AuthModule {}
