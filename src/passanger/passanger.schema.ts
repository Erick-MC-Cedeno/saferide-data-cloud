import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PassangerDocument = Passanger & Document;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Passanger {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  @Prop({ required: true, unique: true })
  phone: string;

  @Prop({ type: Number, default: 0.0 })
  rating: number;

  @Prop({ type: Number, default: 0 })
  total_trips: number;

  @Prop({ type: String, default: null })
  profile_image?: string;

  @Prop({ type: String, unique: true, sparse: true })
  uid?: string;
}

export const PassangerSchema = SchemaFactory.createForClass(Passanger);

// Ensure uid is unique only when present (ignore documents without uid/null)
PassangerSchema.index(
  { uid: 1 },
  { unique: true, partialFilterExpression: { uid: { $exists: true, $ne: null } } },
);
