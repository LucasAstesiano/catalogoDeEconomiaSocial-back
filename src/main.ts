import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  app.enableCors({
    origin: new RegExp(process.env.FRONTEND_URL ?? 'http://localhost:3000'),
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
