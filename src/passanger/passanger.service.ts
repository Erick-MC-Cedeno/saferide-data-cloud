import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Passanger, PassangerDocument } from './passanger.schema';
import { CreatePassangerProfileDto } from './dto/create-passanger-profile.dto';
import { UpdatePassangerProfileDto } from './dto/update-passanger-profile.dto';
import { UserService } from '../user/user.service';

@Injectable()
export class PassangerService {
  constructor(
    @InjectModel(Passanger.name)
    private passangerModel: Model<PassangerDocument>,
    private readonly userService: UserService,
  ) {}

  async createProfile(
    userId: string,
    dto: CreatePassangerProfileDto,
  ): Promise<PassangerDocument> {
    const user = await this.userService.getUserById(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const exists = await this.passangerModel.findOne({
      user: new Types.ObjectId(userId),
    });
    if (exists) {
      throw new BadRequestException(
        'El usuario ya tiene un perfil de pasajero',
      );
    }

    const phoneExists = await this.passangerModel.findOne({ phone: dto.phone });
    if (phoneExists) {
      throw new BadRequestException('Este número de teléfono ya está en uso');
    }

    const passenger = new this.passangerModel({
      user: new Types.ObjectId(userId),
      name: dto.name,
      phone: dto.phone,
      profile_image: dto.profile_image,
    });
    await passenger.save();

    await this.userService.setHasPassengerProfile(userId, true);

    return passenger;
  }

  async getByUserId(userId: string): Promise<PassangerDocument | null> {
    return this.passangerModel.findOne({ user: new Types.ObjectId(userId) });
  }

  async getActiveByUserId(userId: string): Promise<PassangerDocument | null> {
    return this.passangerModel.findOne({
      user: new Types.ObjectId(userId),
      is_active: true,
    });
  }

  async getByEmail(email: string): Promise<PassangerDocument | null> {
    return this.passangerModel.findOne({ email });
  }

  async updateProfile(
    userId: string,
    dto: UpdatePassangerProfileDto,
  ): Promise<PassangerDocument> {
    const passenger = await this.getActiveByUserId(userId);
    if (!passenger) {
      throw new NotFoundException('Perfil de pasajero no encontrado');
    }

    if (dto.phone && dto.phone !== passenger.phone) {
      const phoneExists = await this.passangerModel.findOne({
        phone: dto.phone,
        _id: { $ne: passenger._id },
      });
      if (phoneExists) {
        throw new BadRequestException('Este número de teléfono ya está en uso');
      }
    }

    Object.assign(passenger, dto);
    await passenger.save();
    return passenger;
  }

  async deleteProfile(userId: string): Promise<void> {
    const passenger = await this.getByUserId(userId);
    if (!passenger) {
      throw new NotFoundException('Perfil de pasajero no encontrado');
    }

    passenger.is_active = false;
    await passenger.save();
    await this.userService.setHasPassengerProfile(userId, false);
  }

  async reactivateProfile(
    userId: string,
    dto: CreatePassangerProfileDto,
  ): Promise<PassangerDocument> {
    let passenger = await this.getByUserId(userId);

    if (passenger) {
      passenger.is_active = true;
      passenger.name = dto.name || passenger.name;
      passenger.phone = dto.phone || passenger.phone;
      if (dto.profile_image) passenger.profile_image = dto.profile_image;
      await passenger.save();
    } else {
      passenger = await this.createProfile(userId, dto);
    }

    await this.userService.setHasPassengerProfile(userId, true);
    return passenger;
  }

  async existsForUser(userId: string): Promise<boolean> {
    const passenger = await this.passangerModel.findOne({
      user: new Types.ObjectId(userId),
      is_active: true,
    });
    return !!passenger;
  }

  async addRating(userId: string, rating: number): Promise<void> {
    const passenger = await this.getActiveByUserId(userId);
    if (!passenger) return;

    const newTotalRatings = passenger.rating * passenger.total_trips + rating;
    passenger.total_trips += 1;
    passenger.rating = newTotalRatings / passenger.total_trips;
    await passenger.save();
  }

  async incrementTrips(userId: string): Promise<void> {
    const passenger = await this.getActiveByUserId(userId);
    if (passenger) {
      passenger.total_trips += 1;
      await passenger.save();
    }
  }
}
