import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RidesService } from './rides.service';
import { AuthenticatedGuard } from '../guard/auth/authenticated.guard';
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
  @UseGuards(AuthenticatedGuard)
  findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  @UseGuards(AuthenticatedGuard)
  findById(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Get('passenger/:email')
  @UseGuards(AuthenticatedGuard)
  findByPassenger(@Param('email') email: string) {
    return this.svc.findByPassengerEmail(email);
  }

  @Get('driver/:email')
  @UseGuards(AuthenticatedGuard)
  findByDriver(@Param('email') email: string) {
    return this.svc.findByDriverEmail(email);
  }

  @Patch(':id')
  @UseGuards(AuthenticatedGuard)
  update(@Param('id') id: string, @Body() body: UpdateRideDto) {
    return this.svc.updateById(id, body);
  }

  @Post(':id/cancel')
  @UseGuards(AuthenticatedGuard)
  cancel(@Param('id') id: string, @Body() body: { reason?: string; passenger_comment?: string }) {
    return this.svc.cancelRide(id, body?.reason, body?.passenger_comment);
  }
}
