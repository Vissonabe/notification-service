import { Processor, Process } from '@nestjs/bull';
import { Logger, Injectable } from '@nestjs/common';
import { Job } from 'bull';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationService } from './notification.service';
import { DeviceService } from '../device/device.service';
import { Notification } from './schemas/notification.schema';
import { DevicePlatform } from '../../shared/interfaces/device.interface';
import { NotificationStatus } from '../../shared/interfaces/notification.interface';

@Injectable()
@Processor('notifications')
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<Notification>,
    private readonly notificationService: NotificationService,
    private readonly deviceService: DeviceService,
  ) {}

  @Process('process')
  async processNotification(job: Job<{ notification_id: string }>): Promise<void> {
    this.logger.log(`Processing notification job ${job.id} for notification ${job.data.notification_id}`);

    try {
      // Get notification from database
      const notification = await this.notificationService.findById(job.data.notification_id) as any;

      // Check if notification is expired
      if (notification.expires_at && new Date() > notification.expires_at) {
        this.logger.warn(`Notification ${notification._id} has expired`);
        return;
      }

      // Get target devices
      let devices;
      if (notification.recipient.device_ids && notification.recipient.device_ids.length > 0) {
        // Send to specific devices
        devices = await this.deviceService.findByIds(notification.recipient.device_ids);
      } else {
        // Send to all user devices
        devices = await this.deviceService.findByUserId(notification.recipient.user_id);
      }

      if (!devices || devices.length === 0) {
        this.logger.warn(`No devices found for notification ${notification._id}`);
        return;
      }

      // Process each device
      for (const device of devices) {
        try {
          // Check if device has notifications enabled
          if (!device.notification_preferences || !device.notification_preferences.enabled) {
            this.logger.debug(`Notifications disabled for device ${device._id}`);
            await this.notificationService.recordDeliveryAttempt(
              notification._id.toString(),
              device._id.toString(),
              NotificationStatus.FAILED,
              null,
              'NOTIFICATIONS_DISABLED',
              'Notifications are disabled for this device'
            );
            continue;
          }

          // Check quiet hours if configured
          if (this.isInQuietHours(device)) {
            this.logger.debug(`Device ${device._id} is in quiet hours`);
            await this.notificationService.recordDeliveryAttempt(
              notification._id.toString(),
              device._id.toString(),
              NotificationStatus.FAILED,
              null,
              'QUIET_HOURS',
              'Device is in quiet hours'
            );
            continue;
          }

          // Send notification based on platform
          // Note: In a real implementation, this would call platform-specific adapters (FCM/APNS)
          let success = false;
          let platformResponse: any = null;
          let errorCode: string | undefined = undefined;
          let errorMessage: string | undefined = undefined;

          if (device.platform === DevicePlatform.ANDROID) {
            // Mock Android FCM implementation
            this.logger.debug(`Sending Android notification to device ${device._id}`);
            try {
              // Here would be the actual FCM sending logic
              success = true; // Simulated success
              platformResponse = { message_id: `fcm-${Date.now()}` };
            } catch (error: any) {
              success = false;
              errorCode = 'FCM_ERROR';
              errorMessage = error.message;
            }
          } else if (device.platform === DevicePlatform.IOS) {
            // Mock iOS APNS implementation
            this.logger.debug(`Sending iOS notification to device ${device._id}`);
            try {
              // Here would be the actual APNS sending logic
              success = true; // Simulated success
              platformResponse = { apns_id: `apns-${Date.now()}` };
            } catch (error: any) {
              success = false;
              errorCode = 'APNS_ERROR';
              errorMessage = error.message;
            }
          } else {
            success = false;
            errorCode = 'UNKNOWN_PLATFORM';
            errorMessage = `Unknown platform: ${device.platform}`;
          }

          // Record delivery attempt
          await this.notificationService.recordDeliveryAttempt(
            notification._id.toString(),
            device._id.toString(),
            success ? NotificationStatus.DELIVERED : NotificationStatus.FAILED,
            platformResponse,
            errorCode,
            errorMessage
          );

          // Update device last seen
          await this.deviceService.updateLastSeen(device._id.toString());
        } catch (deviceError) {
          this.logger.error(`Error processing device ${device._id}: ${deviceError.message}`);
          await this.notificationService.recordDeliveryAttempt(
            notification._id.toString(),
            device._id.toString(),
            NotificationStatus.FAILED,
            null,
            'PROCESSING_ERROR',
            deviceError.message
          );
        }
      }

      this.logger.log(`Completed processing notification ${notification._id}`);
    } catch (error) {
      this.logger.error(`Error processing notification ${job.data.notification_id}: ${error.message}`);
      throw error; // Let Bull handle retry logic
    }
  }

  /**
   * Check if device is currently in quiet hours
   */
  private isInQuietHours(device: any): boolean {
    if (!device.notification_preferences || !device.notification_preferences.quiet_hours) {
      return false;
    }

    const quietHours = device.notification_preferences.quiet_hours;

    if (!quietHours || !quietHours.enabled || !quietHours.start || !quietHours.end) {
      return false;
    }

    try {
      const now = new Date();
      const deviceTimezone = quietHours.timezone || device.timezone || 'UTC';

      // Get current time in device's timezone
      const deviceTime = now.toLocaleString('en-US', { timeZone: deviceTimezone });
      const deviceDate = new Date(deviceTime);

      // Extract hours and minutes
      const currentHour = deviceDate.getHours();
      const currentMinute = deviceDate.getMinutes();
      const currentTimeMinutes = currentHour * 60 + currentMinute;

      // Parse quiet hours start and end times
      const [startHour, startMinute] = quietHours.start.split(':').map(Number);
      const [endHour, endMinute] = quietHours.end.split(':').map(Number);

      const startTimeMinutes = startHour * 60 + startMinute;
      const endTimeMinutes = endHour * 60 + endMinute;

      // Check if current time is within quiet hours
      if (startTimeMinutes < endTimeMinutes) {
        // Normal case (e.g., 22:00 to 07:00)
        return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes;
      } else {
        // Overnight case (e.g., 22:00 to 07:00)
        return currentTimeMinutes >= startTimeMinutes || currentTimeMinutes <= endTimeMinutes;
      }
    } catch (error: any) {
      this.logger.error(`Error checking quiet hours: ${error.message}`);
      return false; // Default to not in quiet hours if there's an error
    }
  }
}