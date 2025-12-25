import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RideDocument = Ride & Document;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Ride {
  @Prop({ type: Types.ObjectId, ref: 'Passanger', required: false })
  passenger?: Types.ObjectId;

  @Prop({ required: true })
  passenger_uid: string;

  @Prop({ required: true })
  passenger_name: string;

  @Prop({ type: Types.ObjectId, ref: 'Driver', required: false })
  driver?: Types.ObjectId;

  @Prop()
  driver_uid?: string;

  @Prop()
  driver_name?: string;

  @Prop({ required: true })
  pickup_address: string;

  @Prop({ type: [Number], required: true })
  pickup_coordinates: number[]; // [longitude, latitude]

  @Prop({ required: true })
  destination_address: string;

  @Prop({ type: [Number], required: true })
  destination_coordinates: number[]; // [longitude, latitude]

  @Prop({
    enum: ['pending', 'accepted', 'in-progress', 'completed', 'cancelled'],
    default: 'pending',
  })
  status: string;

  @Prop({ type: Number, required: true })
  estimated_fare: number;

  @Prop({ type: Number })
  actual_fare?: number;

  @Prop({ type: Number, required: true })
  estimated_duration: number; // minutes

  @Prop()
  requested_at?: Date;

  @Prop()
  accepted_at?: Date;

  @Prop()
  completed_at?: Date;

  @Prop()
  cancelled_at?: Date;

  @Prop()
  cancellation_reason?: string;

  @Prop()
  passenger_comment?: string;

  @Prop({ type: Number })
  passenger_rating?: number;

  @Prop({ type: Number })
  driver_rating?: number;
}

export const RideSchema = SchemaFactory.createForClass(Ride);
