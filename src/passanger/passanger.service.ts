import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Passanger, PassangerDocument } from './passanger.schema';
import { CreatePassangerDto } from './dto/create-passanger.dto';
import { UpdatePassangerDto } from './dto/update-passanger.dto';
import { UserService } from '../user/user.service';
import { DriverService } from '../driver/driver.service';

@Injectable()
export class PassangerService {
  constructor(
    @InjectModel(Passanger.name) private passangerModel: Model<PassangerDocument>,
    private readonly userService: UserService,
    @Inject(forwardRef(() => DriverService)) private readonly driverService: DriverService,
  ) {}

  async create(data: CreatePassangerDto) {
    // prevent duplicates within passangers
    const existsPassanger = await this.passangerModel.findOne({ $or: [{ email: data.email }, { phone: data.phone }] }).exec();
    if (existsPassanger) {
      throw new BadRequestException('Passanger with this email or phone already exists');
    }

    // prevent duplicates across drivers
    const driverByEmail = await this.driverService.findByEmail(data.email).catch(() => null);
    const driverByPhone = await this.driverService.findByPhone(data.phone).catch(() => null);
    if (driverByEmail || driverByPhone) {
      throw new BadRequestException('Email or phone already registered as a driver');
    }

    const payload: Partial<Passanger> = {
      email: data.email,
      name: data.name,
      phone: data.phone,
    };

    // if controller already provided a `user` id, use it; otherwise ensure/create a User
    if (data.user) {
      payload.user = data.user as any;
    } else {
      const user = await this.userService.ensureUserByEmail(data.email, data.name).catch(() => null);
      if (user) payload.user = user._id as any;
    }

    const created = new this.passangerModel(payload);
    return created.save();
  }

  async findByEmail(email: string) {
    return this.passangerModel.findOne({ email }).exec();
  }

  async findByPhone(phone: string) {
    return this.passangerModel.findOne({ phone }).exec();
  }

  async findAll() {
    return this.passangerModel.find().exec();
  }

  async updateByEmail(email: string, data: UpdatePassangerDto) {
    // if email changed, try to link user
    if (data.email) {
      const user = await this.userService.getUserByEmail(data.email).catch(() => null);
      if (user) (data as any).user = user._id;
    }

    const updated = await this.passangerModel.findOneAndUpdate({ email }, data as any, {
      new: true,
    });
    if (!updated) throw new NotFoundException('Passanger not found');
    return updated;
  }
}
