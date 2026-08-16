import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { getCorsOrigins } from './shared';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // SECURITY_NOTE: Helmet sets various HTTP security headers
  app.use(helmet());

  app.enableCors({
    origin: getCorsOrigins(config.get<string>('CORS_ORIGIN')),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = config.get<number>('BACKEND_PORT', 8000);
  await app.listen(port);
  console.log(`Server running on port ${port}`);
}

bootstrap();
