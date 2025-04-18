import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { NotificationPriority } from '../../../shared/interfaces/notification.interface';

@Schema({ _id: false })
class NotificationContent {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;

  @Prop()
  image_url?: string;

  @Prop()
  deep_link?: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  data?: Record<string, any>;
}

@Schema({ _id: false })
class NotificationRecipient {
  @Prop({ required: true, index: true })
  user_id: string;

  @Prop({ type: [String] })
  device_ids?: string[];
}

@Schema({ timestamps: { createdAt: 'created_at' } })
export class Notification extends Document {
  @Prop()
  external_id?: string;

  @Prop({ required: true, type: NotificationRecipient })
  recipient: NotificationRecipient;

  @Prop({ required: true, enum: Object.values(NotificationPriority) })
  priority: string;

  @Prop({ required: true, type: NotificationContent })
  notification: NotificationContent;

  @Prop({ type: MongooseSchema.Types.Mixed })
  data?: Record<string, any>;

  @Prop({ required: true })
  source: string;

  @Prop({ required: true, unique: true, index: true })
  idempotency_key: string;

  @Prop()
  ttl?: number;

  @Prop({ type: Date })
  scheduled_at?: Date;

  @Prop({ type: Date, required: true })
  expires_at: Date;

  created_at?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Create indexes
NotificationSchema.index({ idempotency_key: 1 }, { unique: true });
NotificationSchema.index({ 'recipient.user_id': 1 });
NotificationSchema.index({ created_at: 1 });
NotificationSchema.index({ expires_at: 1 });
NotificationSchema.index({ scheduled_at: 1 }); 