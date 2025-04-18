import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bull';
import { Model } from 'mongoose';
import { Queue } from 'bull';
import { Notification } from './schemas/notification.schema';
import { DeliveryAttempt } from './schemas/delivery-attempt.schema';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { DeviceService } from '../device/device.service';
import { NotificationPriority, NotificationStatus } from '../../shared/interfaces/notification.interface';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<Notification>,
    @InjectModel(DeliveryAttempt.name) private deliveryAttemptModel: Model<DeliveryAttempt>,
    @InjectQueue('notifications') private notificationsQueue: Queue,
    private readonly deviceService: DeviceService,
  ) {}

  /**
   * Create a new notification
   */
  async create(createNotificationDto: CreateNotificationDto): Promise<{ notification_id: string, status: string }> {
    this.logger.log(`Creating notification for user ${createNotificationDto.recipient.user_id}`);
    
    // Check if notification with same idempotency key exists
    const existingNotification = await this.notificationModel.findOne({
      idempotency_key: createNotificationDto.idempotency_key,
    });

    if (existingNotification) {
      this.logger.log(`Notification with idempotency key ${createNotificationDto.idempotency_key} already exists`);
      return {
        notification_id: existingNotification._id.toString(),
        status: 'accepted',
      };
    }

    // Calculate expiration date based on TTL or default to 24 hours
    const ttl = createNotificationDto.ttl || 24 * 60 * 60; // Default 24 hours in seconds
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + ttl);

    // Create notification in database
    const notification = new this.notificationModel({
      ...createNotificationDto,
      expires_at: expiresAt,
    });

    await notification.save();

    // Queue notification for processing
    await this.queueNotification(notification);

    return {
      notification_id: notification._id.toString(),
      status: 'accepted',
    };
  }

  /**
   * Queue a notification for processing based on priority
   */
  private async queueNotification(notification: Notification): Promise<void> {
    const queueOptions = this.getQueueOptionsForPriority(notification.priority);
    
    if (notification.scheduled_at && new Date(notification.scheduled_at) > new Date()) {
      // For scheduled notifications, add delay
      const delay = new Date(notification.scheduled_at).getTime() - Date.now();
      await this.notificationsQueue.add(
        'process', 
        { notification_id: notification._id },
        { ...queueOptions, delay }
      );
      this.logger.log(`Scheduled notification ${notification._id} for ${notification.scheduled_at}`);
    } else {
      // For immediate notifications
      await this.notificationsQueue.add(
        'process', 
        { notification_id: notification._id },
        queueOptions
      );
      this.logger.log(`Queued notification ${notification._id} for immediate processing`);
    }
  }

  /**
   * Get queue options based on notification priority
   */
  private getQueueOptionsForPriority(priority: string): any {
    switch (priority) {
      case NotificationPriority.CRITICAL:
        return { priority: 1, attempts: 10, backoff: { type: 'exponential', delay: 10000 } };
      case NotificationPriority.HIGH:
        return { priority: 2, attempts: 8, backoff: { type: 'exponential', delay: 30000 } };
      case NotificationPriority.MEDIUM:
        return { priority: 3, attempts: 5, backoff: { type: 'exponential', delay: 120000 } };
      case NotificationPriority.LOW:
        return { priority: 4, attempts: 3, backoff: { type: 'exponential', delay: 300000 } };
      default:
        return { priority: 3, attempts: 5, backoff: { type: 'exponential', delay: 60000 } };
    }
  }

  /**
   * Get a notification by ID
   */
  async findById(id: string): Promise<Notification> {
    this.logger.debug(`Finding notification by ID ${id}`);
    const notification = await this.notificationModel.findById(id).exec();
    
    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }
    
    return notification;
  }

  /**
   * Get notifications for a user
   */
  async findByUserId(userId: string): Promise<Notification[]> {
    this.logger.debug(`Finding notifications for user ${userId}`);
    return this.notificationModel.find({
      'recipient.user_id': userId,
    }).sort({ created_at: -1 }).exec();
  }

  /**
   * Record a delivery attempt
   */
  async recordDeliveryAttempt(
    notificationId: string,
    deviceId: string,
    status: NotificationStatus,
    platformResponse?: any,
    errorCode?: string,
    errorMessage?: string,
  ): Promise<DeliveryAttempt> {
    this.logger.debug(`Recording delivery attempt for notification ${notificationId} to device ${deviceId}`);
    
    // Find the highest attempt number for this notification and device
    const lastAttempt = await this.deliveryAttemptModel.findOne({
      notification_id: notificationId,
      device_id: deviceId,
    }).sort({ attempt_number: -1 }).exec();

    const attemptNumber = lastAttempt ? lastAttempt.attempt_number + 1 : 1;

    // Create delivery attempt record
    const deliveryAttempt = new this.deliveryAttemptModel({
      notification_id: notificationId,
      device_id: deviceId,
      attempt_number: attemptNumber,
      status,
      platform_response: platformResponse,
      error_code: errorCode,
      error_message: errorMessage,
    });

    return deliveryAttempt.save();
  }

  /**
   * Get delivery status for a notification
   */
  async getDeliveryStatus(notificationId: string): Promise<{
    notification_id: string;
    status: string;
    created_at: Date;
    processed_at: Date;
    delivery_attempts: any[];
  }> {
    this.logger.debug(`Getting delivery status for notification ${notificationId}`);
    
    const notification = await this.findById(notificationId);
    const deliveryAttempts = await this.deliveryAttemptModel.find({
      notification_id: notificationId,
    }).sort({ attempted_at: 1 }).exec();

    // Calculate overall status based on delivery attempts
    let overallStatus = 'pending';
    
    if (deliveryAttempts.length > 0) {
      const statusCounts = deliveryAttempts.reduce((acc, attempt) => {
        acc[attempt.status] = (acc[attempt.status] || 0) + 1;
        return acc;
      }, {});
      
      if (statusCounts[NotificationStatus.DELIVERED]) {
        overallStatus = 'delivered';
      } else if (statusCounts[NotificationStatus.FAILED] === deliveryAttempts.length) {
        overallStatus = 'failed';
      } else if (statusCounts[NotificationStatus.EXPIRED]) {
        overallStatus = 'expired';
      }
    }

    // Get latest attempt time as processed time
    const latestAttempt = deliveryAttempts.length > 0 
      ? deliveryAttempts[deliveryAttempts.length - 1] 
      : null;

    return {
      notification_id: notification._id.toString(),
      status: overallStatus,
      created_at: notification.created_at,
      processed_at: latestAttempt ? latestAttempt.attempted_at : null,
      delivery_attempts: deliveryAttempts.map(attempt => ({
        device_id: attempt.device_id,
        attempt_number: attempt.attempt_number,
        status: attempt.status,
        attempted_at: attempt.attempted_at,
      })),
    };
  }
} 