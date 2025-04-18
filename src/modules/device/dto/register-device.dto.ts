import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { 
  IsEnum, 
  IsString, 
  IsBoolean, 
  IsOptional, 
  ValidateNested, 
  IsObject
} from 'class-validator';
import { DevicePlatform } from '../../../shared/interfaces/device.interface';

class QuietHoursDto {
  @ApiProperty({ description: 'Whether quiet hours are enabled' })
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({ description: 'Start time of quiet hours (HH:MM)' })
  @IsString()
  @IsOptional()
  start?: string;

  @ApiPropertyOptional({ description: 'End time of quiet hours (HH:MM)' })
  @IsString()
  @IsOptional()
  end?: string;

  @ApiPropertyOptional({ description: 'Timezone for quiet hours' })
  @IsString()
  @IsOptional()
  timezone?: string;
}

class NotificationPreferencesDto {
  @ApiProperty({ description: 'Whether notifications are enabled for this device' })
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({ description: 'Category-specific notification preferences' })
  @IsObject()
  @IsOptional()
  categories?: Record<string, boolean>;

  @ApiPropertyOptional({ description: 'Quiet hours configuration' })
  @ValidateNested()
  @Type(() => QuietHoursDto)
  @IsOptional()
  quiet_hours?: QuietHoursDto;
}

export class RegisterDeviceDto {
  @ApiProperty({ description: 'User ID associated with this device' })
  @IsString()
  user_id: string;

  @ApiProperty({ description: 'Device token for push notifications (FCM or APNs)' })
  @IsString()
  device_token: string;

  @ApiProperty({
    enum: DevicePlatform,
    enumName: 'DevicePlatform',
    description: 'Device platform (android or ios)'
  })
  @IsEnum(DevicePlatform)
  platform: DevicePlatform;

  @ApiProperty({ description: 'App version installed on the device' })
  @IsString()
  app_version: string;

  @ApiProperty({ description: 'Device model (e.g., "iPhone 13", "Pixel 6")' })
  @IsString()
  device_model: string;

  @ApiProperty({ description: 'OS version (e.g., "iOS 15.4", "Android 13")' })
  @IsString()
  os_version: string;

  @ApiProperty({ description: 'Preferred language code (e.g., "en-US")' })
  @IsString()
  language: string;

  @ApiProperty({ description: 'Device timezone (e.g., "America/New_York")' })
  @IsString()
  timezone: string;

  @ApiPropertyOptional({ description: 'Notification preferences for this device' })
  @ValidateNested()
  @Type(() => NotificationPreferencesDto)
  @IsOptional()
  notification_preferences?: NotificationPreferencesDto;
} 