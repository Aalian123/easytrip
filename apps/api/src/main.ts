import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import fastifyCookie from '@fastify/cookie';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { requestContext } from './context/request-context';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );

  await app.register(fastifyCookie as never);

  // One mutable store per request, entered before any Nest machinery runs. The
  // auth guard fills it in with the acting user, and the Prisma audit extension
  // reads it when writing the audit trail.
  app.getHttpAdapter().getInstance().addHook('onRequest', (_request, _reply, done) => {
    requestContext.enterWith({});
    done();
  });

  app.enableCors({
    origin: process.env.WEB_ORIGIN?.split(',') ?? ['http://localhost:3101'],
    credentials: true,
    // The CORS plugin allows only GET, HEAD and POST unless told otherwise,
    // which silently blocks every edit (PATCH) and delete from the browser.
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE'],
  });

  app.useGlobalFilters(new PrismaExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('EasyTrip API')
    .setDescription('Fleet and car rental management')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  const port = Number(process.env.API_PORT ?? 3100);
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`EasyTrip API listening on http://localhost:${port} (docs at /docs)`);
}

void bootstrap();
