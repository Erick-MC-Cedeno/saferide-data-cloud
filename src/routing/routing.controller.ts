import {
  Body,
  Controller,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RoutingService } from './routing.service';
import { GetRouteDto } from './dto/get-route.dto';
import { AuthenticatedGuard } from '../guard/auth/authenticated.guard';

@Controller('routing')
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  /**
   * Calcula la ruta entre dos puntos de forma síncrona (REST).
   * Útil para precalcular la ruta al momento de la solicitud de viaje,
   * o para clientes que no usan WebSocket.
   *
   * POST /routing/calculate
   * Body: { originLat, originLng, destLat, destLng, rideId? }
   *
   * Respuesta:
   * {
   *   points: [{ latitude, longitude }, ...],
   *   distance_m, duration_s, distance_km, duration_min
   * }
   */
  @Post('calculate')
  @UseGuards(AuthenticatedGuard)
  @HttpCode(HttpStatus.OK)
  async calculateRoute(@Body() dto: GetRouteDto) {
    return this.routingService.calculateRoute(
      dto.originLat,
      dto.originLng,
      dto.destLat,
      dto.destLng,
    );
  }
}
