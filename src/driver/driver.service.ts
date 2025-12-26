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
    const [firstName, ...rest] = (data.name || '').split(' ');
    const lastName = rest.join(' ') || '';

    // Ensure the user/email is not already registered in users
    const existingUser = await this.userService.getUserByEmail(data.email).catch(() => null);
    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    // If passwords were provided, ensure they match
    if (data.password || (data as any).confirmPassword) {
      if (!data.password || !(data as any).confirmPassword || data.password !== (data as any).confirmPassword) {
        throw new BadRequestException('Passwords do not match');
      }
    }

    const ensured = await this.userService
      .ensureFullUserByEmail(data.email, `${firstName} ${lastName}`, data.password)
      .catch((e) => {
        console.error('[DriverService] ensureFullUserByEmail error', e && (e as any).message ? (e as any).message : e);
        return null;
      });

    if (ensured) {
      try {
        if ((ensured as any).role !== 'driver') {
          (ensured as any).role = 'driver';
          await (ensured as any).save();
        }
      } catch (e) {
        console.error('[DriverService] failed to set role on user', e && (e as any).message ? (e as any).message : e);
      }
      data.user = (ensured as any)._id.toString();
    }

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
      // Always start as not verified when registering a driver; verification should be done separately
      is_verified: false,
    };

    if (data.user) {
      payload.user = data.user as any;
    }

    const created = new this.driverModel(payload);
    const driver = await created.save();
    return { user: ensured, driver };
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

  async findAll() {
    return this.driverModel.find().exec();
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
