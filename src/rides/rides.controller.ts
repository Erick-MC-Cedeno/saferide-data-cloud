import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RidesService } from './rides.service';
import { CreateRideRequestDto } from './dto/create-ride-request.dto';
import { RateRideDto } from './dto/rate-ride.dto';
import { AuthenticatedGuard } from '../guard/auth/authenticated.guard';
import { CurrentUser } from '../guard/auth/current-user.decorator';

@Controller('rides')
export class RidesController {
  constructor(private readonly service: RidesService) {}

  @Post('request')
  @UseGuards(AuthenticatedGuard)
  async requestRide(
    @CurrentUser() user: any,
    @Body() dto: CreateRideRequestDto,
  ) {
    return this.service.requestRide(user._id.toString(), dto);
  }

  @Post(':id/accept')
  @UseGuards(AuthenticatedGuard)
  async acceptRide(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.acceptRide(user._id.toString(), id);
  }

  @Post(':id/start')
  @UseGuards(AuthenticatedGuard)
  async startRide(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.startRide(user._id.toString(), id);
  }

  @Post(':id/complete')
  @UseGuards(AuthenticatedGuard)
  async completeRide(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { actual_fare?: number },
  ) {
    return this.service.completeRide(user._id.toString(), id, body.actual_fare);
  }

  @Post(':id/cancel')
  @UseGuards(AuthenticatedGuard)
  async cancelRide(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { reason?: string },
  ) {
    return this.service.cancelRide(user._id.toString(), id, body.reason);
  }

  @Post(':id/rate')
  @UseGuards(AuthenticatedGuard)
  async rateRide(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: RateRideDto,
  ) {
    return this.service.rateRide(user._id.toString(), id, dto);
  }

  @Get(':id')
  @UseGuards(AuthenticatedGuard)
  async getRide(@Param('id') id: string) {
    return this.service.getRideById(id);
  }

  @Get(':id/messages')
  @UseGuards(AuthenticatedGuard)
  async getRideMessages(@Param('id') id: string) {
    return [];
  }
}
