import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error', 'warn', 'log'] });
  app.setGlobalPrefix('api');
  // Backups can be large; the default JSON body limit is 100kb.
  app.useBodyParser('json', { limit: '50mb' });
  // API_PORT (not PORT) so tools that set PORT for the web dev server don't collide.
  const port = Number(process.env.API_PORT ?? 3001);
  // Bind to loopback only: this is a local, single-learner app.
  await app.listen(port, '127.0.0.1');
  console.log(`LearnLog API on http://127.0.0.1:${port}/api`);
}
bootstrap();
