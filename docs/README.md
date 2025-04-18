# Notification Service Documentation

Welcome to the Notification Service documentation. This repository contains detailed technical documentation, including architecture overviews, flow diagrams, and sequence diagrams for the notification service.

## Table of Contents

- [Overview](#overview)
- [Architecture Documentation](#architecture-documentation)
- [Flow Diagrams](#flow-diagrams)
- [Key Components](#key-components)
  - [API Gateway](#api-gateway)
  - [Authentication Service](#authentication-service)
  - [Notification Service](#notification-service)
  - [Delivery Service](#delivery-service)
  - [Device Service](#device-service)
  - [Retry Service](#retry-service)
  - [Analytics Service](#analytics-service)
- [Database Design](#database-design)
- [API Design](#api-design)
- [Technology Stack](#technology-stack)
- [Deployment](#deployment)
- [Monitoring and Observability](#monitoring-and-observability)
- [Further Resources](#further-resources)

## Overview

The Notification Service is a scalable, microservices-based platform designed to manage and deliver notifications across multiple channels. It provides a reliable, fault-tolerant system for sending push notifications to mobile devices with support for features like prioritization, scheduling, and delivery tracking.

## Architecture Documentation

- [High-Level Design](./High-Level-Design.md) - A comprehensive overview of the system architecture, components, and technical decisions.

## Flow Diagrams

The following diagrams detail the flow of various operations within the Notification Service:

- [Device Registration Flow](./diagrams/Device-Registration-Flow.md) - Registration and management of user devices
- [Notification Flow](./diagrams/Notification-Flow.md) - Creation and delivery of notifications
- [Retry Mechanism](./diagrams/Retry-Mechanism.md) - Handling failed notification deliveries
- [Analytics Flow](./diagrams/Analytics-Flow.md) - Metrics collection and analysis
- [Authentication Flow](./diagrams/Authentication-Flow.md) - Security and access control
- [Database Schema](./diagrams/Database-Schema.md) - Database design and relationships
- [Deployment and Scaling](./diagrams/Deployment-Scaling.md) - Deployment architecture and scaling strategy
- [API Contract](./diagrams/API-Contract.md) - Detailed API specifications and contracts

## Key Components

### API Gateway

The API Gateway serves as the entry point for all client requests, handling routing, authentication, and request validation. It provides a unified API for all notification operations.

### Authentication Service

The Authentication Service manages JWT-based authentication, role-based access control, and service-to-service authentication. It provides the security infrastructure for the entire platform.

### Notification Service

The core component for notification creation and management, handling prioritization, scheduling, and notification templating. It manages notification queues and ensures idempotent processing.

### Delivery Service

Handles the actual delivery of notifications, managing platform-specific formatting (FCM, APNS), recording delivery attempts, and coordinating with the Retry Service for failed deliveries.

### Device Service

Manages device registration, token storage, and user-device associations. It maintains device notification preferences, implements quiet hours, and tracks device activity.

### Retry Service

Implements retry strategies for failed notifications, applying exponential backoff with jitter, managing maximum retry attempts by priority, and handling dead-letter scenarios.

### Analytics Service

Collects notification delivery and engagement metrics, generates performance reports, provides insights on notification effectiveness, and tracks conversion rates.

## Database Design

The notification service uses MongoDB as its primary database, with Redis for caching and queuing. The data model includes the following main collections:

- **Devices** - Stores registered device information, tokens, and notification preferences
- **Notifications** - Records notification content, recipients, and status
- **DeliveryAttempts** - Tracks each attempt to deliver a notification to a device

## API Design

The Notification Service provides a RESTful API for notification management and device registration. All endpoints require JWT authentication.

### Main Endpoints

**Device Management:**
- `POST /api/v1/devices` - Register a device
- `GET /api/v1/devices/user/:userId` - Get all devices for a user
- `PUT /api/v1/devices/:id/preferences` - Update notification preferences

**Notification Management:**
- `POST /api/v1/notifications` - Create a notification
- `GET /api/v1/notifications/:id` - Get a notification by ID
- `GET /api/v1/notifications/:id/status` - Get delivery status for a notification

## Technology Stack

- **Backend**: Node.js with NestJS framework
- **Database**: MongoDB for persistence, Redis for caching
- **Message Queue**: Redis for immediate notifications, Kafka for high-volume processing
- **Push Notifications**: Firebase Cloud Messaging (FCM) for Android, Apple Push Notification Service (APNS) for iOS

## Deployment

The Notification Service is containerized using Docker and designed to be deployed in a Kubernetes cluster. The architecture supports horizontal scaling of all components to handle varying loads.

## Monitoring and Observability

The service implements extensive monitoring, logging, and metrics collection:

- Structured logging with correlation IDs
- Performance metrics collection
- Health checks for all services
- Distributed tracing for request flows

## Further Resources

- [API Documentation](../api-docs) - OpenAPI/Swagger documentation for the REST API
- [Memory Bank](../.memory-bank) - Contains additional context about project architecture and decisions 