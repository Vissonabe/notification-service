export enum DevicePlatform {
  ANDROID = 'android',
  IOS = 'ios',
}

export interface NotificationPreferences {
  enabled: boolean;
  categories?: Record<string, boolean>;
  quiet_hours?: {
    enabled: boolean;
    start: string; // HH:MM format
    end: string; // HH:MM format
    timezone: string;
  };
}

export interface Device {
  _id?: string;
  user_id: string;
  device_token: string;
  platform: DevicePlatform;
  app_version: string;
  device_model: string;
  os_version: string;
  language: string;
  timezone: string;
  notification_preferences: NotificationPreferences;
  created_at?: Date;
  updated_at?: Date;
  last_seen?: Date;
} 