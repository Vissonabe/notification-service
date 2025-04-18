import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { 
  IsEnum, 
  IsString, 
  IsObject, 
  IsOptional, 
  ValidateNested, 
  IsArray, 
  ArrayMinSize, 
  IsDateString, 
  IsNumber,
  Min,
} from 'class-validator';
import { NotificationPriority } from '../../../shared/interfaces/notification.interface';

class NotificationContentDto {
  @ApiProperty({ description: 'Notification title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Notification body' })
  @IsString()
  body: string;

  @ApiPropertyOptional({ description: 'URL to an image to display in the notification' })
  @IsString()
  @IsOptional()
  image_url?: string;

  @ApiPropertyOptional({ description: 'Deep link to open in the app' })
  @IsString()
  @IsOptional()
  deep_link?: string;

  @ApiPropertyOptional({ description: 'Additional data for the notification payload' })
  @IsObject()
  @IsOptional()
  data?: Record<string, any>;
}

class NotificationRecipientDto {
  @ApiProperty({ description: 'User ID to send the notification to' })
  @IsString()
  user_id: string;

  @ApiPropertyOptional({ 
    description: 'Specific device IDs to target. If not provided, notification will be sent to all user devices',
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @IsOptional()
  device_ids?: string[];
}

export class CreateNotificationDto {
  @ApiProperty({ type: NotificationRecipientDto })
  @ValidateNested()
  @Type(() => NotificationRecipientDto)
  recipient: NotificationRecipientDto;

  @ApiProperty({ 
    enum: NotificationPriority,
    enumName: 'NotificationPriority',
    description: 'Priority level of the notification'
  })
  @IsEnum(NotificationPriority)
  priority: NotificationPriority;

  @ApiProperty({ type: NotificationContentDto })
  @ValidateNested()
  @Type(() => NotificationContentDto)
  notification: NotificationContentDto;

  @ApiPropertyOptional({ description: 'Additional data payload' })
  @IsObject()
  @IsOptional()
  data?: Record<string, any>;

  @ApiProperty({ description: 'Source service or system sending the notification' })
  @IsString()
  source: string;

  @ApiProperty({ description: 'Unique key to prevent duplicate notifications' })
  @IsString()
  idempotency_key: string;

  @ApiPropertyOptional({ description: 'Time-to-live in seconds' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  ttl?: number;

  @ApiPropertyOptional({ description: 'When to send the notification (ISO datetime)' })
  @IsDateString()
  @IsOptional()
  scheduled_at?: string;
} 