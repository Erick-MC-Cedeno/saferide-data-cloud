import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { RidesService } from './rides.service';
import { CreateRideDto } from './dto/create-ride.dto';
import { UpdateRideDto } from './dto/update-ride.dto';

@Controller('rides')
export class RidesController {
  constructor(private readonly svc: RidesService) {}

  @Post()
  create(@Body() body: CreateRideDto) {
    return this.svc.create(body);
  }

  @Get()
  findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Get('passenger/:email')
  findByPassenger(@Param('email') email: string) {
    return this.svc.findByPassengerEmail(email);
  }

  @Get('driver/:email')
  findByDriver(@Param('email') email: string) {
    return this.svc.findByDriverEmail(email);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateRideDto) {
    return this.svc.updateById(id, body);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body() body: { reason?: string; passenger_comment?: string }) {
    return this.svc.cancelRide(id, body?.reason, body?.passenger_comment);
  }
}
