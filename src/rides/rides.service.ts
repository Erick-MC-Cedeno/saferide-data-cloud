import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Ride, RideDocument } from './rides.schema';
import { CreateRideDto } from './dto/create-ride.dto';
import { UpdateRideDto } from './dto/update-ride.dto';
import { PassangerService } from '../passanger/passanger.service';
import { DriverService } from '../driver/driver.service';

@Injectable()
export class RidesService {
  constructor(
    @InjectModel(Ride.name) private rideModel: Model<RideDocument>,
    private readonly passangerService: PassangerService,
    private readonly driverService: DriverService,
  ) {}

  async create(dto: CreateRideDto) {
    const data: Partial<Ride> = {
      passenger_email: dto.passenger_email,
      passenger_name: dto.passenger_name,
      driver_email: dto.driver_email,
      driver_name: dto.driver_name,
      pickup_address: dto.pickup_address,
      pickup_coordinates: dto.pickup_coordinates,
      destination_address: dto.destination_address,
      destination_coordinates: dto.destination_coordinates,
      estimated_fare: dto.estimated_fare,
      estimated_duration: dto.estimated_duration,
      status: dto.status ?? 'pending',
      requested_at: new Date(),
    };

    // try to resolve passenger and driver object references
    const passenger = await this.passangerService.findByEmail(dto.passenger_email).catch(() => null);
    if (passenger) data.passenger = (passenger as any)._id;

    if (dto.driver_email) {
      const driver = await this.driverService.findByEmail(dto.driver_email).catch(() => null);
      if (driver) data.driver = (driver as any)._id;
    }

    const created = new this.rideModel(data);
    return created.save();
  }

  async findAll() {
    return this.rideModel.find().exec();
  }

  async findById(id: string) {
    if (!Types.ObjectId.isValid(id)) return this.rideModel.findOne({ id }).exec();
    return this.rideModel.findById(id).exec();
  }

  async findByPassengerEmail(email: string) {
    return this.rideModel.find({ passenger_email: email }).exec();
  }

  async findByDriverEmail(email: string) {
    return this.rideModel.find({ driver_email: email }).exec();
  }

  async updateById(id: string, dto: UpdateRideDto) {
    const updated = await this.rideModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!updated) throw new NotFoundException('Ride not found');
    return updated;
  }

  async cancelRide(id: string, reason?: string, passenger_comment?: string) {
    const updated = await this.rideModel.findByIdAndUpdate(
      id,
      { status: 'cancelled', cancellation_reason: reason ?? 'No reason provided', cancelled_at: new Date(), passenger_comment },
      { new: true },
    );
    if (!updated) throw new NotFoundException('Ride not found');
    return updated;
  }
}
