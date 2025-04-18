import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { NotificationStatus } from '../../../shared/interfaces/notification.interface';

@Schema({ timestamps: { createdAt: 'attempted_at' } })
export class DeliveryAttempt extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Notification', required: true, index: true })
  notification_id: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Device', required: true, index: true })
  device_id: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  attempt_number: number;

  @Prop({ required: true, enum: Object.values(NotificationStatus) })
  status: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  platform_response?: any;

  @Prop()
  error_code?: string;

  @Prop()
  error_message?: string;

  attempted_at?: Date;
}

export const DeliveryAttemptSchema = SchemaFactory.createForClass(DeliveryAttempt);

// Create indexes
DeliveryAttemptSchema.index({ notification_id: 1, device_id: 1, attempt_number: 1 });
DeliveryAttemptSchema.index({ notification_id: 1, status: 1 });
DeliveryAttemptSchema.index({ attempted_at: 1 }); 