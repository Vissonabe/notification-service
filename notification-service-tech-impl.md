# Notification Service Technical Implementation Document

## Overview

This document provides a comprehensive technical specification for implementing a high-performance, scalable notification service using Node.js. The service will handle push notifications for both Android and iOS platforms and will be consumed by various internal systems such as tracking, order, and payment services.

## System Goals

- Deliver notifications reliably to mobile apps across platforms
- Support multiple priority levels for different notification types
- Provide a retry mechanism for handling offline devices
- Maintain high observability for monitoring and troubleshooting
- Ensure critical notifications (like payment updates) are delivered immediately
- Achieve high availability and data consistency

## Architecture

### High-Level Component Diagram

```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────────┐     ┌──────────────────┐
│  Internal       │     │                  │     │                   │     │                  │
│  Services       │────▶│  API Gateway     │────▶│  Authentication   │────▶│  Notification    │
│  (Order/Payment)│     │  (Express.js)    │     │  Service          │     │  Orchestrator    │
└─────────────────┘     └──────────────────┘     └───────────────────┘     └────────┬─────────┘
                                                                                    │
                                                                                    ▼
┌─────────────────┐     ┌──────────────────┐     ┌───────────────────┐     ┌──────────────────┐
│  Monitoring &   │◀───▶│  Delivery Status │◀───▶│  Push Notification│◀────│  Queue Manager   │
│  Observability  │     │  Tracker         │     │  Service          │     │  (Kafka/Redis)   │
└─────────────────┘     └──────────────────┘     └───────────────────┘     └────────┬─────────┘
                                                          │                         │
                                                          ▼                         ▼
                                                 ┌───────────────────┐     ┌──────────────────┐
                                                 │  Device Registry  │     │  Retry Manager   │
                                                 │  Service          │     │                  │
                                                 └───────────────────┘     └──────────────────┘
```

## Technical Stack

### Core Technologies

| Component | Technology | Justification |
|-----------|------------|---------------|
| Backend Runtime | Node.js v18+ | Event-driven architecture perfect for high-throughput I/O operations |
| API Framework | NestJS | Type-safe, modular architecture with dependency injection |
| Database | MongoDB | Document-oriented storage for flexible notification schemas |
| Caching | Redis | In-memory data structure store for caching and rate limiting |
| Message Queue | Kafka | Distributed streaming platform for high-throughput message processing with topic partitioning |
| Push Notification | Firebase Admin SDK | For Android FCM integration |
| Push Notification | node-apn | For iOS APNS integration |
| Service Discovery | Consul | Service mesh for microservice coordination |
| Container Runtime | Docker | Standardized packaging and deployment |
| Orchestration | Kubernetes | Container orchestration for scaling and resiliency |
| CI/CD | GitHub Actions | Automated testing and deployment |

### Supporting Libraries

| Purpose | Library | Version |
|---------|---------|---------|
| API Documentation | Swagger/OpenAPI | ^3.0.0 |
| Validation | class-validator | ^0.14.0 |
| Schema Mapping | class-transformer | ^0.5.1 |
| HTTP Client | Axios | ^1.6.0 |
| Testing | Jest | ^29.5.0 |
| Logging | Winston | ^3.10.0 |
| Metrics | Prometheus | ^0.15.0 |
| Tracing | OpenTelemetry | ^1.15.0 |
| Queue Processing | Bullmq | ^4.10.0 |
| Authentication | Passport | ^0.6.0 |
| JWT Handling | jsonwebtoken | ^9.0.0 |

## Detailed Component Design

### 1. API Gateway

**Implementation**: NestJS application with Express adapter

**Key Features**:
- RESTful API endpoints for notification submission
- API versioning for backward compatibility
- Request validation and sanitization
- Rate limiting per client
- Authentication and authorization

**API Endpoints**:

```
POST /api/v1/notifications
GET /api/v1/notifications/:id
GET /api/v1/notifications/:id/status
POST /api/v1/devices
PUT /api/v1/devices/:id
GET /api/v1/health
```

**Sample Request Schema**:

