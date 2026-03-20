import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import connectRedis from 'connect-redis';
import session from 'express-session';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;
  private readonly store: ReturnType<typeof connectRedis>;

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST!,
      port: parseInt(process.env.REDIS_PORT!),
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        this.logger.log(`[Redis] Retry attempt ${times}, delay: ${delay}ms`);
        return delay;
      },
      lazyConnect: true,
    });

    this.client.on('error', (err) => {
      this.logger.error('[Redis] Connection error:', err.message);
    });

    this.client.on('connect', () => {
      this.logger.log('[Redis] Connected successfully');
    });

    const RedisStore = connectRedis(session);
    this.store = new RedisStore({ client: this.client as any });
  }

  getClient(): Redis {
    return this.client;
  }

  getStore(): ReturnType<typeof connectRedis> {
    return this.store;
  }

  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('[Redis] Connection closed gracefully');
  }
}
