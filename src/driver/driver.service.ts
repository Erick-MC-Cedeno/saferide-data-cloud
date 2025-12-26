import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Driver, DriverDocument } from './driver.schema';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { UserService } from '../user/user.service';
import { PassangerService } from '../passanger/passanger.service';

@Injectable()
export class DriverService {
  constructor(
    @InjectModel(Driver.name) private driverModel: Model<DriverDocument>,
    private readonly userService: UserService,
    @Inject(forwardRef(() => PassangerService)) private readonly passangerService: PassangerService,
  ) {}

  async create(data: CreateDriverDto) {
    // prevent duplicates within drivers
    const existsDriver = await this.driverModel.findOne({ $or: [{ email: data.email }, { phone: data.phone }] }).exec();
    if (existsDriver) {
      throw new BadRequestException('Driver with this email or phone already exists');
    }

    // prevent duplicates across passengers
    const passengerByEmail = await this.passangerService.findByEmail(data.email).catch(() => null);
    const passengerByPhone = await this.passangerService.findByPhone(data.phone).catch(() => null);
    if (passengerByEmail || passengerByPhone) {
      throw new BadRequestException('Email or phone already registered as a passenger');
    }

    const payload: Partial<Driver> = {
      email: data.email,
      name: data.name,
      phone: data.phone,
      license_number: (data as any).licenseNumber || (data as any).license_number,
      vehicle_plate: (data as any).vehiclePlate || (data as any).vehicle_plate,
      vehicle_model: (data as any).vehicleModel || (data as any).vehicle_model,
      vehicle_year: (data as any).vehicleYear || (data as any).vehicle_year,
      is_verified: (data as any).is_verified ?? false,
    };

    if (data.user) {
      payload.user = data.user as any;
    } else {
      const user = await this.userService.ensureUserByEmail(data.email, data.name).catch(() => null);
      if (user) payload.user = user._id as any;
    }

    const created = new this.driverModel(payload);
    return created.save();
  }

  async findByPhone(phone: string) {
    return this.driverModel.findOne({ phone }).exec();
  }

  async findByEmail(email: string) {
    return this.driverModel.findOne({ email }).exec();
  }

  async findAllOnline() {
    return this.driverModel.find({ is_online: true }).exec();
  }

  async updateByEmail(email: string, data: UpdateDriverDto) {
    if (data.email) {
      const user = await this.userService.getUserByEmail(data.email).catch(() => null);
      if (user) (data as any).user = user._id;
    }

    const updated = await this.driverModel.findOneAndUpdate({ email }, data as any, { new: true });
    if (!updated) throw new NotFoundException('Driver not found');
    return updated;
  }
}
