# Notification Analytics Flow

This document describes the analytics and metrics collection flow in the Notification Service.

## Flow Diagram

```mermaid
flowchart TD
    subgraph "Event Sources"
        A1[Notification Creation]
        A2[Notification Delivery]
        A3[Notification Engagement]
        A4[Device Registration]
        A5[System Events]
    end
    
    subgraph "Event Collection"
        B1[Kafka Event Stream]
        B2[Direct Metrics API]
        B3[Log Processing]
    end
    
    subgraph "Processing Pipeline"
        C1[Event Aggregation]
        C2[Time-based Windowing]
        C3[User/Device Grouping]
        C4[Statistical Analysis]
    end
    
    subgraph "Storage and Indexing"
        D1[MongoDB Analytics Collection]
        D2[Redis Cache for Real-time]
        D3[Time-series Database]
    end
    
    subgraph "Analysis and Visualization"
        E1[Real-time Dashboards]
        E2[Reporting API]
        E3[Alert Generation]
    end
    
    A1 --> B1
    A2 --> B1
    A2 --> B2
    A3 --> B1
    A4 --> B1
    A5 --> B3
    
    B1 --> C1
    B2 --> C1
    B3 --> C1
    
    C1 --> C2
    C2 --> C3
    C3 --> C4
    
    C2 --> D1
    C2 --> D2
    C4 --> D1
    C4 --> D3
    
    D1 --> E2
    D2 --> E1
    D3 --> E1
    D3 --> E3
```

## Sequence Diagram

```mermaid
sequenceDiagram
    participant Svcs as Services (Notification/Device)
    participant Kafka
    participant Analytics as Analytics Service
    participant Processor as Event Processor
    participant MongoDB
    participant Redis
    participant Dashboard as Dashboard API
    participant Alerts as Alerting Service
    
    Svcs->>Kafka: Publish event (notification.delivered)
    Kafka-->>Svcs: Confirm publish
    
    Kafka->>Analytics: Stream event
    Analytics->>Analytics: Parse and validate event
    
    Analytics->>Redis: Update real-time counters
    Redis-->>Analytics: Confirm update
    
    Analytics->>Processor: Queue for batch processing
    
    Note over Processor: Process events in batches
    
    Processor->>Processor: Aggregate events by dimensions
    Processor->>Processor: Calculate derived metrics
    
    Processor->>MongoDB: Store aggregated metrics
    MongoDB-->>Processor: Confirm storage
    
    Processor->>Redis: Update cached metrics
    Redis-->>Processor: Confirm update
    
    Dashboard->>Redis: Query real-time metrics
    Redis-->>Dashboard: Return metrics
    
    Dashboard->>MongoDB: Query historical metrics
    MongoDB-->>Dashboard: Return metrics
    
    Analytics->>Alerts: Check alert conditions
    Alerts->>Alerts: Evaluate alert rules
    
    alt Alert triggered
        Alerts->>Alerts: Generate alert
    end
```

## Metrics Collection

```mermaid
classDiagram
    class MetricsService {
        +incrementCounter(name, value, tags)
        +recordHistogram(name, value, tags)
        +recordGauge(name, value, tags)
        +measureExecutionTime(metricName, fn, tags)
        +startTimer(name)
        +stopTimer(timer)
    }
    
    class NotificationMetrics {
        +created(userId, source)
        +queued(priority)
        +processing(userId)
        +delivered(userId, deviceType)
        +failed(userId, deviceType, reason)
        +retried(userId, attemptCount)
        +expired(userId)
    }
    
    class DeviceMetrics {
        +registered(platform)
        +updated(platform)
        +deleted(platform)
        +tokenRefreshed(platform)
    }
    
    class SystemMetrics {
        +apiLatency(endpoint, method)
        +databaseLatency(operation)
        +queueLatency(queue)
        +queueDepth(queue)
        +errorRate(service)
        +cpuUsage(service)
        +memoryUsage(service)
    }
    
    MetricsService <|-- NotificationMetrics
    MetricsService <|-- DeviceMetrics
    MetricsService <|-- SystemMetrics
```

## Analytics Data Flow