```typescript
interface NotificationRequest {
  recipient: {
    user_id: string;
    device_ids?: string[]; // Optional - if not provided, send to all user's devices
  };
  priority: 'critical' | 'high' | 'medium' | 'low';
  notification: {
    title: string;
    body: string;
    image_url?: string;
    deep_link?: string;
  };
  data?: Record<string, any>; // Additional payload data
  source: string; // Service identifier
  idempotency_key: string; // For deduplication
  ttl?: number; // Time-to-live in seconds
  scheduled_at?: string; // ISO datetime for scheduled notifications
}
```

### 2. Authentication Service

**Implementation**: NestJS module with JWT-based authentication

**Key Features**:
- Service-to-service authentication using JWT
- API key validation for internal services
- Role-based authorization 
- Rate limiting per authenticated client

**Authentication Flow**:
1. Internal services authenticate using pre-shared API keys or JWT
2. Each request includes authentication in the header
3. Gateway validates authentication before processing requests

### 3. Notification Orchestrator

**Implementation**: NestJS service with strategy pattern

**Key Features**:
- Notification classification and routing
- Priority determination
- Client-specific transformations
- Message enrichment
- Batch processing for efficiency

**Processing Logic**:
1. Determine notification priority
2. Validate notification content
3. Enrich with additional context if needed
4. Route to appropriate queue based on priority
5. Track notification in the database

### 4. Queue Management System

**Implementation**: Kafka for main message bus, Redis for critical messages

**Key Features**:
- Topic-based priority queues
- Message persistence
- Guaranteed delivery
- Consumption tracking

**Queue Structure**:
- `notifications.critical` - Highest priority (Redis + Kafka)
- `notifications.high` - High priority (Kafka)
- `notifications.medium` - Medium priority (Kafka)
- `notifications.low` - Low priority (Kafka)
- `notifications.retry` - For retries (Kafka)
- `notifications.dead-letter` - Failed notifications (Kafka)

### 5. Push Notification Service

**Implementation**: NestJS service with platform-specific adapters

**Key Features**:
- Platform detection and routing
- Batch processing where applicable
- Token validation and refresh
- Rate limiting per platform guidelines
- Error handling and categorization

**Platforms**:
- Android via Firebase Cloud Messaging
- iOS via Apple Push Notification Service

**Adapter Interface**:

```typescript
interface PushAdapter {
  initialize(): Promise<void>;
  sendNotification(token: string, notification: NotificationPayload): Promise<DeliveryResult>;
  sendBatchNotifications(tokens: string[], notification: NotificationPayload): Promise<DeliveryResult[]>;
  validateToken(token: string): Promise<boolean>;
}
```

### 6. Device Registry Service

**Implementation**: NestJS service with MongoDB repository

**Key Features**:
- Device registration and update
- Token storage and validation
- User-device association
- Platform-specific metadata
- Last seen timestamp tracking

**Database Schema**:

```typescript
interface Device {
  _id: ObjectId;
  user_id: string;
  device_token: string;
  platform: 'android' | 'ios';
  app_version: string;
  device_model: string;
  os_version: string;
  language: string;
  timezone: string;
  notification_preferences: {
    enabled: boolean;
    categories: {
      [category: string]: boolean;
    };
    quiet_hours: {
      enabled: boolean;
      start: string; // HH:MM format
      end: string; // HH:MM format
      timezone: string;
    };
  };
  created_at: Date;
  updated_at: Date;
  last_seen: Date;
}
```

### 7. Delivery Status Tracker

**Implementation**: NestJS service with MongoDB repository

**Key Features**:
- Record all delivery attempts
- Track success/failure rates
- Provide status lookup API
- Generate delivery analytics
- Support idempotent processing

**Database Schema**:

```typescript
interface Notification {
  _id: ObjectId;
  external_id: string; // For client reference
  user_id: string;
  source: string;
  priority: string;
  content: {
    title: string;
    body: string;
    image_url?: string;
    deep_link?: string;
    data?: any;
  };
  created_at: Date;
  scheduled_at?: Date;
  expires_at: Date;
  idempotency_key: string;
}

interface DeliveryAttempt {
  _id: ObjectId;
  notification_id: ObjectId;
  device_id: ObjectId;
  attempt_number: number;
  status: 'pending' | 'delivered' | 'failed' | 'expired';
  platform_response?: any;
  error_code?: string;
  error_message?: string;
  attempted_at: Date;
}
```

### 8. Retry Management System

