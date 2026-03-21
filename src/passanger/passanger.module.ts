import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Passanger, PassangerSchema } from './passanger.schema';
import { PassangerService } from './passanger.service';
import { PassangerController } from './passanger.controller';
import { UserModule } from '../user/user.module';
import { RidesModule } from '../rides/rides.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Passanger.name, schema: PassangerSchema },
    ]),
    UserModule,
    forwardRef(() => RidesModule),
  ],
  providers: [PassangerService],
  controllers: [PassangerController],
  exports: [PassangerService],
})
export class PassangerModule {}
