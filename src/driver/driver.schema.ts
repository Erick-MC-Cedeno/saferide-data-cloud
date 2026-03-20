import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DriverDocument = Driver & Document;

@Schema({ timestamps: true })
export class Driver {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  user: Types.ObjectId;

  @Prop({ required: true, unique: true })
  phone: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  license_number: string;

  @Prop({ required: true })
  vehicle_plate: string;

  @Prop({ required: true })
  vehicle_model: string;

  @Prop({ required: true })
  vehicle_year: string;

  @Prop({ type: Boolean, default: false })
  is_verified: boolean;

  @Prop({ type: Number, default: 0.0 })
  rating: number;

  @Prop({ type: Number, default: 0 })
  total_trips: number;

  @Prop({ type: Boolean, default: false })
  is_online: boolean;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  })
  current_location: {
    type: 'Point';
    coordinates: number[];
  };

  @Prop({ type: String, default: null })
  profile_image?: string;

  @Prop({ type: Boolean, default: true })
  is_active: boolean;
}

export const DriverSchema = SchemaFactory.createForClass(Driver);

DriverSchema.index({ current_location: '2dsphere' });
