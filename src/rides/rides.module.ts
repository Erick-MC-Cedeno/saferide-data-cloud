import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Ride, RideSchema } from './rides.schema';
import { RidesService } from './rides.service';
import { RidesController } from './rides.controller';
import { RidesGateway } from './rides.gateway';
import { RidesListener } from './rides.listener';
import { PassangerModule } from '../passanger/passanger.module';
import { DriverModule } from '../driver/driver.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Ride.name, schema: RideSchema }]),
    PassangerModule,
    DriverModule,
    UserModule,
  ],
  providers: [RidesService, RidesGateway, RidesListener],
  controllers: [RidesController],
  exports: [RidesService],
})
export class RidesModule {}
