import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RoutingService } from './routing.service';
import { RoutingGateway } from './routing.gateway';
import { RoutingController } from './routing.controller';
import { RidesModule } from '../rides/rides.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [HttpModule, forwardRef(() => RidesModule), UserModule],
  providers: [RoutingService, RoutingGateway],
  controllers: [RoutingController],
  exports: [RoutingService],
})
export class RoutingModule {}
