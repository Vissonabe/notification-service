import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module';
import { AuthService } from '../../src/modules/auth/auth.service';
import { DeviceService } from '../../src/modules/device/device.service';
import { startMongoMemoryServer, stopMongoMemoryServer } from '../test-helpers/test-base';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { Notification } from '../../src/modules/notification/schemas/notification.schema';
import { Device } from '../../src/modules/device/schemas/device.schema';
import { DevicePlatform } from '../../src/shared/interfaces/device.interface';
import { NotificationPriority } from '../../src/shared/interfaces/notification.interface';

describe('Notification API (e2e)', () => {
  let app: INestApplication;
  let authService: AuthService;
  let deviceService: DeviceService;
  let notificationModel: Model<Notification>;
  let deviceModel: Model<Device>;
  
  // Test data
  const testUserId = 'test-e2e-user';
  let testDeviceId: string;
  let authToken: string;

  beforeAll(async () => {
    // Start MongoDB memory server
    await startMongoMemoryServer();
    
    // Create testing module
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        MongooseModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: async () => ({
            uri: process.env.MONGODB_URI,
          }),
          inject: [ConfigService],
        }),
        JwtModule.registerAsync({
          imports: [ConfigModule],
          useFactory: async (configService: ConfigService) => ({
            secret: configService.get<string>('JWT_SECRET') || 'test-jwt-secret',
            signOptions: { 
              expiresIn: configService.get<string>('JWT_EXPIRATION') || '1h',
            },
          }),
          inject: [ConfigService],
        }),
        AppModule,
      ],
    }).compile();

    // Create app with validation pipe
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }));
    
    await app.init();
    
    // Get services and models
    authService = app.get<AuthService>(AuthService);
    deviceService = app.get<DeviceService>(DeviceService);
    notificationModel = app.get<Model<Notification>>(getModelToken('Notification'));
    deviceModel = app.get<Model<Device>>(getModelToken('Device'));
    
    // Create auth token
    authToken = authService.generateToken(testUserId, 'user');
    
    // Register a test device
    const deviceData = {
      user_id: testUserId,
      device_token: 'fcm-token-e2e-test',
      platform: DevicePlatform.ANDROID,
      app_version: '1.0.0',
      device_model: 'E2E Test Device',
      os_version: 'Android 13',
      language: 'en-US',
      timezone: 'America/New_York',
      notification_preferences: {
        enabled: true,
        categories: {
          marketing: true,
          transactional: true,
        },
      },
    };
    
    const createdDevice = await deviceService.registerDevice(deviceData);
    testDeviceId = createdDevice._id.toString();
  });

  afterAll(async () => {
    await app.close();
    await stopMongoMemoryServer();
  });

  beforeEach(async () => {
    // Clear notifications collection before each test
    await notificationModel.deleteMany({});
  });

  describe('/api/v1/notifications (POST)', () => {
    it('should create a notification', async () => {
      const notificationData = {
        recipient: {
          user_id: testUserId,
          device_ids: [testDeviceId],
        },
        priority: NotificationPriority.HIGH,
        notification: {
          title: 'E2E Test Notification',
          body: 'This is an E2E test notification',
        },
        data: {
          test_id: 'e2e-test',
        },
        source: 'e2e-test',
        idempotency_key: `e2e-test-${Date.now()}`,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(notificationData)
        .expect(201);

      expect(response.body).toHaveProperty('notification_id');
      expect(response.body).toHaveProperty('status', 'accepted');

      // Verify notification was created in database
      const notifications = await notificationModel.find({
        'recipient.user_id': testUserId,
      }).exec();
      
      expect(notifications).toHaveLength(1);
      expect(notifications[0].notification.title).toBe('E2E Test Notification');
    });

    it('should reject invalid notification data', async () => {
      const invalidData = {
        // Missing required fields
        notification: {
          // Missing title
          body: 'Invalid notification',
        },
        source: 'e2e-test',
      };

      await request(app.getHttpServer())
        .post('/api/v1/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);
    });

    it('should reject requests without authentication', async () => {
      const notificationData = {
        recipient: {
          user_id: testUserId,
          device_ids: [testDeviceId],
        },
        priority: NotificationPriority.HIGH,
        notification: {
          title: 'Auth Test',
          body: 'This should be rejected',
        },
        data: {},
        source: 'e2e-test',
        idempotency_key: `auth-test-${Date.now()}`,
      };

      await request(app.getHttpServer())
        .post('/api/v1/notifications')
        .send(notificationData)
        .expect(401);
    });

    it('should handle idempotency correctly', async () => {
      const idempotencyKey = `idempotency-e2e-test-${Date.now()}`;
      const notificationData = {
        recipient: {
          user_id: testUserId,
          device_ids: [testDeviceId],
        },
        priority: NotificationPriority.HIGH,
        notification: {
          title: 'Idempotency Test',
          body: 'This tests idempotency handling',
        },
        data: {},
        source: 'e2e-test',
        idempotency_key: idempotencyKey,
      };

      // First request
      const firstResponse = await request(app.getHttpServer())
        .post('/api/v1/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(notificationData)
        .expect(201);

      // Second request with same idempotency key
      const secondResponse = await request(app.getHttpServer())
        .post('/api/v1/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(notificationData)
        .expect(201);

      // Both should return the same notification ID
      expect(secondResponse.body.notification_id).toBe(firstResponse.body.notification_id);

      // Only one notification should be created
      const notifications = await notificationModel.find({
        idempotency_key: idempotencyKey,
      }).exec();
      
      expect(notifications).toHaveLength(1);
    });
  });

  describe('/api/v1/notifications/:id (GET)', () => {
    it('should retrieve a notification by ID', async () => {
      // Create a notification first
      const notificationData = {
        recipient: {
          user_id: testUserId,
          device_ids: [testDeviceId],
        },
        priority: NotificationPriority.MEDIUM,
        notification: {
          title: 'Get By ID Test',
          body: 'This tests getting a notification by ID',
        },
        data: {},
        source: 'e2e-test',
        idempotency_key: `get-by-id-test-${Date.now()}`,
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(notificationData)
        .expect(201);

      const notificationId = createResponse.body.notification_id;

      // Get the notification by ID
      const getResponse = await request(app.getHttpServer())
        .get(`/api/v1/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body).toHaveProperty('_id', notificationId);
      expect(getResponse.body.notification.title).toBe('Get By ID Test');
      expect(getResponse.body.recipient.user_id).toBe(testUserId);
    });

    it('should return 404 for non-existent notification', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/notifications/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('/api/v1/notifications/user/:userId (GET)', () => {
    it('should retrieve notifications for a user with pagination', async () => {
      // Create 5 notifications for the test user
      for (let i = 0; i < 5; i++) {
        const notificationData = {
          recipient: {
            user_id: testUserId,
            device_ids: [testDeviceId],
          },
          priority: NotificationPriority.MEDIUM,
          notification: {
            title: `User Test ${i}`,
            body: `Notification ${i} for user endpoint test`,
          },
          data: { index: i },
          source: 'e2e-test',
          idempotency_key: `user-test-${Date.now()}-${i}`,
        };

        await request(app.getHttpServer())
          .post('/api/v1/notifications')
          .set('Authorization', `Bearer ${authToken}`)
          .send(notificationData)
          .expect(201);
      }

      // Get notifications for user with pagination
      const response = await request(app.getHttpServer())
        .get(`/api/v1/notifications/user/${testUserId}?limit=3&page=1`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body).toHaveLength(3); // Limit is 3
      
      // Get second page
      const secondPageResponse = await request(app.getHttpServer())
        .get(`/api/v1/notifications/user/${testUserId}?limit=3&page=2`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(secondPageResponse.body).toBeInstanceOf(Array);
      expect(secondPageResponse.body).toHaveLength(2); // 5 total, 3 on first page, 2 on second
    });

    it('should return empty array for user with no notifications', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/notifications/user/user-with-no-notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body).toHaveLength(0);
    });
  });

  describe('/api/v1/notifications/:id/status (GET)', () => {
    it('should retrieve delivery status for a notification', async () => {
      // Create a notification
      const notificationData = {
        recipient: {
          user_id: testUserId,
          device_ids: [testDeviceId],
        },
        priority: NotificationPriority.HIGH,
        notification: {
          title: 'Status Test',
          body: 'This tests the status endpoint',
        },
        data: {},
        source: 'e2e-test',
        idempotency_key: `status-test-${Date.now()}`,
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(notificationData)
        .expect(201);

      const notificationId = createResponse.body.notification_id;

      // Get status
      const statusResponse = await request(app.getHttpServer())
        .get(`/api/v1/notifications/${notificationId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(statusResponse.body).toHaveProperty('notification_id', notificationId);
      expect(statusResponse.body).toHaveProperty('status');
      expect(statusResponse.body).toHaveProperty('delivery_attempts');
      expect(statusResponse.body.delivery_attempts).toBeInstanceOf(Array);
    });

    it('should return 404 for non-existent notification status', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/notifications/non-existent-id/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
