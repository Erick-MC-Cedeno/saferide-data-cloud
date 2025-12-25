import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Ride, RideSchema } from './rides.schema';
import { RidesService } from './rides.service';
import { RidesController } from './rides.controller';
import { PassangerModule } from '../passanger/passanger.module';
import { DriverModule } from '../driver/driver.module';

@Module({
  imports: [MongooseModule.forFeature([{ name: Ride.name, schema: RideSchema }]), PassangerModule, DriverModule],
  providers: [RidesService],
  controllers: [RidesController],
  exports: [RidesService],
})
export class RidesModule {}
