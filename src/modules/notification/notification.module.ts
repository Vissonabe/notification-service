import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationProcessor } from './notification.processor';
import { Notification, NotificationSchema } from './schemas/notification.schema';
import { DeliveryAttempt, DeliveryAttemptSchema } from './schemas/delivery-attempt.schema';
import { DeviceModule } from '../device/device.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: DeliveryAttempt.name, schema: DeliveryAttemptSchema }
    ]),
    BullModule.registerQueue({
      name: 'notifications',
    }),
    DeviceModule
  ],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationProcessor],
  exports: [NotificationService]
})
export class NotificationModule {} 