**Implementation**: NestJS service with BullMQ delayed jobs

**Key Features**:
- Exponential backoff strategy
- Platform-specific retry policies
- Error categorization (retryable vs. non-retryable)
- Maximum retry attempts by priority
- Dead-letter queue for forensics

**Retry Strategy**:

| Priority | Max Attempts | Initial Delay | Max Delay | Strategy |
|----------|--------------|--------------|-----------|----------|
| Critical | 10 | 10s | 5m | Exponential |
| High | 8 | 30s | 15m | Exponential |
| Medium | 5 | 2m | 30m | Exponential |
| Low | 3 | 5m | 2h | Exponential |

### 9. Monitoring & Observability Stack

**Implementation**: NestJS interceptors and middleware with Prometheus, OpenTelemetry

**Key Features**:
- Request/response logging
- Distributed tracing
- Metrics collection
- Alerting integration
- Health check endpoints
- Performance monitoring

**Key Metrics**:

| Metric | Type | Description |
|--------|------|-------------|
| `notification_requests_total` | Counter | Total notification requests received |
| `notification_delivery_success_rate` | Gauge | Success rate by priority and source |
| `notification_delivery_time_seconds` | Histogram | Time to deliver by priority |
| `notification_retry_count` | Histogram | Number of retries by notification |
| `queue_depth` | Gauge | Number of messages in each queue |
| `queue_processing_time` | Histogram | Time taken to process from queue |

### 10. Admin Dashboard

**Implementation**: Separate React application with REST API

**Key Features**:
- Real-time monitoring
- Configuration management
- Manual notification triggering
- Delivery status inspection
- System health overview

## Database Models

### MongoDB Collections

#### devices
```javascript
{
  _id: ObjectId,
  user_id: String,
  device_token: String,
  platform: String,
  app_version: String,
  device_model: String,
  os_version: String,
  language: String,
  timezone: String,
  notification_preferences: {
    enabled: Boolean,
    categories: Object,
    quiet_hours: {
      enabled: Boolean,
      start: String,
      end: String,
      timezone: String
    }
  },
  created_at: Date,
  updated_at: Date,
  last_seen: Date
}
```

#### notifications
```javascript
{
  _id: ObjectId,
  external_id: String,
  user_id: String,
  source: String,
  priority: String,
  content: {
    title: String,
    body: String,
    image_url: String,
    deep_link: String,
    data: Object
  },
  created_at: Date,
  scheduled_at: Date,
  expires_at: Date,
  idempotency_key: String
}
```

#### delivery_attempts
```javascript
{
  _id: ObjectId,
  notification_id: ObjectId,
  device_id: ObjectId,
  attempt_number: Number,
  status: String,
  platform_response: Object,
  error_code: String,
  error_message: String,
  attempted_at: Date
}
```

## Non-Functional Requirements

### 1. Performance

| Requirement | Target | Implementation Strategy |
|-------------|--------|-------------------------|
| Maximum latency for critical notifications | <500ms | Dedicated Redis queue for critical notifications |
| Throughput | 1000 notifications/second | Horizontal scaling, batch processing |
| Database response time | <50ms for 99% of queries | Indexing, query optimization, caching |
| API response time | <200ms for 95% of requests | Connection pooling, response caching |

**Implementation Details**:
- Use Redis for critical notification queuing with minimal processing overhead
- Implement database read replicas for scaling read operations
- Use connection pooling for database and external services
- Implement batching for platform notification services where supported
- Use indexing strategies for common query patterns

### 2. Scalability

| Requirement | Target | Implementation Strategy |
|-------------|--------|-------------------------|
| Linear scaling with load | Up to 10x baseline | Stateless services, distributed queuing |
| Peak load handling | 5x average load | Auto-scaling, load shedding |
| Database scaling | Horizontal read scaling | MongoDB replicas |

**Implementation Details**:
- Deploy stateless services for horizontal scaling
- Use Kubernetes HPA (Horizontal Pod Autoscaler) based on CPU/memory metrics
- Implement database sharding strategy based on user_id
- Use Kafka partitioning for parallel processing
- Implement circuit breakers and bulkheads for service isolation

### 3. Availability

