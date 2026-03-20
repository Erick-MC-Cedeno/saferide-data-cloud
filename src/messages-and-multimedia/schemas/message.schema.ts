import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  @Prop()
  content: string;

  @Prop({ enum: ['text', 'image', 'video', 'audio'], default: 'text' })
  type: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  receiver: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Ride', required: false })
  ride?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Multimedia' })
  multimediaId?: Types.ObjectId;

  @Prop({
    enum: ['uploading', 'processing', 'ready', 'failed'],
    required: false,
  })
  multimediaStatus?: string;

  @Prop({ enum: ['sent', 'delivered', 'read'], default: 'sent' })
  status: string;

  @Prop()
  duration?: number;

  _id?: string;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
MessageSchema.index({ receiver: 1, createdAt: -1 });
MessageSchema.index({ sender: 1, createdAt: -1 });
MessageSchema.index({ ride: 1, createdAt: -1 });

MessageSchema.set('toJSON', {
  transform: function (doc: any, ret: any) {
    ret._id = ret._id?.toString();
    delete ret.__v;
  },
});
