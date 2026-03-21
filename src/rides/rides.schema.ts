import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { RideStatus } from './enums/ride-status.enum';

export type RideDocument = Ride & Document;

@Schema({ timestamps: true })
export class Ride {
  @Prop({ type: Types.ObjectId, ref: 'Passanger', required: true })
  passenger: Types.ObjectId;

  @Prop({ required: true })
  passenger_email: string;

  @Prop({ required: true })
  passenger_name: string;

  @Prop({ type: Types.ObjectId, ref: 'Driver' })
  driver?: Types.ObjectId;

  @Prop()
  driver_email?: string;

  @Prop()
  driver_name?: string;

  @Prop({ required: true })
  pickup_address: string;

  @Prop({ type: [Number], required: true })
  pickup_coordinates: number[];

  @Prop({ required: true })
  destination_address: string;

  @Prop({ type: [Number], required: true })
  destination_coordinates: number[];

  @Prop({
    type: String,
    enum: Object.values(RideStatus),
    default: RideStatus.PENDING,
  })
  status: RideStatus;

  @Prop({ type: Number, required: true })
  estimated_fare: number;

  @Prop({ type: Number })
  actual_fare?: number;

  @Prop({ type: Number, required: true })
  estimated_duration: number;

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

  @Prop({ type: Number, min: 1, max: 5 })
  passenger_rating?: number;

  @Prop({ type: Number, min: 1, max: 5 })
  driver_rating?: number;

  @Prop({ type: String })
  driver_comment?: string;

  @Prop({ type: Boolean, default: false })
  ride_chat_enabled: boolean;

  @Prop({ type: String, default: null })
  preferred_driver_id?: string;

  @Prop({ type: [{ lat: Number, lng: Number }], default: [] })
  route_points: { lat: number; lng: number }[];

  @Prop({ type: Number })
  route_distance_m?: number;

  @Prop({ type: Number })
  route_duration_s?: number;
}

export const RideSchema = SchemaFactory.createForClass(Ride);
