# Deployment and Scaling Architecture

This document describes the deployment architecture and scaling strategy for the Notification Service.

## Kubernetes Deployment Architecture

```mermaid
flowchart TD
    subgraph "External Services"
        FCM["Firebase Cloud Messaging"]
        APNS["Apple Push Notification Service"]
        SMS["SMS Gateway"]
        Email["Email Provider"]
    end

    subgraph "Kubernetes Cluster"
        subgraph "Ingress Layer"
            Ingress["Ingress Controller"]
            CDN["CDN / Edge Cache"]
        end
        
        subgraph "API Layer"
            APIGateway["API Gateway Pods"]
            AuthSvc["Auth Service Pods"]
        end
        
        subgraph "Core Services"
            NotifSvc["Notification Service Pods"]
            DeviceSvc["Device Service Pods"]
            DeliverySvc["Delivery Service Pods"]
            RetrySvc["Retry Service Pods"]
            AnalyticsSvc["Analytics Service Pods"]
        end
        
        subgraph "Data Layer"
            MongoDB[(MongoDB Cluster)]
            Redis[(Redis Cluster)]
            Kafka[(Kafka Cluster)]
        end
        
        subgraph "Background Workers"
            ProcessorWorkers["Notification Processor Workers"]
            AnalyticsWorkers["Analytics Workers"]
            BatchWorkers["Batch Processing Workers"]
        end
        
        subgraph "Monitoring Stack"
            Prometheus["Prometheus"]
            Grafana["Grafana Dashboards"]
            ElasticSearch["Elastic Search"]
            Kibana["Kibana"]
            Jaeger["Jaeger Tracing"]
        end
    end
    
    Ingress --> APIGateway
    APIGateway --> AuthSvc
    APIGateway --> NotifSvc
    APIGateway --> DeviceSvc
    
    NotifSvc --> MongoDB
    NotifSvc --> Redis
    NotifSvc --> Kafka
    
    DeviceSvc --> MongoDB
    DeviceSvc --> Redis
    
    DeliverySvc --> FCM
    DeliverySvc --> APNS
    DeliverySvc --> SMS
    DeliverySvc --> Email
    DeliverySvc --> MongoDB
    
    Kafka --> ProcessorWorkers
    ProcessorWorkers --> DeliverySvc
    ProcessorWorkers --> RetrySvc
    
    Kafka --> AnalyticsWorkers
    AnalyticsWorkers --> MongoDB
    
    NotifSvc -.-> Prometheus
    DeviceSvc -.-> Prometheus
    DeliverySvc -.-> Prometheus
    AuthSvc -.-> Prometheus
    Prometheus --> Grafana
    
    NotifSvc -.-> ElasticSearch
    DeviceSvc -.-> ElasticSearch
    DeliverySvc -.-> ElasticSearch
    AuthSvc -.-> ElasticSearch
    ElasticSearch --> Kibana
    
    NotifSvc -.-> Jaeger
    DeviceSvc -.-> Jaeger
    DeliverySvc -.-> Jaeger
    AuthSvc -.-> Jaeger
```

## Horizontal Pod Autoscaling

```mermaid
graph TD
    A[Metrics Server] -->|Collects Pod Metrics| B{Horizontal Pod Autoscaler}
    C[CPU Utilization] --> B
    D[Memory Usage] --> B
    E[Custom Metrics] --> B
    
    B -->|Scale up| F[API Gateway Deployment]
    B -->|Scale up| G[Notification Service Deployment]
    B -->|Scale up| H[Delivery Service Deployment]
    
    subgraph "HPA Configuration"
        I[minReplicas: 3]
        J[maxReplicas: 20]
        K[targetCPUUtilizationPercentage: 70%]
        L[targetMemoryUtilizationPercentage: 80%]
        M[customMetrics: queue_depth > 1000]
    end
```

## Database Scaling Strategy

