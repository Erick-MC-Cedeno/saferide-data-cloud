import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
  Delete,
  Query,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { DriverService } from './driver.service';
import { RidesService } from '../rides/rides.service';
import { CreateDriverProfileDto } from './dto/create-driver-profile.dto';
import { UpdateDriverProfileDto } from './dto/update-driver-profile.dto';
import { DeleteDriverProfileDto } from './dto/delete-driver-profile.dto';
import { UpdateDriverStatusDto } from './dto/update-driver-status.dto';
import { UpdateDriverLocationDto } from './dto/update-driver-location.dto';
import { AuthenticatedGuard } from '../guard/auth/authenticated.guard';
import { CurrentUser } from '../guard/auth/current-user.decorator';

@Controller('drivers')
export class DriverController {
  constructor(
    private readonly service: DriverService,
    @Inject(forwardRef(() => RidesService))
    private readonly ridesService: RidesService,
  ) {}

  @Post('profile')
  @UseGuards(AuthenticatedGuard)
  async createProfile(
    @CurrentUser() user: any,
    @Body() dto: CreateDriverProfileDto,
  ) {
    return this.service.createProfile(user._id.toString(), dto);
  }

  @Get('profile')
  @UseGuards(AuthenticatedGuard)
  async getProfile(@CurrentUser() user: any) {
    const driver = await this.service.getByUserId(user._id.toString());
    if (!driver) {
      throw new NotFoundException('Perfil de conductor no encontrado');
    }
    return driver;
  }

  @Patch('profile')
  @UseGuards(AuthenticatedGuard)
  async updateProfile(
    @CurrentUser() user: any,
    @Body() dto: UpdateDriverProfileDto,
  ) {
    return this.service.updateProfile(user._id.toString(), dto);
  }

  @Delete('profile')
  @UseGuards(AuthenticatedGuard)
  async deleteProfile(
    @CurrentUser() user: any,
    @Body() _dto: DeleteDriverProfileDto,
  ) {
    await this.service.deleteProfile(user._id.toString());
    return { message: 'Perfil de conductor desactivado' };
  }

  @Post('profile/reactivate')
  @UseGuards(AuthenticatedGuard)
  async reactivateProfile(
    @CurrentUser() user: any,
    @Body() dto: CreateDriverProfileDto,
  ) {
    return this.service.reactivateProfile(user._id.toString(), dto);
  }

  @Post('status')
  @UseGuards(AuthenticatedGuard)
  async updateStatus(
    @CurrentUser() user: any,
    @Body() dto: UpdateDriverStatusDto,
  ) {
    return this.service.setOnlineStatus(user._id.toString(), dto.isOnline);
  }

  @Post('location')
  @UseGuards(AuthenticatedGuard)
  async updateLocation(
    @CurrentUser() user: any,
    @Body() dto: UpdateDriverLocationDto,
  ) {
    return this.service.updateLocation(user._id.toString(), dto.coordinates);
  }

  @Get('nearby')
  @UseGuards(AuthenticatedGuard)
  async getNearbyDrivers(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radiusKm') radius?: string,
  ) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      throw new BadRequestException('Latitud y longitud son requeridas');
    }

    if (
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new BadRequestException('Coordenadas inválidas');
    }

    const radiusKm = radius ? parseFloat(radius) : 10;

    if (isNaN(radiusKm) || radiusKm <= 0) {
      throw new BadRequestException('Radio inválido');
    }

    return this.service.getNearbyDrivers(latitude, longitude, radiusKm);
  }

  /** Historial de viajes del conductor autenticado. */
  @Get('me/rides')
  @UseGuards(AuthenticatedGuard)
  async getMyRides(@CurrentUser() user: any) {
    return this.ridesService.getRidesForDriver(user._id.toString());
  }

  /** Viaje activo actual del conductor autenticado. */
  @Get('me/active-ride')
  @UseGuards(AuthenticatedGuard)
  async getActiveRide(@CurrentUser() user: any) {
    return this.ridesService.getActiveRideForDriver(user._id.toString());
  }

  /**
   * Rides en estado PENDING sin driver asignado (broadcast).
   * Los drivers online pueden ver estos rides y aceptar cualquiera.
   */
  @Get('pending-rides')
  @UseGuards(AuthenticatedGuard)
  async getPendingRides() {
    return this.ridesService.getPendingRides();
  }
}
