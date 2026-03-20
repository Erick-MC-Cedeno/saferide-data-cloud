import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
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

@Injectable()
export class RidesService {
  constructor(
    @InjectModel(Ride.name) private rideModel: Model<RideDocument>,
    private readonly passengerService: PassangerService,
    private readonly driverService: DriverService,
    private readonly userService: UserService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async requestRide(
    userId: string,
    dto: CreateRideRequestDto,
  ): Promise<RideDocument> {
    const passenger = await this.passengerService.getActiveByUserId(userId);
    if (!passenger) {
      throw new NotFoundException(
        'Perfil de pasajero no encontrado o inactivo',
      );
    }

    const existingActiveRide = await this.rideModel.findOne({
      passenger: passenger._id,
      status: { $in: RIDE_ACTIVE_STATUSES },
    });
    if (existingActiveRide) {
      throw new BadRequestException('Ya tienes un viaje activo en progreso');
    }

    const user = await this.userService.getUserById(userId);

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
    });
    await ride.save();

    this.eventEmitter.emit('ride.created', ride);

    return ride;
  }

  async acceptRide(userId: string, rideId: string): Promise<RideDocument> {
    const driver = await this.driverService.getActiveByUserId(userId);
    if (!driver) {
      throw new NotFoundException(
        'Perfil de conductor no encontrado o inactivo',
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
}
