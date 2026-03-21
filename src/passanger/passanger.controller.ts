import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
  Delete,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PassangerService } from './passanger.service';
import { RidesService } from '../rides/rides.service';
import { CreatePassangerProfileDto } from './dto/create-passanger-profile.dto';
import { UpdatePassangerProfileDto } from './dto/update-passanger-profile.dto';
import { DeletePassangerProfileDto } from './dto/delete-passanger-profile.dto';
import { AuthenticatedGuard } from '../guard/auth/authenticated.guard';
import { CurrentUser } from '../guard/auth/current-user.decorator';

@Controller('passangers')
export class PassangerController {
  constructor(
    private readonly service: PassangerService,
    @Inject(forwardRef(() => RidesService))
    private readonly ridesService: RidesService,
  ) {}

  @Post('profile')
  @UseGuards(AuthenticatedGuard)
  async createProfile(
    @CurrentUser() user: any,
    @Body() dto: CreatePassangerProfileDto,
  ) {
    return this.service.createProfile(user._id.toString(), dto);
  }

  @Get('profile')
  @UseGuards(AuthenticatedGuard)
  async getProfile(@CurrentUser() user: any) {
    const passenger = await this.service.getByUserId(user._id.toString());
    if (!passenger) {
      throw new NotFoundException('Perfil de pasajero no encontrado');
    }
    return passenger;
  }

  @Patch('profile')
  @UseGuards(AuthenticatedGuard)
  async updateProfile(
    @CurrentUser() user: any,
    @Body() dto: UpdatePassangerProfileDto,
  ) {
    return this.service.updateProfile(user._id.toString(), dto);
  }

  @Delete('profile')
  @UseGuards(AuthenticatedGuard)
  async deleteProfile(
    @CurrentUser() user: any,
    @Body() _dto: DeletePassangerProfileDto,
  ) {
    await this.service.deleteProfile(user._id.toString());
    return { message: 'Perfil de pasajero desactivado' };
  }

  @Post('profile/reactivate')
  @UseGuards(AuthenticatedGuard)
  async reactivateProfile(
    @CurrentUser() user: any,
    @Body() dto: CreatePassangerProfileDto,
  ) {
    return this.service.reactivateProfile(user._id.toString(), dto);
  }

  /** Historial de viajes del pasajero autenticado. */
  @Get('me/rides')
  @UseGuards(AuthenticatedGuard)
  async getMyRides(@CurrentUser() user: any) {
    return this.ridesService.getRidesForPassenger(user._id.toString());
  }

  /** Viaje activo actual del pasajero autenticado. */
  @Get('me/active-ride')
  @UseGuards(AuthenticatedGuard)
  async getActiveRide(@CurrentUser() user: any) {
    return this.ridesService.getActiveRideForPassenger(user._id.toString());
  }
}
