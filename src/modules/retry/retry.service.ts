import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { NotificationPriority } from '../../shared/interfaces/notification.interface';

@Injectable()
export class RetryService {
  private readonly logger = new Logger(RetryService.name);

  constructor(
    @InjectQueue('notifications') private notificationsQueue: Queue,
  ) {}

  /**
   * Schedule a retry for a failed notification
   */
  async scheduleRetry(
    notificationId: string,
    priority: NotificationPriority,
    attemptNumber: number,
  ): Promise<void> {
    this.logger.log(`Scheduling retry #${attemptNumber} for notification ${notificationId}`);
    
    // Calculate backoff delay based on attempt number and priority
    const delay = this.calculateBackoffDelay(priority, attemptNumber);
    
    // Add job back to queue with delay
    await this.notificationsQueue.add(
      'process',
      { notification_id: notificationId },
      {
        delay,
        attempts: this.getMaxAttemptsForPriority(priority) - attemptNumber,
        backoff: {
          type: 'exponential',
          delay: this.getBaseDelayForPriority(priority),
        },
      },
    );
    
    this.logger.log(`Retry for notification ${notificationId} scheduled with ${delay}ms delay`);
  }

  /**
   * Calculate exponential backoff delay based on priority and attempt number
   */
  private calculateBackoffDelay(
    priority: NotificationPriority,
    attemptNumber: number,
  ): number {
    const baseDelay = this.getBaseDelayForPriority(priority);
    
    // Exponential backoff: baseDelay * 2^(attemptNumber-1)
    // With some jitter to prevent thundering herd
    const delay = baseDelay * Math.pow(2, attemptNumber - 1);
    const jitter = Math.random() * 0.3 * delay; // 30% jitter
    
    return Math.floor(delay + jitter);
  }

  /**
   * Get base delay for priority (in ms)
   */
  private getBaseDelayForPriority(priority: NotificationPriority): number {
    switch (priority) {
      case NotificationPriority.CRITICAL:
        return 10000; // 10 seconds
      case NotificationPriority.HIGH:
        return 30000; // 30 seconds
      case NotificationPriority.MEDIUM:
        return 120000; // 2 minutes
      case NotificationPriority.LOW:
        return 300000; // 5 minutes
      default:
        return 60000; // 1 minute
    }
  }

  /**
   * Get maximum number of attempts for a priority
   */
  private getMaxAttemptsForPriority(priority: NotificationPriority): number {
    switch (priority) {
      case NotificationPriority.CRITICAL:
        return 10;
      case NotificationPriority.HIGH:
        return 8;
      case NotificationPriority.MEDIUM:
        return 5;
      case NotificationPriority.LOW:
        return 3;
      default:
        return 5;
    }
  }

  /**
   * Calculate if a notification should be retried based on attempt number and max attempts
   */
  shouldRetry(priority: NotificationPriority, attemptNumber: number): boolean {
    return attemptNumber < this.getMaxAttemptsForPriority(priority);
  }
} 