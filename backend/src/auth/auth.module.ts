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
      useFactory: (config: ConfigService) => ({
        // SECURITY_NOTE: JWT_SECRET must be a strong, unique value in production
        secret: config.get('JWT_SECRET', 'dev-jwt-secret-change-in-prod'),
        signOptions: {
          expiresIn: config.get('JWT_EXPIRATION', '7d'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [WsJwtGuard],
  exports: [JwtModule, WsJwtGuard],
})
export class AuthModule {}
