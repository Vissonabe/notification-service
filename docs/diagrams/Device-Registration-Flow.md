# Device Registration Flow

This document describes the flow for device registration in the Notification Service.

## Flow Diagram

```mermaid
flowchart TD
    Start([Client Requests Device Registration]) --> A[Client sends device details to API Gateway]
    A --> B{Validate Request}
    B -->|Invalid| C[Return Validation Errors]
    C --> End1([End with Error])
    
    B -->|Valid| D[API Gateway routes to Device Service]
    D --> E[Authenticate request via Auth Service]
    
    E -->|Auth Failure| F[Return Auth Error]
    F --> End2([End with Auth Error])
    
    E -->|Auth Success| G[Device Service checks if device exists]
    
    G -->|Exists| H[Update existing device]
    G -->|New Device| I[Create new device record]
    
    H --> J[Update device token and preferences]
    I --> K[Generate device ID]
    
    J --> L[Save to MongoDB]
    K --> L
    
    L --> M[Cache device info in Redis]
    M --> N[Publish device_registered event to Kafka]
    N --> O[Update user-device association]
    O --> P[Return success response with device ID]
    P --> End3([End with Success])
```

## Sequence Diagram

```mermaid
sequenceDiagram
    participant Client
    participant Gateway as API Gateway
    participant Auth as Auth Service
    participant Device as Device Service
    participant MongoDB
    participant Redis
    participant Kafka

    Client->>Gateway: POST /api/v1/devices (device details)
    Gateway->>Gateway: Validate request
    Gateway->>Auth: Authenticate request
    Auth->>Auth: Validate JWT token
    Auth-->>Gateway: Authentication result
    
    alt Authentication Failed
        Gateway-->>Client: 401 Unauthorized
    else Authentication Successful
        Gateway->>Device: Forward request
        Device->>MongoDB: Check if device exists
        
        alt Device Exists
            MongoDB-->>Device: Return existing device
            Device->>Device: Update properties
        else New Device
            Device->>Device: Create new device
        end
        
        Device->>MongoDB: Save device
        MongoDB-->>Device: Confirm save
        Device->>Redis: Cache device state
        Redis-->>Device: Confirm cache
        Device->>Kafka: Publish device_registered event
        Kafka-->>Device: Confirm publish
        Device-->>Gateway: Return device details
        Gateway-->>Client: 200 OK with device ID
    end
```

## Data Model

The device registration process uses the following data model:

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
    Device "1" -- "1" DevicePlatform
```

## API Contract

### Request

```
POST /api/v1/devices
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "user_id": "user123",
  "device_token": "fcm-token-123",
  "platform": "android",
  "app_version": "1.0.0",
  "device_model": "Pixel 6",
  "os_version": "Android 13",
  "language": "en-US",
  "timezone": "America/New_York",
  "notification_preferences": {
    "enabled": true,
    "categories": {
      "marketing": true,
      "transactional": true
    },
    "quiet_hours": {
      "enabled": true,
      "start": "22:00",
      "end": "08:00",
      "timezone": "America/New_York"
    }
  }
}
```

### Response

```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "device_id": "device-456",
  "status": "registered"
}
``` 