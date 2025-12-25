import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Passanger, PassangerDocument } from './passanger.schema';
import { CreatePassangerDto } from './dto/create-passanger.dto';
import { UpdatePassangerDto } from './dto/update-passanger.dto';
import { UserService } from '../user/user.service';

@Injectable()
export class PassangerService {
  constructor(
    @InjectModel(Passanger.name) private passangerModel: Model<PassangerDocument>,
    private readonly userService: UserService,
  ) {}

  async create(data: CreatePassangerDto) {
    const payload: Partial<Passanger> = {
      uid: data.uid,
      email: data.email,
      name: data.name,
      phone: data.phone,
    };

    // if controller already provided a `user` id, use it; otherwise ensure/create a User
    if (data.user) {
      payload.user = data.user as any;
    } else {
      const user = await this.userService.ensureUserByEmail(data.email, data.name, data.uid).catch(() => null);
      if (user) payload.user = user._id as any;
    }

    const created = new this.passangerModel(payload);
    return created.save();
  }

  async findByUid(uid: string) {
    return this.passangerModel.findOne({ uid }).exec();
  }

  async findAll() {
    return this.passangerModel.find().exec();
  }

  async updateByUid(uid: string, data: UpdatePassangerDto) {
    // if email changed, try to link user
    if (data.email) {
      const user = await this.userService.getUserByEmail(data.email).catch(() => null);
      if (user) (data as any).user = user._id;
    }

    const updated = await this.passangerModel.findOneAndUpdate({ uid }, data as any, {
      new: true,
    });
    if (!updated) throw new NotFoundException('Passanger not found');
    return updated;
  }
}
