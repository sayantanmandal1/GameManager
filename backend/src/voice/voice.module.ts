import { Module } from '@nestjs/common';
import { VoiceGateway } from './voice.gateway';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [VoiceGateway],
})
export class VoiceModule {}
