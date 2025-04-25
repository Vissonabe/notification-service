import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { startMongoMemoryServer, stopMongoMemoryServer, createMockJwtToken } from '../../test-helpers/test-base';
import { AppModule } from '../../../src/app.module';
import { DeviceService } from '../../../src/modules/device/device.service';
import { AuthGuard } from '../../../src/modules/auth/guards/auth.guard';
import { RolesGuard } from '../../../src/modules/auth/guards/roles.guard';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';

describe('Notification API (e2e)', () => {
  let app: INestApplication;
  let deviceService: DeviceService;
  let notificationModel: Model<any>;
  let deviceModel: Model<any>;
  
  // Test data
  let testUserId = 'test-e2e-user';
  let testDeviceId: string;
  let authToken: string;

  beforeAll(async () => {
    // Start MongoDB memory server
    await startMongoMemoryServer();
    
    // Create testing module with e2e configuration
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
        AppModule,
      ],
    })
    .overrideGuard(AuthGuard)
    .useValue({
      canActivate: (context) => {
        // Extract token from request
        const request = context.switchToHttp().getRequest();
        const token = request.headers.authorization?.split(' ')[1];
        
        if (!token) return false;
        
        // For e2e testing, we'll attach the user info without actual JWT validation
        request.user = {
          id: testUserId,
          roles: ['user'],
          name: 'E2E Test User',
        };
        
        return true;
      },
    })
    .overrideGuard(RolesGuard)
    .useValue({
      canActivate: () => true,
    })
    .compile();

    // Create the application instance
    app = moduleFixture.createNestApplication();
    
    // Apply global pipes and middleware
    app.useGlobalPipes(new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }));
    
    await app.init();
    
    // Get services and models
    deviceService = app.get<DeviceService>(DeviceService);
    notificationModel = app.get<Model<any>>(getModelToken('Notification'));
    deviceModel = app.get<Model<any>>(getModelToken('Device'));
    
    // Create auth token
    authToken = createMockJwtToken({ sub: testUserId, roles: ['user'] });
    
    // Setup test data - Register a test device
    const deviceData = {
      user_id: testUserId,
      device_token: 'fcm-token-e2e-test',
      platform: 'android',
      app_version: '1.0.0',
      device_model: 'E2E Test Device',
      os_version: 'Android 13',
      language: 'en-US',
      timezone: 'America/New_York',
    };
    
    const createdDevice = await deviceService.create(deviceData);
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
        priority: 'high',
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

      expect(response.body).toBeDefined();
      expect(response.body.status).toEqual('created');
      expect(response.body.recipient.user_id).toEqual(testUserId);
      expect(response.body.notification.title).toEqual(notificationData.notification.title);
      
      // Store notification ID for later tests
      const notificationId = response.body._id;
      
      // Verify it's in the database
      const dbNotification = await notificationModel.findById(notificationId);
      expect(dbNotification).toBeDefined();
    });

    it('should reject invalid notification data', async () => {
      const invalidData = {
        // Missing required fields
        notification: {
          // Missing title
          body: 'Invalid notification',
        },
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
        priority: 'high',
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
  });

  describe('/api/v1/notifications/:id (GET)', () => {
    it('should retrieve a notification by ID', async () => {
      // First create a notification
      const notificationData = {
        recipient: {
          user_id: testUserId,
          device_ids: [testDeviceId],
        },
        priority: 'normal',
        notification: {
          title: 'Get Test',
          body: 'This is a test for GET endpoint',
        },
        data: {},
        source: 'e2e-test',
        idempotency_key: `get-test-${Date.now()}`,
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(notificationData)
        .expect(201);

      const notificationId = createResponse.body._id;

      // Now retrieve it
      const getResponse = await request(app.getHttpServer())
        .get(`/api/v1/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body).toBeDefined();
      expect(getResponse.body._id).toEqual(notificationId);
      expect(getResponse.body.notification.title).toEqual('Get Test');
    });

    it('should return 404 for non-existent notification', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/notifications/nonexistent123')
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
          priority: 'normal',
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

      // Get first page (3 items)
      const firstPageResponse = await request(app.getHttpServer())
        .get(`/api/v1/notifications/user/${testUserId}?limit=3&offset=0`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(firstPageResponse.body).toBeDefined();
      expect(firstPageResponse.body.notifications).toBeDefined();
      expect(firstPageResponse.body.notifications.length).toEqual(3);
      expect(firstPageResponse.body.total).toEqual(5);

      // Get second page (2 items)
      const secondPageResponse = await request(app.getHttpServer())
        .get(`/api/v1/notifications/user/${testUserId}?limit=3&offset=3`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(secondPageResponse.body).toBeDefined();
      expect(secondPageResponse.body.notifications).toBeDefined();
      expect(secondPageResponse.body.notifications.length).toEqual(2);
      expect(secondPageResponse.body.total).toEqual(5);
    });
  });

  describe('/api/v1/notifications/:id/status (PATCH)', () => {
    it('should update notification status', async () => {
      // First create a notification
      const notificationData = {
        recipient: {
          user_id: testUserId,
          device_ids: [testDeviceId],
        },
        priority: 'high',
        notification: {
          title: 'Status Update Test',
          body: 'This is a test for status update',
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

      const notificationId = createResponse.body._id;

      // Update status to 'delivered'
      const updateResponse = await request(app.getHttpServer())
        .patch(`/api/v1/notifications/${notificationId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'delivered' })
        .expect(200);

      expect(updateResponse.body).toBeDefined();
      expect(updateResponse.body.status).toEqual('delivered');

      // Verify in database
      const dbNotification = await notificationModel.findById(notificationId);
      expect(dbNotification.status).toEqual('delivered');
    });

    it('should reject invalid status values', async () => {
      // First create a notification
      const notificationData = {
        recipient: {
          user_id: testUserId,
          device_ids: [testDeviceId],
        },
        priority: 'normal',
        notification: {
          title: 'Invalid Status Test',
          body: 'This is a test for invalid status',
        },
        data: {},
        source: 'e2e-test',
        idempotency_key: `invalid-status-test-${Date.now()}`,
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(notificationData)
        .expect(201);

      const notificationId = createResponse.body._id;

      // Try to update with invalid status
      await request(app.getHttpServer())
        .patch(`/api/v1/notifications/${notificationId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'invalid_status' })
        .expect(400);
    });
  });
}); 