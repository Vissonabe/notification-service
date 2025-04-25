<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
   
## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

# Notification Service

A scalable, reliable notification service for managing push notifications to mobile devices.

## Features

- Push notification delivery to iOS and Android devices
- Device registration and management
- User notification preferences and quiet hours
- Notification priority and TTL
- Scheduled notifications
- Retry and backoff strategies
- Delivery tracking and status reporting
- Authentication via JWT
- Metrics and monitoring

## Technology Stack

- Node.js v18+
- NestJS framework
- MongoDB for data persistence
- Redis for queues and caching
- BullMQ for job processing
- Firebase Cloud Messaging (FCM) for Android notifications
- Apple Push Notification Service (APNs) for iOS notifications
- JWT for authentication
- Swagger for API documentation
- Winston for logging
- Docker and Docker Compose for containerization

## Prerequisites

- Node.js v18 or higher
- npm v7 or higher
- MongoDB (or use Docker Compose)
- Redis (or use Docker Compose)

## Installation

### Option 1: Local Development

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/notification-service.git
   cd notification-service
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create a `.env` file with environment variables (see `.env` file for examples)

4. Start the service
   ```bash
   npm run start:dev
   ```

### Option 2: Docker Compose

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/notification-service.git
   cd notification-service
   ```

2. Start the service with Docker Compose
   ```bash
   docker-compose up -d
   ```

## API Documentation

Once the service is running, you can access the Swagger documentation at:
http://localhost:3000/api/docs

## API Endpoints

### Device Management

- `POST /api/v1/devices` - Register a device
- `GET /api/v1/devices/user/:userId` - Get all devices for a user
- `GET /api/v1/devices/:id` - Get a specific device
- `PUT /api/v1/devices/:id/preferences` - Update notification preferences
- `DELETE /api/v1/devices/:id` - Delete a device

### Notification Management

- `POST /api/v1/notifications` - Create a new notification
- `GET /api/v1/notifications/:id` - Get a notification by ID
- `GET /api/v1/notifications/user/:userId` - Get all notifications for a user
- `GET /api/v1/notifications/:id/status` - Get delivery status for a notification

## Sample Usage

### Register a Device

```bash
curl -X POST http://localhost:3000/api/v1/devices \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

### Send a Notification

```bash
curl -X POST http://localhost:3000/api/v1/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": {
      "user_id": "user123"
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
    "idempotency_key": "order-12345-shipped-20230615"
  }'
```

### Check Notification Status

```bash
curl -X GET http://localhost:3000/api/v1/notifications/60f1a5c8e6b3f42a4c9e1234/status
```

## Development

### Running Tests

```bash
npm run test
```

### Running Linting

```bash
npm run lint
```

### Building for Production

```bash
npm run build
```

## Deployment

For production deployment, consider:

1. Using a managed MongoDB service
2. Using a managed Redis service
3. Setting up proper authentication
4. Configuring SSL/TLS
5. Setting up monitoring and alerting

## License

[MIT](LICENSE)