```mermaid
flowchart TD
    subgraph "MongoDB Cluster"
        subgraph "Shard 1"
            Shard1Primary[(Primary)]
            Shard1Sec1[(Secondary)]
            Shard1Sec2[(Secondary)]
            
            Shard1Primary --- Shard1Sec1
            Shard1Primary --- Shard1Sec2
        end
        
        subgraph "Shard 2"
            Shard2Primary[(Primary)]
            Shard2Sec1[(Secondary)]
            Shard2Sec2[(Secondary)]
            
            Shard2Primary --- Shard2Sec1
            Shard2Primary --- Shard2Sec2
        end
        
        subgraph "Shard 3"
            Shard3Primary[(Primary)]
            Shard3Sec1[(Secondary)]
            Shard3Sec2[(Secondary)]
            
            Shard3Primary --- Shard3Sec1
            Shard3Primary --- Shard3Sec2
        end
        
        subgraph "Config Servers"
            ConfigSrv1[("Config Server 1")]
            ConfigSrv2[("Config Server 2")]
            ConfigSrv3[("Config Server 3")]
            
            ConfigSrv1 --- ConfigSrv2
            ConfigSrv2 --- ConfigSrv3
            ConfigSrv3 --- ConfigSrv1
        end
        
        Router1[("Mongos Router 1")]
        Router2[("Mongos Router 2")]
        Router3[("Mongos Router 3")]
        
        Router1 --- ConfigSrv1
        Router2 --- ConfigSrv2
        Router3 --- ConfigSrv3
        
        Router1 --- Shard1Primary
        Router1 --- Shard2Primary
        Router1 --- Shard3Primary
        
        Router2 --- Shard1Primary
        Router2 --- Shard2Primary
        Router2 --- Shard3Primary
        
        Router3 --- Shard1Primary
        Router3 --- Shard2Primary
        Router3 --- Shard3Primary
    end
    
    subgraph "Sharding Keys"
        ShardByUser[("user_id (hashed)")]
        ShardByNotification[("notification_id (hashed)")]
        ShardByTime[("created_at")]
    end
    
    ShardByUser --> Shard1Primary
    ShardByUser --> Shard2Primary
    ShardByUser --> Shard3Primary
    
    ShardByNotification --> Shard1Primary
    ShardByNotification --> Shard2Primary
    ShardByNotification --> Shard3Primary
    
    ShardByTime --> Shard1Primary
    ShardByTime --> Shard2Primary
    ShardByTime --> Shard3Primary
```

## Redis Scaling Architecture

```mermaid
flowchart TD
    subgraph "Redis Cluster"
        subgraph "Master-Replica Sets"
            Master1[(Master 1)] --- Replica1A[(Replica 1A)]
            Master1 --- Replica1B[(Replica 1B)]
            
            Master2[(Master 2)] --- Replica2A[(Replica 2A)]
            Master2 --- Replica2B[(Replica 2B)]
            
            Master3[(Master 3)] --- Replica3A[(Replica 3A)]
            Master3 --- Replica3B[(Replica 3B)]
        end
        
        subgraph "Hash Slots"
            Slots1["Slots 0-5460"]
            Slots2["Slots 5461-10922"]
            Slots3["Slots 10923-16383"]
        end
        
        Master1 --- Slots1
        Master2 --- Slots2
        Master3 --- Slots3
        
        Sentinel1[("Sentinel 1")]
        Sentinel2[("Sentinel 2")]
        Sentinel3[("Sentinel 3")]
        
        Sentinel1 --- Master1
        Sentinel1 --- Master2
        Sentinel1 --- Master3
        
        Sentinel2 --- Master1
        Sentinel2 --- Master2
        Sentinel2 --- Master3
        
        Sentinel3 --- Master1
        Sentinel3 --- Master2
        Sentinel3 --- Master3
    end
```

## Kafka Scaling Architecture

