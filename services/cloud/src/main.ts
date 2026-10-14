import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule, port } from './app.module'

/** Arranque NestJS. La única parte, con app.module, atada al framework. */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log']
  })
  app.enableShutdownHooks()
  app.disable('x-powered-by')
  await app.listen(port)
}

void bootstrap()
