import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import { createClient } from 'redis'

import session from 'express-session';
import passport from 'passport';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Bootstrap the NestJS application: configure CORS, global pipes,
// Redis-backed session store, Passport initialization and start the server.
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Environment is loaded by ConfigService; avoid logging env variables here.

  app.enableCors({
    origin: ['http://localhost:3000'],
    credentials: true
  })

  app.setGlobalPrefix('secure/api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );
  
  const configService = app.get(ConfigService);

  

  const redisClient = createClient({
    socket: {
      host: configService.get<string>('REDIS_HOST') as string,
      port: parseInt(configService.get<string>('REDIS_PORT') as string)
    }
  });

  redisClient.on('error', (err) => {
    console.error('Redis Client Error', err);
  });

  // attempt to connect to Redis but don't block startup indefinitely
  let redisConnected = true;
  try {
    await Promise.race([
      redisClient.connect(),
      new Promise((_res, rej) => setTimeout(() => rej(new Error('Redis connect timeout')), 5000)),
    ]);
  } catch (err) {
    console.error('Could not connect to Redis, proceeding without Redis store:', err);
    redisConnected = false;
  }

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
    if (redisConnected) {
      try {
        redisStoreInstance = new RedisStoreClass({ client: redisClient });
      } catch (err) {
        // some connect-redis builds export a factory function
        redisStoreInstance = RedisStoreClass({ client: redisClient });
      }
    }
  } catch (err) {
    console.error('Failed to initialize Redis store, falling back to MemoryStore:', err);
    redisStoreInstance = undefined;
  }

  const sessionOptions: any = {
    secret: configService.get<string>('TOKEN_SECRET') as string,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: parseInt(configService.get<string>('EXPIRE_IN') as string) },
  };

  if (redisStoreInstance) sessionOptions.store = redisStoreInstance;

  app.use(session(sessionOptions));

  app.use(passport.initialize());
  app.use(passport.session());

  await app.listen(parseInt(configService.get<string>('PORT') as string));
}
bootstrap();