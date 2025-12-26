import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Driver, DriverSchema } from './driver.schema';
import { DriverService } from './driver.service';
import { DriverController } from './driver.controller';
import { UserModule } from '../user/user.module';
import { PassangerModule } from '../passanger/passanger.module';

@Module({
  imports: [MongooseModule.forFeature([{ name: Driver.name, schema: DriverSchema }]), UserModule, forwardRef(() => PassangerModule)],
  providers: [DriverService],
  controllers: [DriverController],
  exports: [DriverService],
})
export class DriverModule {}
