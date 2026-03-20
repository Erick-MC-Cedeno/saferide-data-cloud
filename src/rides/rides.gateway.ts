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

@WebSocketGateway({ namespace: 'rides' })
export class RidesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly driverService: DriverService,
    private readonly passengerService: PassangerService,
    private readonly ridesService: RidesService,
  ) {}

  afterInit(server: Server) {
    console.log('[RidesGateway] Inicializado');
  }

  handleConnection(client: Socket) {
    console.log(`[RidesGateway] Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`[RidesGateway] Cliente desconectado: ${client.id}`);
  }

  @SubscribeMessage('driver:join')
  async handleDriverJoin(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`user:${data.userId}`);
    return { event: 'driver:joined', data: { success: true } };
  }

  @SubscribeMessage('driver:goOnline')
  async handleDriverGoOnline(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const driver = await this.driverService.getActiveByUserId(data.userId);
    if (!driver)
      return { event: 'error', data: { message: 'Driver not found' } };

    client.join('drivers:online');

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
    client.leave('drivers:online');

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
        this.server.to(`ride:${activeRide._id}`).emit('driver:location', {
          rideId: activeRide._id.toString(),
          coordinates: data.coordinates,
          driverId: driver._id.toString(),
        });
      }
    }

    return { event: 'driver:location:updated', data: { success: true } };
  }

  @SubscribeMessage('ride:join')
  async handleRideJoin(
    @MessageBody() data: { rideId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`ride:${data.rideId}`);
    client.join(`user:${data.userId}`);

    return { event: 'ride:joined', data: { rideId: data.rideId } };
  }

  @SubscribeMessage('ride:leave')
  async handleRideLeave(
    @MessageBody() data: { rideId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`ride:${data.rideId}`);

    return { event: 'ride:left', data: { rideId: data.rideId } };
  }

  emitRideRequested(ride: any) {
    this.server.emit('ride:requested', {
      rideId: ride._id.toString(),
      pickup: ride.pickup_address,
      destination: ride.destination_address,
      coordinates: ride.pickup_coordinates,
      passengerName: ride.passenger_name,
    });
  }

  emitRideAccepted(ride: any) {
    this.server.to(`ride:${ride._id}`).emit('ride:accepted', {
      rideId: ride._id.toString(),
      driverId: ride.driver?.toString(),
      driverName: ride.driver_name,
    });
  }

  emitRideStarted(ride: any) {
    this.server.to(`ride:${ride._id}`).emit('ride:started', {
      rideId: ride._id.toString(),
    });
  }

  emitRideCompleted(ride: any) {
    this.server.to(`ride:${ride._id}`).emit('ride:completed', {
      rideId: ride._id.toString(),
      actualFare: ride.actual_fare,
    });
  }

  emitRideCancelled(ride: any) {
    this.server.to(`ride:${ride._id}`).emit('ride:cancelled', {
      rideId: ride._id.toString(),
      reason: ride.cancellation_reason,
    });
  }
}