```mermaid
flowchart TD
    subgraph "Kafka Cluster"
        subgraph "Brokers"
            Broker1[("Broker 1")]
            Broker2[("Broker 2")]
            Broker3[("Broker 3")]
        end
        
        subgraph "Notification Events Topic"
            NEPart1["Partition 0"]
            NEPart2["Partition 1"]
            NEPart3["Partition 2"]
        end
        
        subgraph "Device Events Topic"
            DEPart1["Partition 0"]
            DEPart2["Partition 1"]
            DEPart3["Partition 2"]
        end
        
        subgraph "Analytics Events Topic"
            AEPart1["Partition 0"]
            AEPart2["Partition 1"]
            AEPart3["Partition 2"]
        end
        
        Broker1 --- NEPart1
        Broker2 --- NEPart2
        Broker3 --- NEPart3
        
        Broker1 --- DEPart2
        Broker2 --- DEPart3
        Broker3 --- DEPart1
        
        Broker1 --- AEPart3
        Broker2 --- AEPart1
        Broker3 --- AEPart2
        
        ZK1[("ZooKeeper 1")]
        ZK2[("ZooKeeper 2")]
        ZK3[("ZooKeeper 3")]
        
        ZK1 --- ZK2
        ZK2 --- ZK3
        ZK3 --- ZK1
        
        ZK1 --- Broker1
        ZK1 --- Broker2
        ZK1 --- Broker3
    end
```

## Production Deployment Environments

```mermaid
graph LR
    subgraph "Continuous Integration"
        CI[GitHub Actions]
        DockerRegistry[Docker Registry]
    end
    
    subgraph "Deployment Environments"
        Dev[Development]
        Test[Testing]
        Staging[Staging]
        Prod[Production]
    end
    
    subgraph "Deployment Pipeline"
        BuildTest[Build & Test]
        ImageBuild[Build Docker Images]
        DeployDev[Deploy to Dev]
        IntegrationTest[Integration Tests]
        DeployTest[Deploy to Test]
        UAT[User Acceptance Tests]
        DeployStaging[Deploy to Staging]
        PerformanceTest[Performance Tests]
        DeployProd[Deploy to Production]
    end
    
    CI --> BuildTest
    BuildTest --> ImageBuild
    ImageBuild --> DockerRegistry
    DockerRegistry --> DeployDev
    DeployDev --> Dev
    DeployDev --> IntegrationTest
    IntegrationTest --> DeployTest
    DeployTest --> Test
    DeployTest --> UAT
    UAT --> DeployStaging
    DeployStaging --> Staging
    DeployStaging --> PerformanceTest
    PerformanceTest --> DeployProd
    DeployProd --> Prod
```

## Load Balancing Strategy

```mermaid
graph TD
    subgraph "Load Balancing"
        GLB[Global Load Balancer]
        RLB1[Regional Load Balancer 1]
        RLB2[Regional Load Balancer 2]
        
        GLB --> RLB1
        GLB --> RLB2
        
        RLB1 --> Ingress1[Ingress Controller 1]
        RLB2 --> Ingress2[Ingress Controller 2]
        
        Ingress1 --> API1[API Gateway Pods]
        Ingress2 --> API2[API Gateway Pods]
    end
    
    subgraph "Traffic Management"
        SM[Service Mesh]
        CB[Circuit Breaker]
        RL[Rate Limiter]
        
        API1 --> SM
        API2 --> SM
        
        SM --> CB
        CB --> RL
        RL --> Services[Backend Services]
    end
```

## Disaster Recovery Strategy

```mermaid
graph LR
    subgraph "Primary Region"
        PKube[Kubernetes Cluster]
        PMongo[MongoDB Cluster]
        PRedis[Redis Cluster]
        PKafka[Kafka Cluster]
    end
    
    subgraph "DR Region"
        DRKube[Kubernetes Cluster]
        DRMongo[MongoDB Cluster]
        DRRedis[Redis Cluster]
        DRKafka[Kafka Cluster]
    end
    
    PMongo -->|Async Replication| DRMongo
    PRedis -->|Async Replication| DRRedis
    PKafka -->|MirrorMaker| DRKafka
    
    subgraph "Backup & Recovery"
        Backup[Regular Backups]
        SCP[Service Continuity Plan]
        RTO[Recovery Time Objective: 15min]
        RPO[Recovery Point Objective: 5min]
    end
    
    PMongo --> Backup
    PRedis --> Backup
    PKafka --> Backup
    
    Backup --> SCP
    SCP --> RTO
    SCP --> RPO
    
    subgraph "Failover Strategy"
        Auto[Automated Failover]
        Manual[Manual Failover]
        HA[High Availability Setup]
    end
    
    PKube --> HA
    DRKube --> HA
    HA --> Auto
    HA --> Manual
``` 