import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DriverDocument = Driver & Document;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Driver {
  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  user?: Types.ObjectId;

  @Prop({ required: true, unique: true })
  uid: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  phone: string;

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

  @Prop({ type: Object, default: null })
  current_location: any;

  @Prop({ type: String, default: null })
  profile_image?: string;
}

export const DriverSchema = SchemaFactory.createForClass(Driver);
