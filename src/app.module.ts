import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { DonationsModule } from './donations/donations.module';
import { TwoFactorAuthModule } from './two-factor/verification.module';
import { MessagesAndMultimediaModule } from './messages-and-multimedia/messages-and-multimedia.module';
import { PassangerModule } from './passanger/passanger.module';
import { DriverModule } from './driver/driver.module';
import { RidesModule } from './rides/rides.module';
import { RoutingModule } from './routing/routing.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { RedisModule } from './shared/redis';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    RedisModule,
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
    }),
    ThrottlerModule.forRoot({
      ttl: 60000,
      limit: 30,
    }),

    MongooseModule.forRoot(process.env.DB_URI!, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST!,
        port: parseInt(process.env.REDIS_PORT!),
      },
    }),
    UserModule,
    PassangerModule,
    DriverModule,
    RidesModule,
    RoutingModule,
    MessagesAndMultimediaModule,
    AuthModule,
    TwoFactorAuthModule,
    DonationsModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
