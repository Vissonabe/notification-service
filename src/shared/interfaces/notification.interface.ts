export enum NotificationPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum NotificationStatus {
  PENDING = 'pending',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

export interface NotificationContent {
  title: string;
  body: string;
  image_url?: string;
  deep_link?: string;
  data?: Record<string, any>;
}

export interface NotificationRecipient {
  user_id: string;
  device_ids?: string[]; // Optional - if not provided, send to all user's devices
}

export interface Notification {
  _id?: string;
  external_id?: string; // For client reference
  recipient: NotificationRecipient;
  priority: NotificationPriority;
  notification: NotificationContent;
  data?: Record<string, any>; // Additional payload data
  source: string; // Service identifier
  idempotency_key: string; // For deduplication
  ttl?: number; // Time-to-live in seconds
  scheduled_at?: Date; // ISO datetime for scheduled notifications
  expires_at?: Date;
  created_at?: Date;
}

export interface DeliveryAttempt {
  _id?: string;
  notification_id: string;
  device_id: string;
  attempt_number: number;
  status: NotificationStatus;
  platform_response?: any;
  error_code?: string;
  error_message?: string;
  attempted_at: Date;
} 