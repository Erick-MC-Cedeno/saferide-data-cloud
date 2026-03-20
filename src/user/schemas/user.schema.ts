import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

@Schema()
export class User {
  @Prop()
  firstName: string;

  @Prop()
  lastName: string;

  @Prop({
    required: true,
    unique: true,
  })
  email: string;

  @Prop({
    required: true,
  })
  password: string;

  _id?: string;

  @Prop({ default: false })
  isValid: boolean;

  @Prop({ default: false })
  isTokenEnabled: boolean;

  @Prop()
  resetPasswordTokenHash?: string;

  @Prop()
  resetPasswordTokenPurpose?: string;

  @Prop({ default: false })
  resetPasswordTokenUsed?: boolean;

  @Prop()
  resetPasswordExpires?: Date;

  @Prop()
  resetPasswordLastSentAt?: number;

  @Prop()
  lastPasswordChange?: number;

  @Prop()
  lastProfileUpdate?: number;

  @Prop({ default: false })
  hasPassengerProfile: boolean;

  @Prop({ default: false })
  hasDriverProfile: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
