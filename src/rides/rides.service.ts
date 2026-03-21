import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Ride, RideDocument } from './rides.schema';
import { RideStatus, RIDE_ACTIVE_STATUSES } from './enums/ride-status.enum';
import { CreateRideRequestDto } from './dto/create-ride-request.dto';
import { RateRideDto } from './dto/rate-ride.dto';
import { PassangerService } from '../passanger/passanger.service';
import { DriverService } from '../driver/driver.service';
import { UserService } from '../user/user.service';
import { RoutingService } from '../routing/routing.service';
import { RouteResult } from '../routing/interfaces/route-result.interface';

@Injectable()
export class RidesService {
  private readonly logger = new Logger(RidesService.name);

  constructor(
    @InjectModel(Ride.name) private rideModel: Model<RideDocument>,
    private readonly passengerService: PassangerService,
    private readonly driverService: DriverService,
    private readonly userService: UserService,
    private readonly routingService: RoutingService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async requestRide(
    userId: string,
    dto: CreateRideRequestDto,
  ): Promise<RideDocument> {
    // 1. Verificar que el pasajero tenga perfil completo
    const passenger = await this.passengerService.getActiveByUserId(userId);
    if (!passenger) {
      throw new BadRequestException(
        'Debes completar el formulario de pasajero antes de solicitar un viaje',
      );
    }

    // 2. Verificar que no tenga un viaje activo
    const existingActiveRide = await this.rideModel.findOne({
      passenger: passenger._id,
      status: { $in: RIDE_ACTIVE_STATUSES },
    });
    if (existingActiveRide) {
      throw new BadRequestException('Ya tienes un viaje activo en progreso');
    }

    // 3. Verificar que hay conductores disponibles cerca ANTES de crear el ride
    const { pickup_coordinates } = dto;
    const nearbyDrivers = await this.driverService.getNearbyDrivers(
      pickup_coordinates[1], // lat
      pickup_coordinates[0], // lng
      10, // radio por defecto 10 km
    );

    if (!nearbyDrivers || nearbyDrivers.length === 0) {
      throw new NotFoundException(
        'No hay conductores disponibles en tu área en este momento',
      );
    }

    // 4. Si se especificó un driver preferido, verificar que está en la lista de disponibles
    if (dto.preferred_driver_id) {
      const preferredExists = nearbyDrivers.some(
        (d: any) =>
          d._id?.toString() === dto.preferred_driver_id ||
          d.user?.toString() === dto.preferred_driver_id,
      );
      if (!preferredExists) {
        throw new NotFoundException(
          'El conductor seleccionado no está disponible en este momento',
        );
      }
    }

    const user = await this.userService.getUserById(userId);

    // 5. Calcular ruta con OSRM
    const [originLng, originLat] = dto.pickup_coordinates;
    const [destLng, destLat] = dto.destination_coordinates;

    let routeData: RouteResult | null = null;
    try {
      routeData = await this.routingService.calculateRoute(
        originLat,
        originLng,
        destLat,
        destLng,
      );
    } catch (err) {
      this.logger.warn('No se pudo calcular la ruta: ' + err?.message);
    }

    const routePoints = routeData
      ? routeData.points.map((p) => ({
          lat: p.latitude,
          lng: p.longitude,
        }))
      : [];

    // 6. Crear el ride
    const ride = new this.rideModel({
      passenger: passenger._id,
      passenger_email: user?.email || '',
      passenger_name: passenger.name,
      pickup_address: dto.pickup_address,
      pickup_coordinates: dto.pickup_coordinates,
      destination_address: dto.destination_address,
      destination_coordinates: dto.destination_coordinates,
      estimated_fare: dto.estimated_fare,
      estimated_duration: dto.estimated_duration,
      status: RideStatus.PENDING,
      requested_at: new Date(),
      preferred_driver_id: dto.preferred_driver_id || null,
      route_points: routePoints,
      route_distance_m: routeData?.distance_m ?? 0,
      route_duration_s: routeData?.duration_s ?? 0,
    });
    await ride.save();

    // 6. Emitir evento — el gateway decide a quién notificar
    this.eventEmitter.emit('ride.created', ride);

    return ride;
  }

  async acceptRide(userId: string, rideId: string): Promise<RideDocument> {
    const driver = await this.driverService.getActiveByUserId(userId);
    if (!driver) {
      throw new BadRequestException(
        'Debes completar el formulario de conductor antes de aceptar viajes',
      );
    }

    if (!driver.is_online) {
      throw new BadRequestException('Debes estar online para aceptar viajes');
    }

    const ride = await this.rideModel.findById(rideId);
    if (!ride) {
      throw new NotFoundException('Viaje no encontrado');
    }

    if (ride.status !== RideStatus.PENDING) {
      throw new BadRequestException('Este viaje ya no está disponible');
    }

    // Si era solicitud específica, solo el driver designado puede aceptar
    if (
      ride.preferred_driver_id &&
      ride.preferred_driver_id !== driver._id.toString() &&
      ride.preferred_driver_id !== userId
    ) {
      throw new UnauthorizedException(
        'Este viaje fue solicitado a otro conductor',
      );
    }

    const passengerActiveRide = await this.rideModel.findOne({
      passenger: ride.passenger,
      status: { $in: RIDE_ACTIVE_STATUSES },
      _id: { $ne: ride._id },
    });
    if (passengerActiveRide) {
      throw new BadRequestException('El pasajero tiene otro viaje activo');
    }

    const user = await this.userService.getUserById(userId);

    ride.driver = driver._id as Types.ObjectId;
    ride.driver_email = user?.email || '';
    ride.driver_name = driver.name;
    ride.status = RideStatus.ACCEPTED;
    ride.accepted_at = new Date();
    ride.ride_chat_enabled = true;
    await ride.save();

    this.eventEmitter.emit('ride.accepted', ride);

    return ride;
  }

  async startRide(userId: string, rideId: string): Promise<RideDocument> {
    const driver = await this.driverService.getActiveByUserId(userId);
    if (!driver) {
      throw new NotFoundException('Conductor no encontrado');
    }

    const ride = await this.rideModel.findById(rideId);
    if (!ride) {
      throw new NotFoundException('Viaje no encontrado');
    }

    if (!ride.driver || ride.driver.toString() !== driver._id.toString()) {
      throw new UnauthorizedException('No estás asignado a este viaje');
    }

    if (ride.status !== RideStatus.ACCEPTED) {
      throw new BadRequestException('El viaje debe estar en estado accepted');
    }

    ride.status = RideStatus.IN_PROGRESS;
    await ride.save();

    this.eventEmitter.emit('ride.started', ride);

    return ride;
  }

  async completeRide(
    userId: string,
    rideId: string,
    actualFare?: number,
  ): Promise<RideDocument> {
    const driver = await this.driverService.getActiveByUserId(userId);
    if (!driver) {
      throw new NotFoundException('Conductor no encontrado');
    }

    const ride = await this.rideModel.findById(rideId);
    if (!ride) {
      throw new NotFoundException('Viaje no encontrado');
    }

    if (!ride.driver || ride.driver.toString() !== driver._id.toString()) {
      throw new UnauthorizedException('No estás asignado a este viaje');
    }

    if (ride.status !== RideStatus.IN_PROGRESS) {
      throw new BadRequestException('El viaje debe estar en progreso');
    }

    ride.status = RideStatus.COMPLETED;
    ride.completed_at = new Date();
    ride.actual_fare = actualFare || ride.estimated_fare;
    ride.ride_chat_enabled = false;
    await ride.save();

    await this.driverService.incrementTrips(driver.user.toString());

    this.eventEmitter.emit('ride.completed', ride);

    return ride;
  }

  async cancelRide(
    userId: string,
    rideId: string,
    reason?: string,
  ): Promise<RideDocument> {
    const ride = await this.rideModel.findById(rideId);
    if (!ride) {
      throw new NotFoundException('Viaje no encontrado');
    }

    const passenger = await this.passengerService.getActiveByUserId(userId);
    const driver = await this.driverService.getActiveByUserId(userId);

    const isPassenger =
      passenger && ride.passenger.toString() === passenger._id.toString();
    const isDriver =
      driver && ride.driver && ride.driver.toString() === driver._id.toString();

    if (!isPassenger && !isDriver) {
      throw new UnauthorizedException(
        'No tienes permiso para cancelar este viaje',
      );
    }

    if (
      ride.status === RideStatus.COMPLETED ||
      ride.status === RideStatus.CANCELLED
    ) {
      throw new BadRequestException('Este viaje ya no puede ser cancelado');
    }

    ride.status = RideStatus.CANCELLED;
    ride.cancelled_at = new Date();
    ride.cancellation_reason = reason;
    ride.ride_chat_enabled = false;
    await ride.save();

    this.eventEmitter.emit('ride.cancelled', ride);

    return ride;
  }

  async rateRide(
    userId: string,
    rideId: string,
    dto: RateRideDto,
  ): Promise<RideDocument> {
    const ride = await this.rideModel.findById(rideId);
    if (!ride) {
      throw new NotFoundException('Viaje no encontrado');
    }

    if (ride.status !== RideStatus.COMPLETED) {
      throw new BadRequestException('Solo puedes calificar viajes completados');
    }

    const passenger = await this.passengerService.getActiveByUserId(userId);
    const driver = await this.driverService.getActiveByUserId(userId);

    const isPassenger =
      passenger && ride.passenger.toString() === passenger._id.toString();
    const isDriver =
      driver && ride.driver && ride.driver.toString() === driver._id.toString();

    if (!isPassenger && !isDriver) {
      throw new UnauthorizedException(
        'No tienes permiso para calificar este viaje',
      );
    }

    if (isPassenger) {
      ride.passenger_rating = dto.rating;
      ride.passenger_comment = dto.comment;
      if (driver) {
        await this.driverService.addRating(driver.user.toString(), dto.rating);
      }
    } else if (isDriver) {
      ride.driver_rating = dto.rating;
      ride.driver_comment = dto.comment;
      if (passenger) {
        await this.passengerService.addRating(
          passenger.user.toString(),
          dto.rating,
        );
      }
    }

    await ride.save();
    this.eventEmitter.emit('ride.rated', ride);

    return ride;
  }

  async getRideById(rideId: string): Promise<RideDocument | null> {
    return this.rideModel.findById(rideId).populate('passenger driver');
  }

  async getPendingRides(): Promise<RideDocument[]> {
    return this.rideModel
      .find({ status: RideStatus.PENDING })
      .populate('passenger');
  }

  async getActiveRideForPassenger(
    userId: string,
  ): Promise<RideDocument | null> {
    const passenger = await this.passengerService.getActiveByUserId(userId);
    if (!passenger) return null;

    return this.rideModel
      .findOne({
        passenger: passenger._id,
        status: { $in: RIDE_ACTIVE_STATUSES },
      })
      .populate('driver');
  }

  async getActiveRideForDriver(userId: string): Promise<RideDocument | null> {
    const driver = await this.driverService.getActiveByUserId(userId);
    if (!driver) return null;

    return this.rideModel
      .findOne({
        driver: driver._id,
        status: { $in: RIDE_ACTIVE_STATUSES },
      })
      .populate('passenger');
  }

  async getRidesForPassenger(userId: string): Promise<RideDocument[]> {
    const passenger = await this.passengerService.getByUserId(userId);
    if (!passenger) return [];

    return this.rideModel
      .find({ passenger: passenger._id })
      .sort({ createdAt: -1 });
  }

  async getRidesForDriver(userId: string): Promise<RideDocument[]> {
    const driver = await this.driverService.getByUserId(userId);
    if (!driver) return [];

    return this.rideModel.find({ driver: driver._id }).sort({ createdAt: -1 });
  }

  /**
   * Retorna rides PENDING dirigidos a un driver específico por su userId.
   * Incluye tanto rides con preferred_driver_id apuntando a él,
   * como rides broadcast (sin preferred_driver_id) para que pueda aceptar cualquiera.
   */
  async getRequestsForDriver(userId: string): Promise<RideDocument[]> {
    const driver = await this.driverService.getActiveByUserId(userId);
    if (!driver) {
      throw new BadRequestException(
        'Debes completar el formulario de conductor para ver solicitudes',
      );
    }

    return this.rideModel
      .find({
        status: RideStatus.PENDING,
        $or: [
          { preferred_driver_id: driver._id.toString() },
          { preferred_driver_id: userId },
          { preferred_driver_id: null },
        ],
      })
      .populate('passenger')
      .sort({ requested_at: -1 });
  }

  /**
   * Retorna rides PENDING dirigidos ÚNICAMENTE a este driver (solicitudes directas).
   */
  async getDirectRequestsForDriver(userId: string): Promise<RideDocument[]> {
    const driver = await this.driverService.getActiveByUserId(userId);
    if (!driver) {
      throw new BadRequestException(
        'Debes completar el formulario de conductor para ver solicitudes',
      );
    }

    return this.rideModel
      .find({
        status: RideStatus.PENDING,
        $or: [
          { preferred_driver_id: driver._id.toString() },
          { preferred_driver_id: userId },
        ],
      })
      .populate('passenger')
      .sort({ requested_at: -1 });
  }
}
