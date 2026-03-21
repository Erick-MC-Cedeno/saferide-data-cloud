import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Ride, RideSchema } from './rides.schema';
import { RidesService } from './rides.service';
import { RidesController } from './rides.controller';
import { RidesGateway } from './rides.gateway';
import { RidesListener } from './rides.listener';
import { PassangerModule } from '../passanger/passanger.module';
import { DriverModule } from '../driver/driver.module';
import { UserModule } from '../user/user.module';
import { MessagesAndMultimediaModule } from '../messages-and-multimedia/messages-and-multimedia.module';
import { RoutingModule } from '../routing/routing.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Ride.name, schema: RideSchema }]),
    // forwardRef en AMBOS lados porque PassangerModule y DriverModule
    // también importan RidesModule con forwardRef — la referencia circular
    // requiere forwardRef en los dos extremos para que NestJS pueda resolverla.
    forwardRef(() => PassangerModule),
    forwardRef(() => DriverModule),
    UserModule,
    forwardRef(() => MessagesAndMultimediaModule),
    forwardRef(() => RoutingModule),
  ],
  providers: [RidesService, RidesGateway, RidesListener],
  controllers: [RidesController],
  exports: [RidesService],
})
export class RidesModule {}
