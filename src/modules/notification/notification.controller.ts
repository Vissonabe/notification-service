import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  Param, 
  HttpStatus,
  Logger 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Notification } from './schemas/notification.schema';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new notification' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Notification created successfully',
    schema: {
      properties: {
        notification_id: { type: 'string' },
        status: { type: 'string' }
      }
    }
  })
  async createNotification(@Body() createNotificationDto: CreateNotificationDto): Promise<{ notification_id: string, status: string }> {
    this.logger.log('Create notification request received');
    return this.notificationService.create(createNotificationDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a notification by ID' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Notification found',
    type: Notification
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Notification not found' 
  })
  async getNotification(@Param('id') id: string): Promise<Notification> {
    this.logger.log(`Get notification ${id}`);
    return this.notificationService.findById(id);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get all notifications for a user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'List of notifications for the user',
    type: [Notification]
  })
  async getUserNotifications(@Param('userId') userId: string): Promise<Notification[]> {
    this.logger.log(`Get notifications for user ${userId}`);
    return this.notificationService.findByUserId(userId);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get the delivery status of a notification' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Notification status returned',
    schema: {
      properties: {
        notification_id: { type: 'string' },
        status: { type: 'string' },
        created_at: { type: 'string', format: 'date-time' },
        processed_at: { type: 'string', format: 'date-time' },
        delivery_attempts: { 
          type: 'array',
          items: {
            type: 'object',
            properties: {
              device_id: { type: 'string' },
              attempt_number: { type: 'number' },
              status: { type: 'string' },
              attempted_at: { type: 'string', format: 'date-time' }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Notification not found' 
  })
  async getNotificationStatus(@Param('id') id: string): Promise<any> {
    this.logger.log(`Get status for notification ${id}`);
    return this.notificationService.getDeliveryStatus(id);
  }
} 