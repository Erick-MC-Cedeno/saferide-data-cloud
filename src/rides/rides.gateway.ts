import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { DriverService } from '../driver/driver.service';
import { PassangerService } from '../passanger/passanger.service';
import { RidesService } from './rides.service';
import { SocketEvents, SocketRooms } from '../shared/constants';

@WebSocketGateway({ namespace: 'rides' })
export class RidesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly driverService: DriverService,
    private readonly passengerService: PassangerService,
    private readonly ridesService: RidesService,
  ) {}

  afterInit(_server: Server) {
    console.log('[RidesGateway] Inicializado');
  }

  handleConnection(client: Socket) {
    console.log(`[RidesGateway] Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`[RidesGateway] Cliente desconectado: ${client.id}`);
  }

  // ─── Driver room/status ─────────────────────────────────────────────────────

  @SubscribeMessage('driver:join')
  async handleDriverJoin(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(SocketRooms.USER(data.userId));
    return { event: 'driver:joined', data: { success: true } };
  }

  @SubscribeMessage('driver:goOnline')
  async handleDriverGoOnline(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const driver = await this.driverService.getActiveByUserId(data.userId);

    if (!driver) {
      // Rol dual: el usuario no tiene perfil de conductor
      client.emit(SocketEvents.DRIVER_PROFILE_INCOMPLETE, {
        code: 'DRIVER_PROFILE_INCOMPLETE',
        message:
          'Debes completar el formulario de conductor antes de ir online',
      });
      return;
    }

    // Actualizar estado en BD
    await this.driverService.setOnlineStatus(data.userId, true);

    client.join(SocketRooms.DRIVERS_ONLINE);
    client.join(SocketRooms.USER(data.userId));

    return {
      event: 'driver:online',
      data: {
        driverId: driver._id.toString(),
        userId: data.userId,
        location: driver.current_location,
      },
    };
  }

  @SubscribeMessage('driver:goOffline')
  async handleDriverGoOffline(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const driver = await this.driverService.getActiveByUserId(data.userId);
    if (driver) {
      await this.driverService.setOnlineStatus(data.userId, false);
    }

    client.leave(SocketRooms.DRIVERS_ONLINE);

    return {
      event: 'driver:offline',
      data: { userId: data.userId },
    };
  }

  @SubscribeMessage('driver:location:update')
  async handleDriverLocationUpdate(
    @MessageBody() data: { userId: string; coordinates: [number, number] },
    @ConnectedSocket() client: Socket,
  ) {
    const driver = await this.driverService.updateLocation(
      data.userId,
      data.coordinates,
    );

    if (driver) {
      const activeRide = await this.ridesService.getActiveRideForDriver(
        data.userId,
      );
      if (activeRide) {
        this.server
          .to(SocketRooms.RIDE(activeRide._id.toString()))
          .emit(SocketEvents.RIDE_DRIVER_LOCATION, {
            rideId: activeRide._id.toString(),
            coordinates: data.coordinates,
            driverId: driver._id.toString(),
          });
      }
    }

    return { event: 'driver:location:updated', data: { success: true } };
  }

  // ─── Passenger room ─────────────────────────────────────────────────────────

  @SubscribeMessage('passenger:join')
  async handlePassengerJoin(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(SocketRooms.USER(data.userId));
    return { event: 'passenger:joined', data: { success: true } };
  }

  // ─── Ride room ──────────────────────────────────────────────────────────────

  @SubscribeMessage('ride:join')
  async handleRideJoin(
    @MessageBody() data: { rideId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(SocketRooms.RIDE(data.rideId));
    client.join(SocketRooms.USER(data.userId));

    return { event: 'ride:joined', data: { rideId: data.rideId } };
  }

  @SubscribeMessage('ride:leave')
  async handleRideLeave(
    @MessageBody() data: { rideId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(SocketRooms.RIDE(data.rideId));

    return { event: 'ride:left', data: { rideId: data.rideId } };
  }

  // ─── Emit helpers (llamados desde RidesListener) ────────────────────────────

  /**
   * Cuando se crea un ride:
   * - Si tiene preferred_driver_id → solo notifica a ese driver por su room personal
   * - Si no → broadcast a todos los drivers online (room drivers:online)
   */
  emitRideRequested(ride: any) {
    const payload = {
      rideId: ride._id.toString(),
      pickup: ride.pickup_address,
      destination: ride.destination_address,
      pickupCoordinates: ride.pickup_coordinates,
      destinationCoordinates: ride.destination_coordinates,
      passengerName: ride.passenger_name,
      estimatedFare: ride.estimated_fare,
      estimatedDuration: ride.estimated_duration,
      requestedAt: ride.requested_at,
      routePoints: ride.route_points || [],
      routeDistanceM: ride.route_distance_m || 0,
      routeDurationS: ride.route_duration_s || 0,
    };

    if (ride.preferred_driver_id) {
      // Solicitud directa a un driver específico
      this.server
        .to(SocketRooms.USER(ride.preferred_driver_id.toString()))
        .emit(SocketEvents.RIDE_REQUEST_FOR_DRIVER, payload);
    } else {
      // Broadcast a todos los drivers online
      this.server
        .to(SocketRooms.DRIVERS_ONLINE)
        .emit(SocketEvents.RIDE_NEW_REQUEST, payload);
    }
  }

  emitRideAccepted(ride: any) {
    const payload = {
      rideId: ride._id.toString(),
      driverId: ride.driver?.toString(),
      driverName: ride.driver_name,
      acceptedAt: ride.accepted_at,
      chatEnabled: ride.ride_chat_enabled,
    };

    // Notificar a todos en la sala del ride (pasajero + driver)
    this.server
      .to(SocketRooms.RIDE(ride._id.toString()))
      .emit(SocketEvents.RIDE_ACCEPTED, payload);

    // También notificar directamente al pasajero por su room personal (por si no se unió aún al ride)
    if (ride.passenger) {
      this.server
        .to(SocketRooms.USER(ride.passenger.toString()))
        .emit(SocketEvents.RIDE_ACCEPTED, payload);
    }
  }

  emitRideStarted(ride: any) {
    this.server
      .to(SocketRooms.RIDE(ride._id.toString()))
      .emit(SocketEvents.RIDE_STARTED, {
        rideId: ride._id.toString(),
      });
  }

  emitRideCompleted(ride: any) {
    this.server
      .to(SocketRooms.RIDE(ride._id.toString()))
      .emit(SocketEvents.RIDE_COMPLETED, {
        rideId: ride._id.toString(),
        actualFare: ride.actual_fare,
        completedAt: ride.completed_at,
      });
  }

  emitRideCancelled(ride: any) {
    this.server
      .to(SocketRooms.RIDE(ride._id.toString()))
      .emit(SocketEvents.RIDE_CANCELLED, {
        rideId: ride._id.toString(),
        reason: ride.cancellation_reason,
        cancelledAt: ride.cancelled_at,
      });
  }

  emitRideRated(ride: any) {
    this.server
      .to(SocketRooms.RIDE(ride._id.toString()))
      .emit(SocketEvents.RIDE_RATED, {
        rideId: ride._id.toString(),
        passengerRating: ride.passenger_rating,
        driverRating: ride.driver_rating,
      });
  }
}
