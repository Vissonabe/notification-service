import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';

@Injectable()
export class LogsService implements LoggerService {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
      defaultMeta: { service: 'notification-service' },
      transports: [
        new winston.transports.Console(),
        // In a production environment, you would add additional transports
        // such as file or remote logging service
      ],
    });
  }

  log(message: string, context?: string): void {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string): void {
    this.logger.error(message, { trace, context });
  }

  warn(message: string, context?: string): void {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string): void {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: string): void {
    this.logger.verbose(message, { context });
  }

  /**
   * Log an API request
   */
  logRequest(req: any, res: any, duration: number): void {
    this.logger.info('API Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('user-agent') || '',
      ip: req.ip,
    });
  }

  /**
   * Log a notification event
   */
  logNotificationEvent(eventType: string, notificationId: string, data?: any): void {
    this.logger.info('Notification Event', {
      eventType,
      notificationId,
      ...data,
    });
  }

  /**
   * Log a device event
   */
  logDeviceEvent(eventType: string, deviceId: string, userId: string, data?: any): void {
    this.logger.info('Device Event', {
      eventType,
      deviceId,
      userId,
      ...data,
    });
  }
} 