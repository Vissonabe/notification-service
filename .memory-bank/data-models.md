# Notification Service Data Models

## MongoDB Collections

### 1. Device Collection

```typescript
// Device Schema
{
  _id: ObjectId,
  user_id: String,                   // ID of the user who owns this device
  device_token: String,              // FCM or APNS token for push notifications
  platform: String,                  // 'android' or 'ios'
  app_version: String,               // Version of the app installed
  device_model: String,              // Model of the device (e.g., "iPhone 13", "Pixel 6")
  os_version: String,                // OS version (e.g., "iOS 15.4", "Android 13")
  language: String,                  // Preferred language code (e.g., "en-US")
  timezone: String,                  // Device timezone (e.g., "America/New_York")
  notification_preferences: {
    enabled: Boolean,                // Whether notifications are enabled
    categories: Object,              // Category-specific preferences (e.g., {marketing: true})
    quiet_hours: {
      enabled: Boolean,              // Whether quiet hours are enabled
      start: String,                 // Start time (HH:MM)
      end: String,                   // End time (HH:MM)
      timezone: String               // Timezone for quiet hours
    }
  },
  created_at: Date,                  // When the device was first registered
  updated_at: Date,                  // When the device was last updated
  last_seen: Date                    // When the device was last active
}
```

**Indexes:**
- `user_id`: For finding all devices for a user
- `device_token` (unique): For looking up devices by token
- `last_seen`: For finding recently active devices

### 2. Notification Collection

```typescript
// Notification Schema
{
  _id: ObjectId,
  external_id: String,               // Optional external reference ID
  recipient: {
    user_id: String,                 // ID of the user to receive the notification
    device_ids: [String]             // Optional specific device IDs to target
  },
  priority: String,                  // 'critical', 'high', 'medium', or 'low'
  notification: {
    title: String,                   // Notification title
    body: String,                    // Notification body/message
    image_url: String,               // Optional URL for an image
    deep_link: String,               // Optional deep link to open in the app
    data: Object                     // Optional additional data for the notification
  },
  data: Object,                      // Additional payload data
  source: String,                    // Service that created the notification
  idempotency_key: String,           // Unique key to prevent duplicates
  ttl: Number,                       // Time-to-live in seconds
  scheduled_at: Date,                // Optional time to send the notification
  expires_at: Date,                  // When the notification expires
  created_at: Date                   // When the notification was created
}
```

**Indexes:**
- `idempotency_key` (unique): To prevent duplicate notifications
- `recipient.user_id`: For finding notifications for a user
- `created_at`: For sorting and finding recent notifications
- `expires_at`: For cleaning up expired notifications
- `scheduled_at`: For finding scheduled notifications

### 3. Delivery Attempt Collection

```typescript
// Delivery Attempt Schema
{
  _id: ObjectId,
  notification_id: ObjectId,         // Reference to the notification
  device_id: ObjectId,               // Reference to the device
  attempt_number: Number,            // Sequence number of the attempt
  status: String,                    // 'pending', 'delivered', 'failed', or 'expired'
  platform_response: Object,         // Response from FCM/APNS (if any)
  error_code: String,                // Error code (if any)
  error_message: String,             // Error message (if any)
  attempted_at: Date                 // When the attempt was made
}
```

**Indexes:**
- `notification_id`, `device_id`, `attempt_number`: For finding attempts for a notification/device
- `notification_id`, `status`: For finding all attempts with a specific status
- `attempted_at`: For finding recent attempts

## MongoDB Relationships

- **One-to-Many**: User to Devices (one user can have multiple devices)
- **One-to-Many**: User to Notifications (one user can receive multiple notifications)
- **One-to-Many**: Notification to Delivery Attempts (one notification can have multiple delivery attempts)
- **One-to-Many**: Device to Delivery Attempts (one device can have multiple delivery attempts)

## Redis Data Structures

### 1. Rate Limiting

```
KEY: "rate_limit:{source}:{user_id}"
TYPE: Counter with TTL
```

### 2. Device State Caching

```
KEY: "device:{device_id}:state"
TYPE: Hash with TTL
{
  online: Boolean,
  last_active: Timestamp,
  app_foreground: Boolean,
  notifications_enabled: Boolean
}
```

### 3. Critical Notifications Queue

```
KEY: "queue:critical"
TYPE: List
[notification_id1, notification_id2, ...]
```

## Kafka Topics

### 1. Notification Events

```
TOPIC: "notification-events"
Partitioning: By user_id
{
  event_type: String,        // "created", "delivered", "failed", "expired"
  notification_id: String,
  user_id: String,
  timestamp: Number,
  data: Object               // Event-specific data
}
```

### 2. Device Events

```
TOPIC: "device-events"
Partitioning: By user_id
{
  event_type: String,        // "registered", "updated", "deleted", "token_refreshed"
  device_id: String,
  user_id: String,
  timestamp: Number,
  data: Object               // Event-specific data
}
``` 