import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PassangerDocument = Passanger & Document;

@Schema({ timestamps: true })
export class Passanger {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  user: Types.ObjectId;

  @Prop({ required: true, unique: true })
  phone: string;

  @Prop({ required: true })
  name: string;

  @Prop({ type: Number, default: 0.0 })
  rating: number;

  @Prop({ type: Number, default: 0 })
  total_trips: number;

  @Prop({ type: String, default: null })
  profile_image?: string;

  @Prop({ type: Boolean, default: true })
  is_active: boolean;
}

export const PassangerSchema = SchemaFactory.createForClass(Passanger);