| Requirement | Target | Implementation Strategy |
|-------------|--------|-------------------------|
| Service uptime | 99.95% | Multi-AZ deployment, redundancy |
| Scheduled maintenance | Zero downtime | Rolling updates, blue/green deployment |
| Recovery time objective (RTO) | <5 minutes | Automated failover |
| Recovery point objective (RPO) | <30 seconds | Continuous replication |

**Implementation Details**:
- Deploy across multiple availability zones
- Implement health checks and automated instance recovery
- Use Kubernetes readiness/liveness probes
- Configure database replication with automated failover
- Implement graceful degradation strategies

### 4. Reliability

| Requirement | Target | Implementation Strategy |
|-------------|--------|-------------------------|
| Message delivery guarantee | At-least-once | Persistent queues, idempotent processing |
| Failed notification retry | Configurable policy | Exponential backoff with jitter |
| Error rate | <0.1% system errors | Comprehensive error handling |
| Duplicate detection | 100% | Idempotency keys |

**Implementation Details**:
- Use Kafka's persistence for guaranteed message delivery
- Implement idempotency through unique keys
- Store all notification requests before processing
- Implement comprehensive error handling and categorization
- Use the outbox pattern for reliable event publishing

### 5. Security

| Requirement | Target | Implementation Strategy |
|-------------|--------|-------------------------|
| Authentication | All requests | JWT with short expiry |
| Authorization | Role-based access | RBAC with least privilege |
| Data encryption | In-transit and at-rest | TLS 1.3, field-level encryption |
| Rate limiting | Per client/IP | Redis-based token bucket algorithm |
| Vulnerability scanning | Weekly | Automated scanning in CI/CD |

**Implementation Details**:
- Use TLS 1.3 for all communications
- Implement JWT-based authentication with regular key rotation
- Use MongoDB field-level encryption for sensitive data
- Deploy an API gateway with rate limiting capabilities
- Implement security headers (HSTS, CSP, etc.)
- Regular dependency vulnerability scanning

### 6. Maintainability

| Requirement | Target | Implementation Strategy |
|-------------|--------|-------------------------|
| Code coverage | >90% | Unit and integration tests |
| Documentation | OpenAPI + Wiki | Auto-generated API docs |
| Change management | Versioned APIs | Semantic versioning |
| Feature toggles | For all new features | Configuration-based feature flags |

**Implementation Details**:
- Implement comprehensive unit and integration testing
- Use NestJS swagger module for API documentation
- Follow semantic versioning for API changes
- Structure codebase with a modular, domain-driven design
- Use dependency injection for loose coupling
- Implement feature flags for controlled rollouts

### 7. Observability

| Requirement | Target | Implementation Strategy |
|-------------|--------|-------------------------|
| Logging | Structured JSON | Winston + ELK stack |
| Metrics | Service-level metrics | Prometheus + Grafana |
| Tracing | Distributed tracing | OpenTelemetry + Jaeger |
| Alerting | Automated alerts | PagerDuty integration |

**Implementation Details**:
- Use structured logging with correlation IDs
- Implement request/response logging with PII redaction
- Define and collect SLIs (Service Level Indicators)
- Create comprehensive dashboards for system monitoring
- Implement distributed tracing across all services
- Configure alerts for SLO violations

### 8. Compliance

| Requirement | Target | Implementation Strategy |
|-------------|--------|-------------------------|
| GDPR compliance | Full compliance | Data minimization, consent tracking |
| Data retention | Configurable policies | Automated data pruning |
| Audit logging | All sensitive operations | Immutable audit logs |
| Privacy by design | Built-in | Data classification |

**Implementation Details**:
- Implement user consent tracking for notifications
- Create data retention policies with automated enforcement
- Store audit logs in append-only storage
- Implement PII identification and protection
- Design for regional compliance requirements

## Deployment Architecture

### Infrastructure Requirements

| Component | Sizing | Redundancy |
|-----------|--------|------------|
| API Servers | t3.medium (2 vCPU, 4GB) | min 3, auto-scaling |
| Worker Nodes | t3.large (2 vCPU, 8GB) | min 5, auto-scaling |
| MongoDB | m5.large (2 vCPU, 8GB) | 3-node replica set |
| Redis | cache.m5.large | 2-node cluster |
| Kafka | kafka.m5.large | 3-broker cluster |

