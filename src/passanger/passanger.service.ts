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
    const [firstName, ...rest] = (data.name || '').split(' ');
    const lastName = rest.join(' ') || '';

    // Validate that the email is not already registered in `users`.
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

    // Ensure there is a full `User` record for this email (creates if missing).
    const ensured = await this.userService.ensureFullUserByEmail(data.email, `${firstName} ${lastName}`, data.password).catch((e) => {
      console.error('[PassangerService] ensureFullUserByEmail error', e && (e as any).message ? (e as any).message : e);
      return null;
    });
    if (ensured) {
      // ensure role is set to passenger
      try {
        if ((ensured as any).role !== 'passenger') {
          (ensured as any).role = 'passenger';
          await (ensured as any).save();
        }
      } catch (e) {
        console.error('[PassangerService] failed to set role on user', e && (e as any).message ? (e as any).message : e);
      }
      data.user = (ensured as any)._id.toString();
    }

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

    if (data.user) {
      payload.user = data.user as any;
    }

    const created = new this.passangerModel(payload);
    const passanger = await created.save();
    return { user: ensured, passanger };
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
