# Database Schema Design

This document describes the database schema design for the Notification Service.

## MongoDB Collections

```mermaid
erDiagram
    User ||--o{ Device : "owns"
    User ||--o{ Notification : "receives"
    Device ||--o{ DeliveryAttempt : "receives"
    Notification ||--o{ DeliveryAttempt : "has"
    
    User {
        string _id PK
        string email
        string name
        object preferences
        date created_at
        date updated_at
    }
    
    Device {
        string _id PK
        string user_id FK
        string device_token
        string platform
        string app_version
        string device_model
        string os_version
        string language
        string timezone
        object notification_preferences
        date created_at
        date updated_at
        date last_seen
    }
    
    Notification {
        string _id PK
        string external_id
        object recipient
        string priority
        object content
        object data
        string source
        string idempotency_key
        number ttl
        date scheduled_at
        date expires_at
        date created_at
        string status
    }
    
    DeliveryAttempt {
        string _id PK
        string notification_id FK
        string device_id FK
        number attempt_number
        string status
        object platform_response
        string error_code
        string error_message
        date attempted_at
    }
    
    AnalyticsEvent {
        string _id PK
        string event_type
        string entity_id
        string user_id FK
        object data
        date created_at
    }
    
    MetricsAggregate {
        string _id PK
        string metric_name
        string dimension
        object dimensions
        number value
        date timestamp
        string interval
    }
```

## Device Collection Schema

```mermaid
classDiagram
    class Device {
        +String _id
        +String user_id
        +String device_token
        +DevicePlatform platform
        +String app_version
        +String device_model
        +String os_version
        +String language
        +String timezone
        +NotificationPreferences notification_preferences
        +Date created_at
        +Date updated_at
        +Date last_seen
    }
    
    class NotificationPreferences {
        +Boolean enabled
        +Object categories
        +QuietHours quiet_hours
    }
    
    class QuietHours {
        +Boolean enabled
        +String start
        +String end
        +String timezone
    }
    
    class DevicePlatform {
        <<enumeration>>
        ANDROID
        IOS
        WEB
    }
    
    Device "1" *-- "1" NotificationPreferences
    NotificationPreferences "1" *-- "1" QuietHours
```

## Notification Collection Schema

```mermaid
classDiagram
    class Notification {
        +String _id
        +String external_id
        +Recipient recipient
        +NotificationPriority priority
        +NotificationContent content
        +Object data
        +String source
        +String idempotency_key
        +Number ttl
        +Date scheduled_at
        +Date expires_at
        +Date created_at
        +NotificationStatus status
    }
    
    class Recipient {
        +String user_id
        +String[] device_ids
    }
    
    class NotificationContent {
        +String title
        +String body
        +String image_url
        +String deep_link
        +Object data
    }
    
    class NotificationPriority {
        <<enumeration>>
        CRITICAL
        HIGH
        MEDIUM
        LOW
    }
    
    class NotificationStatus {
        <<enumeration>>
        CREATED
        QUEUED
        PROCESSING
        DELIVERED
        PARTIALLY_DELIVERED
        FAILED
        EXPIRED
    }
    
    Notification "1" *-- "1" Recipient
    Notification "1" *-- "1" NotificationContent
    Notification "1" -- "1" NotificationPriority
    Notification "1" -- "1" NotificationStatus
```

## Delivery Attempt Collection Schema

```mermaid
classDiagram
    class DeliveryAttempt {
        +String _id
        +String notification_id
        +String device_id
        +Number attempt_number
        +DeliveryStatus status
        +Object platform_response
        +String error_code
        +String error_message
        +Date attempted_at
    }
    
    class DeliveryStatus {
        <<enumeration>>
        PENDING
        DELIVERED
        FAILED
        EXPIRED
    }
    
    DeliveryAttempt "1" -- "1" DeliveryStatus
```

## Redis Data Structures

### Rate Limiting

```
Key pattern: rate_limit:{scope}:{identifier}:{endpoint}
Type: Counter with TTL
Example: rate_limit:user:123:notifications (value: 5, TTL: 60s)
```

### Device State Caching

```
Key pattern: device:{device_id}:state
Type: Hash
Fields:
  - online: Boolean
  - last_active: Timestamp
  - app_foreground: Boolean
  - notification_enabled: Boolean
TTL: 3600s (1 hour)
```

### Notification Queues

```
Key pattern: queue:{priority}
Type: Sorted Set
Members: notification_ids
Score: scheduled time (epoch milliseconds)
Example: queue:critical → ["notif123": 1623456789000, "notif124": 1623456790000]
```

### Temporary Token Storage

```
Key pattern: token:{token_id}
Type: String
Value: JWT token
TTL: Token expiration time
```

## MongoDB Indexing Strategy

### Device Collection Indexes

```
db.devices.createIndex({ "user_id": 1 })
db.devices.createIndex({ "device_token": 1 }, { unique: true })
db.devices.createIndex({ "platform": 1 })
db.devices.createIndex({ "last_seen": 1 })
```

### Notification Collection Indexes

```
db.notifications.createIndex({ "recipient.user_id": 1 })
db.notifications.createIndex({ "idempotency_key": 1 }, { unique: true })
db.notifications.createIndex({ "status": 1 })
db.notifications.createIndex({ "created_at": 1 })
db.notifications.createIndex({ "expires_at": 1 })
db.notifications.createIndex({ "scheduled_at": 1 })
```

### Delivery Attempt Collection Indexes

```
db.delivery_attempts.createIndex({ "notification_id": 1, "device_id": 1, "attempt_number": 1 })
db.delivery_attempts.createIndex({ "notification_id": 1, "status": 1 })
db.delivery_attempts.createIndex({ "device_id": 1 })
db.delivery_attempts.createIndex({ "attempted_at": 1 })
```

### Analytics Collection Indexes

```
db.analytics_events.createIndex({ "event_type": 1, "created_at": 1 })
db.analytics_events.createIndex({ "user_id": 1, "created_at": 1 })
db.analytics_events.createIndex({ "entity_id": 1, "event_type": 1 })

db.metrics_aggregates.createIndex({ "metric_name": 1, "timestamp": 1 })
db.metrics_aggregates.createIndex({ "metric_name": 1, "dimensions.user_id": 1, "timestamp": 1 })
db.metrics_aggregates.createIndex({ "metric_name": 1, "dimensions.platform": 1, "timestamp": 1 })
```

## Sharding Strategy

For large-scale deployments, the MongoDB collections can be sharded as follows:

### Device Collection

```
sh.shardCollection("notification_db.devices", { "user_id": "hashed" })
```

### Notification Collection

```
sh.shardCollection("notification_db.notifications", { "recipient.user_id": "hashed" })
```

### Delivery Attempt Collection

```
sh.shardCollection("notification_db.delivery_attempts", { "notification_id": "hashed" })
```

### Analytics Collections

```
sh.shardCollection("notification_db.analytics_events", { "created_at": 1, "_id": 1 })
sh.shardCollection("notification_db.metrics_aggregates", { "timestamp": 1, "metric_name": 1 })
``` 