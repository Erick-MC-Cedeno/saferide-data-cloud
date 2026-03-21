import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RouteResult, RoutePoint } from './interfaces/route-result.interface';

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  /** URL base de OSRM leída desde variables de entorno */
  private get osrmUrl(): string {
    const url = process.env.OSRM_URL;
    if (!url) {
      throw new InternalServerErrorException(
        'OSRM_URL no está configurada en las variables de entorno',
      );
    }
    return url.replace(/\/$/, ''); // Eliminar trailing slash si existe
  }

  constructor(private readonly httpService: HttpService) {}

  /**
   * Calcula la ruta entre dos puntos usando OSRM.
   *
   * OSRM usa el formato: longitud,latitud (orden invertido respecto a Google Maps)
   * La respuesta devuelve coordenadas en formato [lng, lat] que se transforman
   * a { latitude, longitude } para React Native Maps.
   *
   * @param originLat  Latitud del punto de origen
   * @param originLng  Longitud del punto de origen
   * @param destLat    Latitud del destino
   * @param destLng    Longitud del destino
   */
  async calculateRoute(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): Promise<RouteResult> {
    // Validación básica de coordenadas
    if (
      isNaN(originLat) || isNaN(originLng) ||
      isNaN(destLat) || isNaN(destLng)
    ) {
      throw new BadRequestException('Las coordenadas deben ser números válidos');
    }

    // OSRM: formato estricto {lng},{lat};{lng},{lat}
    const origin = `${originLng},${originLat}`;
    const dest = `${destLng},${destLat}`;
    const url = `${this.osrmUrl}/route/v1/driving/${origin};${dest}?geometries=geojson&overview=full`;

    this.logger.debug(`OSRM request: ${url}`);

    let data: any;

    try {
      const response = await firstValueFrom(this.httpService.get(url));
      data = response.data;
    } catch (err: any) {
      this.logger.error(`Error llamando a OSRM: ${err?.message}`);
      throw new InternalServerErrorException(
        'No se pudo conectar con el servicio de rutas. Intenta de nuevo.',
      );
    }

    // Verificar que OSRM retornó al menos una ruta
    if (!data?.routes || data.routes.length === 0) {
      this.logger.warn(`OSRM no encontró ruta: ${JSON.stringify(data)}`);
      throw new BadRequestException(
        'No se encontró una ruta válida entre el origen y el destino',
      );
    }

    const route = data.routes[0];
    const rawCoords: [number, number][] = route.geometry.coordinates;

    // Transformar [lng, lat] → { latitude, longitude } (formato React Native Maps)
    const points: RoutePoint[] = rawCoords.map(([lng, lat]) => ({
      latitude: lat,
      longitude: lng,
    }));

    const distance_m: number = Math.round(route.distance * 10) / 10;
    const duration_s: number = Math.round(route.duration * 10) / 10;

    const result: RouteResult = {
      points,
      distance_m,
      duration_s,
      distance_km: Math.round((distance_m / 1000) * 100) / 100,
      duration_min: Math.round((duration_s / 60) * 10) / 10,
    };

    this.logger.log(
      `Ruta calculada: ${points.length} puntos, ${result.distance_km} km, ${result.duration_min} min`,
    );

    return result;
  }
}
