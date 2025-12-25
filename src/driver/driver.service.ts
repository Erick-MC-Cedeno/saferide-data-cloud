import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Driver, DriverDocument } from './driver.schema';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { UserService } from '../user/user.service';

@Injectable()
export class DriverService {
  constructor(@InjectModel(Driver.name) private driverModel: Model<DriverDocument>, private readonly userService: UserService) {}

  async create(data: CreateDriverDto) {
    const payload: Partial<Driver> = {
      uid: data.uid,
      email: data.email,
      name: data.name,
      phone: data.phone,
      license_number: data.license_number,
      vehicle_plate: data.vehicle_plate,
      vehicle_model: data.vehicle_model,
      vehicle_year: data.vehicle_year,
      is_verified: data.is_verified ?? false,
    };

    if (data.user) {
      payload.user = data.user as any;
    } else {
      const user = await this.userService.ensureUserByEmail(data.email, data.name, data.uid).catch(() => null);
      if (user) payload.user = user._id as any;
    }

    const created = new this.driverModel(payload);
    return created.save();
  }

  async findByUid(uid: string) {
    return this.driverModel.findOne({ uid }).exec();
  }

  async findAllOnline() {
    return this.driverModel.find({ is_online: true }).exec();
  }

  async updateByUid(uid: string, data: UpdateDriverDto) {
    if (data.email) {
      const user = await this.userService.getUserByEmail(data.email).catch(() => null);
      if (user) (data as any).user = user._id;
    }

    const updated = await this.driverModel.findOneAndUpdate({ uid }, data as any, { new: true });
    if (!updated) throw new NotFoundException('Driver not found');
    return updated;
  }
}
