import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { RoutingService } from './routing.service';
import { SocketRooms } from '../shared/constants';

@WebSocketGateway({ namespace: '/routing' })
export class RoutingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RoutingGateway.name);

  constructor(private readonly routingService: RoutingService) {}

  handleConnection(client: Socket) {
    this.logger.log(`[RoutingGateway] Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[RoutingGateway] Cliente desconectado: ${client.id}`);
  }

  /**
   * El cliente emite 'route:calculate' con las coordenadas de origen y destino.
   * El gateway calcula la ruta usando OSRM y emite el resultado de vuelta.
   *
   * Si se incluye rideId, el resultado se emite a TODOS en el room ride:{rideId}
   * (pasajero + driver pueden recibir la actualización de ruta en tiempo real).
   * Si no hay rideId, el resultado se emite solo al cliente que hizo la petición.
   *
   * Payload entrada:
   * {
   *   originLat: number,
   *   originLng: number,
   *   destLat: number,
   *   destLng: number,
   *   rideId?: string
   * }
   *
   * Payload salida (evento 'route:result'):
   * {
   *   points: [{ latitude, longitude }, ...],
   *   distance_m: number,
   *   duration_s: number,
   *   distance_km: number,
   *   duration_min: number,
   *   rideId?: string   // echoed back para que el cliente asocie la respuesta al ride
   * }
   */
  @SubscribeMessage('route:calculate')
  async handleCalculateRoute(
    @MessageBody()
    data: {
      originLat: number;
      originLng: number;
      destLat: number;
      destLng: number;
      rideId?: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { originLat, originLng, destLat, destLng, rideId } = data;

      // Validación básica antes de llamar al servicio
      if (
        originLat == null || originLng == null ||
        destLat == null || destLng == null
      ) {
        client.emit('route:error', {
          message: 'Faltan coordenadas de origen o destino',
        });
        return;
      }

      const result = await this.routingService.calculateRoute(
        Number(originLat),
        Number(originLng),
        Number(destLat),
        Number(destLng),
      );

      const payload = { ...result, rideId: rideId ?? null };

      if (rideId) {
        // Emitir a todos en el room del ride (pasajero y driver reciben la ruta)
        const rideRoom = SocketRooms.RIDE(rideId);
        this.server.to(rideRoom).emit('route:result', payload);
        this.logger.log(
          `Ruta emitida al room ${rideRoom} (${result.points.length} puntos)`,
        );
      } else {
        // Emitir solo al cliente que hizo la petición
        client.emit('route:result', payload);
        this.logger.log(
          `Ruta emitida al cliente ${client.id} (${result.points.length} puntos)`,
        );
      }
    } catch (err: any) {
      this.logger.error(`Error calculando ruta: ${err?.message}`);
      client.emit('route:error', {
        message: err?.message ?? 'Error al calcular la ruta',
      });
    }
  }

  /**
   * El cliente puede unirse al room de un ride para recibir actualizaciones de ruta
   * cuando el conductor comparte su ubicación en tiempo real.
   */
  @SubscribeMessage('route:join-ride')
  handleJoinRide(
    @MessageBody() data: { rideId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.rideId) {
      client.emit('route:error', { message: 'Missing rideId' });
      return;
    }
    const room = SocketRooms.RIDE(data.rideId);
    client.join(room);
    this.logger.log(`Socket ${client.id} joined routing room ${room}`);
    client.emit('route:joined', { rideId: data.rideId });
  }

  /**
   * Método público para emitir actualizaciones de ruta desde otros servicios.
   * Por ejemplo: cuando el driver mueve su ubicación, se puede recalcular
   * la ruta restante y emitirla al room del ride.
   */
  emitRouteUpdate(rideId: string, result: any) {
    this.server
      .to(SocketRooms.RIDE(rideId))
      .emit('route:result', { ...result, rideId });
  }
}
