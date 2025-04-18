# Notification Retry Mechanism

This document describes the retry mechanism for failed notification deliveries in the Notification Service.

## Flow Diagram

```mermaid
flowchart TD
    Start([Notification Delivery Failed]) --> A[Record failed delivery attempt]
    A --> B{Check max retries}
    B -->|Max retries reached| C[Mark as permanently failed]
    C --> D[Send to dead-letter queue]
    D --> E[Update notification status]
    E --> F[Log failure to metrics]
    F --> End1([End - No more retries])
    
    B -->|Retries remaining| G[Calculate backoff delay]
    G --> H[Get device information]
    H --> I[Check device active status]
    
    I -->|Device inactive| J[Skip retry for device]
    J --> End2([End - Device inactive])
    
    I -->|Device active| K[Apply exponential backoff]
    K --> L[Apply jitter to prevent thundering herd]
    
    L --> M{Notification priority}
    M -->|Critical| N[Short backoff: 10s base]
    M -->|High| O[Medium backoff: 30s base]
    M -->|Medium| P[Long backoff: 2m base]
    M -->|Low| Q[Extended backoff: 5m base]
    
    N --> R[Schedule retry with Redis]
    O --> R
    P --> S[Schedule retry with Kafka]
    Q --> S
    
    R --> T[Increment retry count]
    S --> T
    
    T --> U[Update notification status to "retrying"]
    U --> End3([End - Scheduled for retry])
```

## Sequence Diagram

```mermaid
sequenceDiagram
    participant Processor as Notification Processor
    participant RetryMgr as Retry Service
    participant DeviceSvc as Device Service
    participant Redis
    participant Kafka
    participant MongoDB
    participant Metrics
    
    Processor->>Processor: Delivery failure detected
    Processor->>MongoDB: Record failed delivery attempt
    MongoDB-->>Processor: Confirm save
    
    Processor->>RetryMgr: Request retry assessment
    RetryMgr->>MongoDB: Get notification details
    MongoDB-->>RetryMgr: Return notification data
    
    RetryMgr->>RetryMgr: Check max retries for priority
    
    alt Max retries reached
        RetryMgr->>MongoDB: Mark permanently failed
        RetryMgr->>Kafka: Send to dead-letter queue
        RetryMgr->>Metrics: Log permanent failure
        RetryMgr-->>Processor: No more retries
    else Retries remaining
        RetryMgr->>DeviceSvc: Check device status
        DeviceSvc-->>RetryMgr: Device status
        
        alt Device is active
            RetryMgr->>RetryMgr: Calculate backoff with jitter
            
            alt Critical or High priority
                RetryMgr->>Redis: Schedule retry with Redis
                Redis-->>RetryMgr: Confirm scheduling
            else Medium or Low priority
                RetryMgr->>Kafka: Schedule retry with Kafka
                Kafka-->>RetryMgr: Confirm scheduling
            end
            
            RetryMgr->>MongoDB: Increment retry count
            RetryMgr->>MongoDB: Update notification status
            MongoDB-->>RetryMgr: Confirm update
            RetryMgr->>Metrics: Log retry scheduled
            RetryMgr-->>Processor: Retry scheduled
        else Device inactive
            RetryMgr-->>Processor: Skip retry for inactive device
        end
    end
```

## Backoff Strategy Implementation

```mermaid
graph LR
    A[Failed Delivery] --> B[Base Delay by Priority]
    B --> C[Exponential Growth]
    C --> D[Add Jitter]
    D --> E[Apply Max Delay Cap]
    E --> F[Queue with Delay]
    
    subgraph "Base Delay by Priority"
        B1[Critical: 10s]
        B2[High: 30s]
        B3[Medium: 2m]
        B4[Low: 5m]
    end
    
    subgraph "Exponential Growth"
        C1["baseDelay * 2^(attemptNumber-1)"]
    end
    
    subgraph "Add Jitter"
        D1["delay + (random * 0.3 * delay)"]
    end
```

## State Diagram

```mermaid
stateDiagram-v2
    [*] --> DeliveryFailed: Notification delivery fails
    
    DeliveryFailed --> AssessingRetry: Evaluate retry eligibility
    
    AssessingRetry --> SchedulingRetry: Eligible for retry
    AssessingRetry --> PermanentFailure: Max retries reached
    
    SchedulingRetry --> AwaitingRetry: Delay applied based on backoff
    AwaitingRetry --> Retrying: Retry timer expires
    
    Retrying --> DeliverySucceeded: Retry succeeds
    Retrying --> DeliveryFailed: Retry fails
    
    DeliverySucceeded --> [*]
    PermanentFailure --> [*]
```

## Implementation Details

### Retry Configuration by Priority

```mermaid
classDiagram
    class RetryConfig {
        +getPriorityBackoff(priority, attemptNumber)
        +shouldRetry(priority, attemptNumber)
        +calculateBackoffDelay(priority, attemptNumber)
        +addJitter(delay)
    }
    
    class PriorityConfig {
        +NotificationPriority priority
        +Number maxRetries
        +Number baseDelayMs
        +Number maxDelayMs
    }
    
    RetryConfig "1" -- "4" PriorityConfig
    
    class PriorityConfigs {
        CRITICAL: {maxRetries: 10, baseDelayMs: 10000, maxDelayMs: 300000}
        HIGH: {maxRetries: 8, baseDelayMs: 30000, maxDelayMs: 900000}
        MEDIUM: {maxRetries: 5, baseDelayMs: 120000, maxDelayMs: 3600000}
        LOW: {maxRetries: 3, baseDelayMs: 300000, maxDelayMs: 7200000}
    }
```

### Retry Backoff Formula

The exponential backoff delay is calculated using the following formula:

```
delay = baseDelay * (2 ^ (attemptNumber - 1))
```

To prevent the "thundering herd" problem, a jitter is applied:

```
jitter = random(0, 0.3) * delay
finalDelay = delay + jitter
```

### Code Example (TypeScript)

```typescript
/**
 * Calculate backoff delay with jitter based on priority and attempt number
 */
calculateBackoffDelay(priority: NotificationPriority, attemptNumber: number): number {
  const config = this.getPriorityConfig(priority);
  
  // Exponential backoff: baseDelay * 2^(attemptNumber-1)
  const delay = config.baseDelayMs * Math.pow(2, attemptNumber - 1);
  
  // Cap at maximum delay
  const cappedDelay = Math.min(delay, config.maxDelayMs);
  
  // Add jitter to prevent thundering herd
  return this.addJitter(cappedDelay);
}

/**
 * Add random jitter to delay to prevent thundering herd
 */
private addJitter(delay: number): number {
  // Add up to 30% random jitter
  const jitter = Math.random() * 0.3 * delay;
  return Math.floor(delay + jitter);
}
``` 