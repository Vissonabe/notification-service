# Notification Service - Internal Services

## Core Services Overview

| Service | Purpose | Key Responsibilities |
|---------|---------|---------------------|
| **Device Service** | Manage device registration and state | Register, update, and remove devices; Store device tokens and preferences |
| **Notification Service** | Orchestrate notification sending | Create, queue, and track notification delivery; Handle idempotency |
| **Retry Service** | Handle retries for failed notifications | Implement backoff strategies; Determine when to stop retrying |
| **Queue Service** | Manage message queues | Kafka and Redis queue integration; Priority-based routing |
| **Auth Service** | Handle authentication and authorization | Validate JWT tokens; Service-to-service auth |
| **Monitoring Service** | System observability | Metrics collection; Logging; Performance tracking |

## Service Details

### Device Service

**Key Files**:
- `src/modules/device/device.service.ts`
- `src/modules/device/device.controller.ts`
- `src/modules/device/schemas/device.schema.ts`

**Responsibilities**:
- Register new devices and update existing ones
- Store device tokens for FCM/APNS
- Track user-device associations
- Manage device notification preferences
- Track device activity with "last seen" timestamps
- Handle device platform specifics (Android vs iOS)

**Public Methods**:
- `registerDevice(registerDeviceDto)`: Register a new device or update existing
- `findByUserId(userId)`: Get all devices for a user
- `findById(deviceId)`: Get a specific device
- `updateLastSeen(deviceId)`: Update a device's last activity timestamp
- `updateNotificationPreferences(deviceId, preferences)`: Update notification settings
- `findByPlatform(platform)`: Find devices by platform (android/ios)
- `delete(deviceId)`: Remove a device
- `findByIds(deviceIds)`: Find multiple devices by IDs
- `isTokenValid(deviceToken)`: Check if a device token is valid

### Notification Service

**Key Files**:
- `src/modules/notification/notification.service.ts`
- `src/modules/notification/notification.controller.ts`
- `src/modules/notification/notification.processor.ts`
- `src/modules/notification/schemas/notification.schema.ts`
- `src/modules/notification/schemas/delivery-attempt.schema.ts`

**Responsibilities**:
- Create, store and process notifications
- Queue notifications for delivery
- Apply notification priority rules
- Track delivery attempts and status
- Ensure idempotency using idempotency keys
- Handle scheduled notifications
- Process notification expiration

**Public Methods**:
- `create(createNotificationDto)`: Create and queue a new notification
- `findById(id)`: Get a notification by ID
- `findByUserId(userId)`: Get all notifications for a user
- `recordDeliveryAttempt(notificationId, deviceId, status, ...)`: Record a delivery attempt
- `getDeliveryStatus(notificationId)`: Get delivery status for a notification

### Retry Service

**Key Files**:
- `src/modules/retry/retry.service.ts`
- `src/modules/retry/retry.module.ts`

**Responsibilities**:
- Implement retry strategies for failed notifications
- Calculate backoff delays based on priority
- Schedule notification retries with appropriate delays
- Apply exponential backoff with jitter
- Determine when to stop retrying
- Handle dead-letter scenarios

**Public Methods**:
- `scheduleRetry(notificationId, priority, attemptNumber)`: Schedule a retry
- `shouldRetry(priority, attemptNumber)`: Check if should retry based on attempt count

### Queue Service

**Key Files**:
- `src/modules/queue/queue.module.ts`
- `src/modules/queue/kafka.service.ts`
- `src/modules/queue/redis.service.ts`

**Responsibilities**:
- Integrate with Kafka for main queuing
- Integrate with Redis for critical messages
- Implement topic-based routing
- Handle priority queuing
- Ensure message persistence
- Provide producer and consumer abstractions

**Public Methods (Kafka)**:
- `produce(topic, message)`: Send message to Kafka topic
- `subscribe(topic, groupId, callback)`: Subscribe to Kafka topic

**Public Methods (Redis)**:
- `set(key, value, expirySeconds)`: Set key-value in Redis
- `get(key)`: Get value from Redis
- `delete(key)`: Delete key from Redis
- `isRateLimited(key, maxRequests, windowSeconds)`: Check rate limits
- `setDeviceState(deviceId, state, expirySeconds)`: Cache device state
- `getDeviceState(deviceId)`: Get cached device state

### Auth Service

**Key Files**:
- `src/modules/auth/auth.service.ts`
- `src/modules/auth/auth.middleware.ts`
- `src/modules/auth/auth.module.ts`

**Responsibilities**:
- JWT token validation
- Service-to-service authentication
- Role-based access control
- API key validation
- Authentication middleware

**Public Methods**:
- `validateToken(token)`: Validate JWT token
- `generateToken(userId, role)`: Generate JWT token (for testing)

### Monitoring Service

**Key Files**:
- `src/modules/monitoring/metrics.service.ts`
- `src/modules/monitoring/logs.service.ts`
- `src/modules/monitoring/monitoring.module.ts`

**Responsibilities**:
- Metrics collection (counters, gauges, histograms)
- Structured logging
- Performance monitoring
- Execution time measurement
- Event logging for notifications and devices

**Public Methods (Metrics)**:
- `incrementCounter(name, value, tags)`: Increment a counter metric
- `recordHistogram(name, value, tags)`: Record value in a histogram
- `measureExecutionTime(metricName, fn, tags)`: Measure execution time
- `getAllMetrics()`: Get all current metrics

**Public Methods (Logs)**:
- `log/error/warn/debug/verbose(message, context)`: Log at different levels
- `logRequest(req, res, duration)`: Log API request details
- `logNotificationEvent(eventType, notificationId, data)`: Log notification events
- `logDeviceEvent(eventType, deviceId, userId, data)`: Log device events

## Service Communication Flow

1. **API Gateway** receives external requests and authenticates them via **Auth Service**
2. Authenticated requests are routed to the appropriate controller (**Device** or **Notification**)
3. For new notifications:
   - **Notification Service** creates notification record
   - Notification is queued via **Queue Service** based on priority
   - **Notification Processor** picks up the notification from the queue
   - Processor uses **Device Service** to find target devices
   - Delivery attempts are recorded back in **Notification Service**
   - Failed deliveries are scheduled for retry via **Retry Service**
4. All operations are monitored by **Monitoring Service** 