import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import * as express from 'express';
import { join } from 'path';

import session from 'express-session';
import passport from 'passport';
import { ValidationPipe } from '@nestjs/common';
import { csrfSync } from 'csrf-sync';
import helmet from 'helmet';
import { RedisService } from './shared/redis';


// This is the main entry point of the application. It sets up the NestJS application, configures CORS, global prefix, validation pipes, session management with Redis, and initializes Passport for authentication. Finally, it starts the application on the specified port.
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['http://localhost:3000'];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true
  });


  app.setGlobalPrefix('secure/api', {
    exclude: ['csrf-token', ''],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true
    })
  );
  

  const redisService = app.get(RedisService);
  const redisStore = redisService.getStore();

  const isProduction = process.env.NODE_ENV === 'production';
  const sessionCookie = {
    maxAge: parseInt(process.env.EXPIRE_IN!),
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/'
  };

  app.use(
    session({
      store: redisStore,
      secret: process.env.TOKEN_SECRET!,
      resave: false,
      saveUninitialized: false,
      cookie: sessionCookie
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  let csrfSynchronisedProtection: any;
  try {
    const csrfResult = csrfSync({
      ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
    });
    csrfSynchronisedProtection = csrfResult.csrfSynchronisedProtection;
    console.log('[CSRF] Initialized successfully');
  } catch (error) {
    console.error('[CSRF] Initialization error:', error);
    throw error;
  }
  
  const csrfMiddleware = (req: any, res: any, next: any) => {
    console.log('[CSRF Debug] Method:', req.method, 'Path:', req.path);
    
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }
    
   const skipPaths = [
      '/secure/api/user/login', 
      '/secure/api/user/register', 
      '/secure/api/user/resend-token', 
      '/secure/api/user/forgot-password', 
      '/secure/api/user/reset-password',
      '/secure/api/user/verify-token',
      '/secure/api/user/logout',
      '/secure/api/user/update-token-status',
      '/secure/api/csrf-token'
    ];

    const shouldSkip = skipPaths.some(p => req.path.includes(p));
    console.log('[CSRF Debug] Should skip:', shouldSkip);
    if (shouldSkip) {
      return next();
    }
    
    console.log('[CSRF Debug] Running CSRF protection for:', req.method, req.path);
    return csrfSynchronisedProtection(req, res, next);
  };
  
  app.use(csrfMiddleware);

  app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

  app.enableShutdownHooks();

  const server = await app.listen(parseInt(process.env.PORT!));
  
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGQUIT'];
  signals.forEach(sig => {
    process.on(sig, async () => {
      console.log(`\n[SHUTDOWN] Received ${sig}, closing gracefully...`);
      try {
        await app.close();
        console.log('[SHUTDOWN] All connections closed');
        process.exit(0);
      } catch (err) {
        console.error('[SHUTDOWN] Error during shutdown:', err);
        process.exit(1);
      }
    });
  });

  return server;
}
bootstrap();