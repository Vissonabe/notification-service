import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { DevicePlatform } from '../../../shared/interfaces/device.interface';

@Schema({ _id: false })
class QuietHours {
  @Prop({ required: true, default: false })
  enabled: boolean;

  @Prop()
  start: string; // HH:MM format

  @Prop()
  end: string; // HH:MM format

  @Prop()
  timezone: string;
}

@Schema({ _id: false })
class NotificationPreferences {
  @Prop({ required: true, default: true })
  enabled: boolean;

  @Prop({ type: Object, default: {} })
  categories: Record<string, boolean>;

  @Prop({ type: QuietHours, default: { enabled: false } })
  quiet_hours: QuietHours;
}

@Schema({ 
  timestamps: { 
    createdAt: 'created_at', 
    updatedAt: 'updated_at' 
  } 
})
export class Device extends Document {
  @Prop({ required: true, index: true })
  user_id: string;

  @Prop({ required: true })
  device_token: string;

  @Prop({ required: true, enum: Object.values(DevicePlatform) })
  platform: string;

  @Prop({ required: true })
  app_version: string;

  @Prop({ required: true })
  device_model: string;

  @Prop({ required: true })
  os_version: string;

  @Prop({ required: true })
  language: string;

  @Prop({ required: true })
  timezone: string;

  @Prop({ type: NotificationPreferences, default: { enabled: true, categories: {}, quiet_hours: { enabled: false } } })
  notification_preferences: NotificationPreferences;

  @Prop({ type: Date, default: Date.now })
  last_seen: Date;

  created_at?: Date;
  updated_at?: Date;
}

export const DeviceSchema = SchemaFactory.createForClass(Device);

// Create indexes
DeviceSchema.index({ user_id: 1 });
DeviceSchema.index({ device_token: 1 }, { unique: true });
DeviceSchema.index({ last_seen: 1 }); 