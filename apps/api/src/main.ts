import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  app.setGlobalPrefix('api');
  // API_PORT (not PORT) so tools that set PORT for the web dev server don't collide.
  const port = Number(process.env.API_PORT ?? 3001);
  // Bind to loopback only: this is a local, single-learner app.
  await app.listen(port, '127.0.0.1');
  console.log(`Study Tracker API on http://127.0.0.1:${port}/api`);
}
bootstrap();
