# Notification Creation and Delivery Flow

This document describes the flow for creating and delivering a notification in the Notification Service.

## Flow Diagram

```mermaid
flowchart TD
    Start([Client Creates Notification]) --> A[Client sends notification data to API Gateway]
    A --> B{Validate Request}
    B -->|Invalid| C[Return Validation Errors]
    C --> End1([End with Error])
    
    B -->|Valid| D[API Gateway routes to Notification Service]
    D --> E[Authenticate request via Auth Service]
    
    E -->|Auth Failure| F[Return Auth Error]
    F --> End2([End with Auth Error])
    
    E -->|Auth Success| G[Check idempotency key]
    G -->|Duplicate| H[Return existing notification ID]
    H --> End3([End with Success - Duplicate])
    
    G -->|New Notification| I[Create notification record]
    I --> J[Determine notification priority]
    
    J -->|Critical/High| K[Queue in Redis for immediate processing]
    J -->|Medium/Low| L[Queue in Kafka for batch processing]
    
    K --> M[Notification Processor picks up from queue]
    L --> M
    
    M --> N[Get target devices from Device Service]
    N -->|No devices| O[Log no devices found]
    O --> End4([End with No Devices])
    
    N -->|Devices found| P{For each device}
    P --> Q[Check notification preferences]
    Q -->|Notifications disabled| R[Skip device]
    R --> P
    
    Q -->|Notifications enabled| S[Check quiet hours]
    S -->|In quiet hours| T[Skip device or queue for later]
    T --> P
    
    S -->|Not in quiet hours| U[Format notification for device platform]
    U --> V[Send to appropriate service (FCM/APNS)]
    
    V -->|Success| W[Record successful delivery]
    V -->|Failure| X[Record failed delivery]
    X --> Y{Retry eligible?}
    Y -->|Yes| Z[Queue for retry with backoff]
    Z --> P
    Y -->|No| AA[Mark as permanently failed]
    AA --> P
    
    W --> P
    
    P -->|All devices processed| AB[Update notification status]
    AB --> AC[Send delivery metrics to Analytics]
    AC --> AD[Return notification status]
    AD --> End5([End with Success])
```

## Sequence Diagram

```mermaid
sequenceDiagram
    participant Client
    participant Gateway as API Gateway
    participant Auth as Auth Service
    participant NotifSvc as Notification Service
    participant Queue as Queue System (Redis/Kafka)
    participant Processor as Notification Processor
    participant DeviceSvc as Device Service
    participant PushSvc as Push Services (FCM/APNS)
    participant MongoDB
    participant Analytics
    
    Client->>Gateway: POST /api/v1/notifications
    Gateway->>Gateway: Validate request
    Gateway->>Auth: Authenticate request
    Auth-->>Gateway: Authentication result
    
    alt Authentication Failed
        Gateway-->>Client: 401 Unauthorized
    else Authentication Successful
        Gateway->>NotifSvc: Forward request
        
        NotifSvc->>MongoDB: Check idempotency key
        alt Duplicate Request
            MongoDB-->>NotifSvc: Return existing notification
            NotifSvc-->>Gateway: Return existing notification ID
            Gateway-->>Client: 200 OK with notification ID
        else New Request
            NotifSvc->>MongoDB: Create notification
            MongoDB-->>NotifSvc: Notification created
            
            NotifSvc->>Queue: Queue notification for processing
            Queue-->>NotifSvc: Queuing confirmed
            NotifSvc-->>Gateway: Return notification ID
            Gateway-->>Client: 202 Accepted with notification ID
            
            Queue->>Processor: Deliver notification
            Processor->>DeviceSvc: Get target devices
            DeviceSvc->>MongoDB: Fetch devices for user
            MongoDB-->>DeviceSvc: Return devices
            DeviceSvc-->>Processor: Return devices
            
            loop For each device
                Processor->>Processor: Check device preferences
                Processor->>Processor: Check quiet hours
                alt Send notification
                    Processor->>PushSvc: Send notification
                    
                    alt Delivery Success
                        PushSvc-->>Processor: Delivery confirmation
                        Processor->>MongoDB: Record successful delivery
                    else Delivery Failure
                        PushSvc-->>Processor: Delivery failure
                        Processor->>MongoDB: Record failed delivery
                        
                        alt Retry eligible
                            Processor->>Queue: Queue for retry
                        end
                    end
                end
            end
            
            Processor->>Analytics: Send delivery metrics
            Processor->>MongoDB: Update notification status
        end
    end
```

## State Diagram

```mermaid
stateDiagram-v2
    [*] --> Created: Client submits notification
    Created --> Queued: Notification stored in database
    Queued --> Processing: Notification processor picks up
    
    Processing --> InProgress: Processing started
    
    InProgress --> Delivered: All devices received notification
    InProgress --> PartiallyDelivered: Some devices received notification
    InProgress --> Failed: No devices received notification
    InProgress --> Retrying: Failed deliveries being retried
    
    Retrying --> InProgress: Retry attempt started
    Retrying --> MaxRetriesReached: Maximum retry attempts reached
    
    PartiallyDelivered --> [*]
    Delivered --> [*]
    Failed --> [*]
    MaxRetriesReached --> [*]
```

## Data Model

```mermaid
classDiagram
    class Notification {
        +String _id
        +String external_id
        +Recipient recipient
        +NotificationPriority priority
        +NotificationContent notification
        +Object data
        +String source
        +String idempotency_key
        +Number ttl
        +Date scheduled_at
        +Date expires_at
        +Date created_at
        +NotificationStatus status
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
    
    class NotificationPriority {
        <<enumeration>>
        CRITICAL
        HIGH
        MEDIUM
        LOW
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
    
    Notification "1" *-- "1" Recipient
    Notification "1" *-- "1" NotificationContent
    Notification "1" -- "1" NotificationStatus
    Notification "1" -- "1" NotificationPriority
    Notification "1" o-- "many" DeliveryAttempt
    DeliveryAttempt "1" -- "1" DeliveryStatus
```

## API Contract

### Request

```
POST /api/v1/notifications
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "recipient": {
    "user_id": "user123",
    "device_ids": ["device-456"] // Optional
  },
  "priority": "high",
  "notification": {
    "title": "Your order has shipped",
    "body": "Your order #12345 has been shipped and will arrive tomorrow.",
    "image_url": "https://example.com/shipped.png",
    "deep_link": "app://orders/12345"
  },
  "data": {
    "order_id": "12345"
  },
  "source": "orders-service",
  "idempotency_key": "order-12345-shipped-20230615",
  "ttl": 3600, // Optional, time-to-live in seconds
  "scheduled_at": "2023-07-22T15:00:00Z" // Optional
}
```

### Response

```
HTTP/1.1 202 Accepted
Content-Type: application/json

{
  "notification_id": "notif-123",
  "status": "accepted"
}
```

### Check Status Request

```
GET /api/v1/notifications/notif-123/status
Authorization: Bearer {jwt_token}
```

### Check Status Response

```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "notification_id": "notif-123",
  "status": "delivered",
  "created_at": "2023-07-21T12:34:56Z",
  "processed_at": "2023-07-21T12:35:01Z",
  "delivery_attempts": [
    {
      "device_id": "device-456",
      "attempt_number": 1,
      "status": "delivered",
      "attempted_at": "2023-07-21T12:35:01Z"
    }
  ]
}
``` 