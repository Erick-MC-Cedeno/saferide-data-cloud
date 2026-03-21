import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Driver, DriverDocument } from './driver.schema';
import { CreateDriverProfileDto } from './dto/create-driver-profile.dto';
import { UpdateDriverProfileDto } from './dto/update-driver-profile.dto';
import { UserService } from '../user/user.service';

@Injectable()
export class DriverService {
  constructor(
    @InjectModel(Driver.name) private driverModel: Model<DriverDocument>,
    private readonly userService: UserService,
  ) {}

  async createProfile(
    userId: string,
    dto: CreateDriverProfileDto,
  ): Promise<DriverDocument> {
    const user = await this.userService.getUserById(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const exists = await this.driverModel.findOne({
      user: new Types.ObjectId(userId),
    });
    if (exists) {
      throw new BadRequestException(
        'El usuario ya tiene un perfil de conductor',
      );
    }

    const phoneExists = await this.driverModel.findOne({ phone: dto.phone });
    if (phoneExists) {
      throw new BadRequestException('Este número de teléfono ya está en uso');
    }

    const driver = new this.driverModel({
      user: new Types.ObjectId(userId),
      name: dto.name,
      phone: dto.phone,
      license_number: dto.license_number,
      vehicle_plate: dto.vehicle_plate,
      vehicle_model: dto.vehicle_model,
      vehicle_year: dto.vehicle_year,
      profile_image: dto.profile_image,
    });
    await driver.save();

    await this.userService.setHasDriverProfile(userId, true);

    return driver;
  }

  async getByUserId(userId: string): Promise<DriverDocument | null> {
    return this.driverModel.findOne({ user: new Types.ObjectId(userId) });
  }

  async getActiveByUserId(userId: string): Promise<DriverDocument | null> {
    return this.driverModel.findOne({
      user: new Types.ObjectId(userId),
      is_active: true,
    });
  }

  async getByEmail(email: string): Promise<DriverDocument | null> {
    return this.driverModel.findOne({ email });
  }

  async updateProfile(
    userId: string,
    dto: UpdateDriverProfileDto,
  ): Promise<DriverDocument> {
    const driver = await this.getActiveByUserId(userId);
    if (!driver) {
      throw new NotFoundException('Perfil de conductor no encontrado');
    }

    if (dto.phone && dto.phone !== driver.phone) {
      const phoneExists = await this.driverModel.findOne({
        phone: dto.phone,
        _id: { $ne: driver._id },
      });
      if (phoneExists) {
        throw new BadRequestException('Este número de teléfono ya está en uso');
      }
    }

    Object.assign(driver, dto);
    await driver.save();
    return driver;
  }

  async deleteProfile(userId: string): Promise<void> {
    const driver = await this.getByUserId(userId);
    if (!driver) {
      throw new NotFoundException('Perfil de conductor no encontrado');
    }

    driver.is_online = false;
    driver.is_active = false;
    await driver.save();
    await this.userService.setHasDriverProfile(userId, false);
  }

  async reactivateProfile(
    userId: string,
    dto: CreateDriverProfileDto,
  ): Promise<DriverDocument> {
    let driver = await this.getByUserId(userId);

    if (driver) {
      driver.is_active = true;
      driver.name = dto.name || driver.name;
      driver.phone = dto.phone || driver.phone;
      if (dto.profile_image) driver.profile_image = dto.profile_image;
      await driver.save();
    } else {
      driver = await this.createProfile(userId, dto);
    }

    await this.userService.setHasDriverProfile(userId, true);
    return driver;
  }

  async setOnlineStatus(
    userId: string,
    isOnline: boolean,
  ): Promise<DriverDocument> {
    const driver = await this.getActiveByUserId(userId);
    if (!driver) {
      throw new NotFoundException('Perfil de conductor no encontrado');
    }

    driver.is_online = isOnline;
    if (!isOnline) {
      driver.current_location = null as any;
    }
    await driver.save();
    return driver;
  }

  async updateLocation(
    userId: string,
    coordinates: [number, number],
  ): Promise<DriverDocument> {
    const driver = await this.getActiveByUserId(userId);
    if (!driver) {
      throw new NotFoundException('Perfil de conductor no encontrado');
    }

    if (!driver.is_online) {
      throw new BadRequestException(
        'El conductor debe estar online para actualizar ubicación',
      );
    }

    driver.current_location = {
      type: 'Point',
      coordinates: coordinates,
    };
    await driver.save();
    return driver;
  }

  async getNearbyDrivers(
    latitude: number,
    longitude: number,
    radiusKm: number = 10,
  ): Promise<any[]> {
    return this.driverModel
      .aggregate([
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            distanceField: 'distance',
            maxDistance: radiusKm * 1000,
            spherical: true,
          },
        },
        {
          $match: {
            is_active: true,
            is_online: true,
            current_location: { $exists: true, $ne: null },
          },
        },
        // Excluir drivers que ya tienen un viaje activo (accepted o in-progress)
        {
          $lookup: {
            from: 'rides',
            let: { driverId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$driver', '$$driverId'] },
                  status: { $in: ['accepted', 'in-progress'] },
                },
              },
            ],
            as: 'activeRides',
          },
        },
        {
          $match: { activeRides: { $size: 0 } },
        },
        {
          $addFields: {
            distance_km: { $round: [{ $divide: ['$distance', 1000] }, 2] },
          },
        },
        {
          $sort: { distance: 1 },
        },
      ])
      .exec();
  }

  async getActiveOnlineDrivers(): Promise<DriverDocument[]> {
    return this.driverModel.find({
      is_active: true,
      is_online: true,
    });
  }

  async existsForUser(userId: string): Promise<boolean> {
    const driver = await this.driverModel.findOne({
      user: new Types.ObjectId(userId),
      is_active: true,
    });
    return !!driver;
  }

  async addRating(userId: string, rating: number): Promise<void> {
    const driver = await this.getActiveByUserId(userId);
    if (!driver) return;

    const newTotalRatings = driver.rating * driver.total_trips + rating;
    driver.total_trips += 1;
    driver.rating = newTotalRatings / driver.total_trips;
    await driver.save();
  }

  async incrementTrips(userId: string): Promise<void> {
    const driver = await this.getActiveByUserId(userId);
    if (driver) {
      driver.total_trips += 1;
      await driver.save();
    }
  }
}
