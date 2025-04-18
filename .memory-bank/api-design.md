# Notification Service API Design

## Base URL
`/api/v1`

## Authentication
All endpoints require JWT authentication via Bearer token in the Authorization header.

## API Endpoints

### Device Management

#### Register a Device
- **Endpoint**: `POST /devices`
- **Description**: Register a new device or update an existing one
- **Request Body**:
  ```json
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
- **Response**:
  ```json
  {
    "device_id": "device-456",
    "status": "registered"
  }
  ```

#### Get Devices for User
- **Endpoint**: `GET /devices/user/:userId`
- **Description**: Get all devices for a specific user
- **Response**: Array of Device objects

#### Get Device by ID
- **Endpoint**: `GET /devices/:id`
- **Description**: Get a specific device
- **Response**: Device object

#### Update Device Preferences
- **Endpoint**: `PUT /devices/:id/preferences`
- **Description**: Update notification preferences for a device
- **Request Body**:
  ```json
  {
    "enabled": true,
    "categories": {
      "marketing": false,
      "transactional": true
    },
    "quiet_hours": {
      "enabled": true,
      "start": "23:00",
      "end": "07:00"
    }
  }
  ```
- **Response**: Updated Device object

#### Delete Device
- **Endpoint**: `DELETE /devices/:id`
- **Description**: Remove a device
- **Response**: 204 No Content

### Notification Management

#### Create Notification
- **Endpoint**: `POST /notifications`
- **Description**: Create and send a new notification
- **Request Body**:
  ```json
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
- **Response**:
  ```json
  {
    "notification_id": "notif-123",
    "status": "accepted"
  }
  ```

#### Get Notification by ID
- **Endpoint**: `GET /notifications/:id`
- **Description**: Get a specific notification
- **Response**: Notification object

#### Get Notifications for User
- **Endpoint**: `GET /notifications/user/:userId`
- **Description**: Get all notifications for a specific user
- **Response**: Array of Notification objects

#### Get Notification Status
- **Endpoint**: `GET /notifications/:id/status`
- **Description**: Get the delivery status of a notification
- **Response**:
  ```json
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

## Error Responses

All error responses follow this format:
```json
{
  "status": 400,
  "code": "INVALID_REQUEST",
  "message": "The request payload is invalid",
  "details": [
    {
      "field": "notification.title",
      "message": "Title is required"
    }
  ],
  "request_id": "req-123-abc"
}
```

## Common Status Codes

- **200 OK**: Request succeeded
- **201 Created**: Resource created
- **204 No Content**: Request succeeded with no response body
- **400 Bad Request**: Invalid request parameters
- **401 Unauthorized**: Authentication failed
- **403 Forbidden**: Permission denied
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource already exists
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error 