### Kubernetes Resources

```yaml
# API Gateway
apiVersion: apps/v1
kind: Deployment
metadata:
  name: notification-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: notification-api
  template:
    metadata:
      labels:
        app: notification-api
    spec:
      containers:
      - name: notification-api
        image: notification-service/api:latest
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 1000m
            memory: 1Gi
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
```

## Development Guidelines

### Coding Standards

- Follow Airbnb JavaScript Style Guide
- Use ESLint with TypeScript support
- Implement strict TypeScript checking
- Document all public methods and interfaces
- Use meaningful variable and function names
- Maximum cyclomatic complexity of 10
- Maximum file length of 300 lines

### Testing Strategy

| Test Type | Coverage | Tools |
|-----------|----------|-------|
| Unit Tests | >90% code coverage | Jest |
| Integration Tests | All service boundaries | Supertest, Jest |
| E2E Tests | Critical flows | Cypress |
| Load Tests | Performance requirements | Artillery |

### Error Handling

- Use custom error classes for different error types
- Include error codes for categorization
- Always log errors with context
- Return standardized error responses
- Never expose internal errors to clients

**Error Response Format**:

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

### Logging Standards

- Use structured JSON logging
- Include request_id in all logs
- Log all incoming requests and outgoing responses
- Redact sensitive information (tokens, PII)
- Use appropriate log levels (debug, info, warn, error)

**Log Format**:

```json
{
  "timestamp": "2023-07-21T12:34:56.789Z",
  "level": "info",
  "message": "Notification request received",
  "request_id": "req-123-abc",
  "service": "notification-api",
  "user_id": "user-456",
  "priority": "high",
  "source": "payment-service"
}
```

## Implementation Phases

### Phase 1: Core Infrastructure (4 weeks)

1. Set up project structure and CI/CD pipeline
2. Implement API Gateway with basic authentication
3. Create Device Registry service with CRUD operations
4. Implement basic Notification service with direct FCM/APNS integration
5. Set up basic monitoring and logging

### Phase 2: Advanced Features (6 weeks)

1. Implement Queue Management System with Kafka
2. Add priority-based routing
3. Create Retry Management system
4. Implement Delivery Status tracking
5. Enhance observability with distributed tracing
6. Add comprehensive metrics

### Phase 3: Optimization and Scaling (4 weeks)

1. Implement performance optimizations
2. Add advanced security features
3. Set up auto-scaling
4. Implement advanced delivery analytics
5. Create Admin Dashboard
6. Comprehensive testing and hardening

## API Documentation

### POST /api/v1/notifications

Create a new notification request.

**Request:**

```json
{
  "recipient": {
    "user_id": "user-123",
    "device_ids": ["device-456"] // Optional
  },
  "priority": "high",
  "notification": {
    "title": "Payment Confirmation",
    "body": "Your payment of $50 has been processed successfully",
    "image_url": "https://example.com/payment.png",
    "deep_link": "myapp://payments/123"
  },
  "data": {
    "payment_id": "pay-789",
    "amount": 50.00
  },
  "source": "payment-service",
  "idempotency_key": "pay-789-notification-1",
  "ttl": 3600
}
```

**Response (Success):**

```json
{
  "notification_id": "notif-123",
  "status": "accepted",
  "expected_delivery": "2023-07-21T12:35:00Z"
}
```

### GET /api/v1/notifications/:id/status

Get the status of a notification.

**Response:**

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

### POST /api/v1/devices

Register a new device.

**Request:**

```json
{
  "user_id": "user-123",
  "device_token": "fcm-token-xyz",
  "platform": "android",
  "app_version": "1.2.3",
  "device_model": "Pixel 6",
  "os_version": "Android 13",
  "language": "en-US",
  "timezone": "America/New_York"
}
```

**Response:**

```json
{
  "device_id": "device-456",
  "status": "registered"
}
```

## Conclusion

This technical implementation document provides a comprehensive blueprint for building a scalable, reliable notification service using Node.js. By following this architecture and implementation guidelines, the system will meet all the specified functional and non-functional requirements while providing a robust platform for future expansion.

The recommended approach focuses on modularity, scalability, and observability to ensure the system can handle high volumes of notifications with varying priority levels while maintaining reliability and performance.