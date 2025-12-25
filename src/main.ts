import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import Redis from 'ioredis'

import session from 'express-session';
import passport from 'passport';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Bootstrap the NestJS application: configure CORS, global pipes,
// Redis-backed session store, Passport initialization and start the server.
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  console.log('process.env:', process.env);

  app.enableCors({
    origin: ['http://localhost:3000'],
    credentials: true
  })

  app.setGlobalPrefix('secure/api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true
    })
  );
  
  const configService = app.get(ConfigService);

  const redisClient = new Redis({
    host: configService.get<string>('REDIS_HOST') as string,
    port: parseInt(configService.get<string>('REDIS_PORT') as string)
  });

  const connectRedisModule = require('connect-redis');

  let RedisStoreClass: any = null;
  try {
    if (typeof connectRedisModule === 'function') {
      RedisStoreClass = connectRedisModule(session);
    } else if (connectRedisModule && typeof connectRedisModule.default === 'function') {
      RedisStoreClass = connectRedisModule.default(session);
    } else if (connectRedisModule && typeof connectRedisModule.RedisStore === 'function') {
      RedisStoreClass = connectRedisModule.RedisStore(session);
    } else if (connectRedisModule && typeof connectRedisModule.default === 'object' && typeof connectRedisModule.default === 'function') {
      RedisStoreClass = connectRedisModule.default;
    }
  } catch (err) {
  }

  if (!RedisStoreClass) {
    const maybeDefault = connectRedisModule && (connectRedisModule.default ?? (connectRedisModule as any).ConnectRedis ?? (connectRedisModule as any).RedisStore);
    if (typeof maybeDefault === 'function') {
      try {
        RedisStoreClass = maybeDefault(session);
      } catch (e) {
        RedisStoreClass = maybeDefault;
      }
    }
  }

  if (!RedisStoreClass) {
    throw new Error('Failed to resolve RedisStore from connect-redis module. Please check the installed connect-redis version.');
  }

  let redisStoreInstance: any;
  try {
    redisStoreInstance = new RedisStoreClass({ client: redisClient });
  } catch (err) {
    redisStoreInstance = RedisStoreClass({ client: redisClient });
  }

  app.use(
    session({
      store: redisStoreInstance,
      secret: configService.get<string>('TOKEN_SECRET') as string,
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: parseInt(configService.get<string>('EXPIRE_IN') as string) },
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());

  await app.listen(parseInt(configService.get<string>('PORT') as string));
}
bootstrap();