```mermaid
graph TD
    A[Event Sources] -->|Raw Events| B(Event Stream)
    B -->|Real-time| C{Processing}
    B -->|Batch| D{Aggregation}
    
    C -->|Counters| E[Real-time Metrics]
    C -->|State| F[Active Notifications]
    
    D -->|Time-based| G[Hourly Aggregates]
    D -->|User-based| H[User Engagement]
    D -->|Device-based| I[Device Performance]
    
    E --> J[Real-time Dashboard]
    F --> J
    
    G --> K[Historical Reports]
    H --> K
    I --> K
    
    E --> L{Alerting}
    G --> L
    
    L -->|Threshold| M[Alerts]
```

## Key Metrics

```mermaid
mindmap
  root((Notification Metrics))
    Volume
      Notifications Created
      Notifications Sent
      Notifications Failed
      Notifications Expired
    Delivery
      Delivery Success Rate
      Average Delivery Time
      Devices Reached
      Delivery Attempts per Notification
    Engagement
      Open Rate
      Click-through Rate
      Conversion Rate
      Response Time
    Performance
      API Latency
      Queue Processing Time
      Database Operation Time
      External Service Response Time
    Errors
      Validation Errors
      Authentication Errors
      Device Token Errors
      Third-party Service Errors
```

## Dashboard Layout

```mermaid
classDiagram
    class DeliveryDashboard {
        +Delivery Success Rate by Channel
        +Delivery Volume by Priority
        +Failed Notifications by Reason
        +Delivery Time Distribution
    }
    
    class EngagementDashboard {
        +Open Rate by Category
        +Click-through Rate by Category
        +Conversion Rate by Source
        +Engagement by Time of Day
    }
    
    class OperationalDashboard {
        +API Requests by Endpoint
        +Queue Depth by Priority
        +Error Rate by Service
        +System Resource Usage
    }
    
    class ExecutiveDashboard {
        +Total Notifications Sent
        +Overall Success Rate
        +Top Performing Categories
        +Monthly Growth Trends
    }
```

## Implementation Example (Metrics Service)

```typescript
/**
 * Example implementation of metrics collection in the Analytics Service
 */
class AnalyticsService {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly repository: AnalyticsRepository,
    private readonly kafkaService: KafkaService,
  ) {
    this.initializeEventProcessing();
  }

  /**
   * Set up Kafka consumer for analytics events
   */
  private initializeEventProcessing(): void {
    this.kafkaService.subscribe(
      'notification-events',
      'analytics-service',
      async (message) => await this.processEvent(message)
    );
  }

  /**
   * Process an analytics event from Kafka
   */
  private async processEvent(event: any): Promise<void> {
    try {
      switch (event.event_type) {
        case 'notification.created':
          this.trackNotificationCreated(event);
          break;
        case 'notification.delivered':
          this.trackNotificationDelivered(event);
          break;
        case 'notification.failed':
          this.trackNotificationFailed(event);
          break;
        case 'notification.opened':
          this.trackNotificationOpened(event);
          break;
        // Additional event types
      }
      
      // Store event for batch processing
      await this.repository.storeEvent(event);
    } catch (error) {
      console.error(`Error processing analytics event: ${error.message}`);
    }
  }
  
  /**
   * Track notification created metrics
   */
  private trackNotificationCreated(event: any): void {
    const { user_id, source, priority } = event.data;
    
    // Increment counters
    this.metricsService.incrementCounter('notifications.created', 1, {
      user_id,
      source,
      priority,
    });
    
    // Additional metrics
  }
  
  /**
   * Track notification delivered metrics
   */
  private trackNotificationDelivered(event: any): void {
    const { user_id, device_id, platform, attempt_number } = event.data;
    
    // Increment counters
    this.metricsService.incrementCounter('notifications.delivered', 1, {
      user_id,
      platform,
    });
    
    // Record delivery time
    const deliveryTime = Date.now() - new Date(event.data.created_at).getTime();
    this.metricsService.recordHistogram('notification.delivery_time', deliveryTime, {
      platform,
      priority: event.data.priority,
    });
    
    // Additional metrics
  }

  /**
   * Generate aggregated metrics reports
   */
  async generateDailyMetricsReport(): Promise<any> {
    return await this.repository.getAggregatedMetrics({
      timeRange: {
        start: /* yesterday */,
        end: /* today */,
      },
      granularity: 'hourly',
    });
  }
}
``` 