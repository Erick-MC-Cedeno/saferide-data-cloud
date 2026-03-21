import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RidesService } from './rides.service';
import { CreateRideRequestDto } from './dto/create-ride-request.dto';
import { RateRideDto } from './dto/rate-ride.dto';
import { AuthenticatedGuard } from '../guard/auth/authenticated.guard';
import { CurrentUser } from '../guard/auth/current-user.decorator';

@Controller('rides')
export class RidesController {
  constructor(private readonly service: RidesService) {}

  // ─── Pasajero ────────────────────────────────────────────────────────────────

  /** Solicitar un nuevo viaje. Verifica perfil pasajero, drivers disponibles y crea el ride. */
  @Post('request')
  @UseGuards(AuthenticatedGuard)
  async requestRide(
    @CurrentUser() user: any,
    @Body() dto: CreateRideRequestDto,
  ) {
    return this.service.requestRide(user._id.toString(), dto);
  }

  /** Historial de viajes del pasajero autenticado. */
  @Get('passenger/my-rides')
  @UseGuards(AuthenticatedGuard)
  async getMyRidesAsPassenger(@CurrentUser() user: any) {
    return this.service.getRidesForPassenger(user._id.toString());
  }

  /** Viaje activo actual del pasajero autenticado. */
  @Get('passenger/my-active')
  @UseGuards(AuthenticatedGuard)
  async getActiveRideAsPassenger(@CurrentUser() user: any) {
    return this.service.getActiveRideForPassenger(user._id.toString());
  }

  // ─── Driver ──────────────────────────────────────────────────────────────────

  /** Historial de viajes del conductor autenticado. */
  @Get('driver/my-rides')
  @UseGuards(AuthenticatedGuard)
  async getMyRidesAsDriver(@CurrentUser() user: any) {
    return this.service.getRidesForDriver(user._id.toString());
  }

  /** Viaje activo actual del conductor autenticado. */
  @Get('driver/my-active')
  @UseGuards(AuthenticatedGuard)
  async getActiveRideAsDriver(@CurrentUser() user: any) {
    return this.service.getActiveRideForDriver(user._id.toString());
  }

  /**
   * Solicitudes de ride disponibles para el conductor autenticado.
   * Incluye rides broadcast (sin driver preferido) y directos a él.
   */
  @Get('driver/requests')
  @UseGuards(AuthenticatedGuard)
  async getRequestsForDriver(@CurrentUser() user: any) {
    return this.service.getRequestsForDriver(user._id.toString());
  }

  /**
   * Solicitudes DIRECTAS dirigidas únicamente a este conductor.
   */
  @Get('driver/direct-requests')
  @UseGuards(AuthenticatedGuard)
  async getDirectRequestsForDriver(@CurrentUser() user: any) {
    return this.service.getDirectRequestsForDriver(user._id.toString());
  }

  /** Todos los rides en estado PENDING (útil para broadcast). */
  @Get('pending')
  @UseGuards(AuthenticatedGuard)
  async getPendingRides() {
    return this.service.getPendingRides();
  }

  // ─── Acciones sobre un ride específico ───────────────────────────────────────

  /** Driver acepta un ride. */
  @Post(':id/accept')
  @UseGuards(AuthenticatedGuard)
  async acceptRide(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.acceptRide(user._id.toString(), id);
  }

  /** Driver inicia el viaje (ACCEPTED → IN_PROGRESS). */
  @Post(':id/start')
  @UseGuards(AuthenticatedGuard)
  async startRide(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.startRide(user._id.toString(), id);
  }

  /** Driver completa el viaje (IN_PROGRESS → COMPLETED). */
  @Post(':id/complete')
  @UseGuards(AuthenticatedGuard)
  async completeRide(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { actual_fare?: number },
  ) {
    return this.service.completeRide(user._id.toString(), id, body.actual_fare);
  }

  /** Cancelar el viaje (pasajero o driver pueden cancelar). */
  @Post(':id/cancel')
  @UseGuards(AuthenticatedGuard)
  async cancelRide(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { reason?: string },
  ) {
    return this.service.cancelRide(user._id.toString(), id, body.reason);
  }

  /** Calificar el viaje (pasajero calificia al driver y viceversa). */
  @Post(':id/rate')
  @UseGuards(AuthenticatedGuard)
  async rateRide(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: RateRideDto,
  ) {
    return this.service.rateRide(user._id.toString(), id, dto);
  }

  /** Obtener detalle de un ride. */
  @Get(':id')
  @UseGuards(AuthenticatedGuard)
  async getRide(@Param('id') id: string) {
    return this.service.getRideById(id);
  }
}
