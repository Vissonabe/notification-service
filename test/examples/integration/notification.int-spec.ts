import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Model, Connection } from 'mongoose';
import { AppModule } from '../../../src/app.module';
import { NotificationService } from '../../../src/modules/notification/notification.service';
import { DeviceService } from '../../../src/modules/device/device.service';
import { 
  startMongoMemoryServer, 
  stopMongoMemoryServer, 
  clearDatabase,
  createDeviceMock, 
  TestEnv 
} from '../../test-helpers/test-base';
import { getConnectionToken } from '@nestjs/mongoose';
import { NotificationSchema } from '../../../src/modules/notification/schemas/notification.schema';
import { DeviceSchema } from '../../../src/modules/device/schemas/device.schema';
import { NotificationStatus } from '../../../src/modules/notification/enums/notification-status.enum';

describe('Notification Integration Tests', () => {
  let module: TestingModule;
  let notificationService: NotificationService;
  let deviceService: DeviceService;
  let notificationModel: Model<any>;
  let connection: Connection;
  
  // Test data
  let testDeviceId: string;
  let testUserId = 'test-user-1';

  beforeAll(async () => {
    // Start MongoDB memory server
    await startMongoMemoryServer();

    // Create testing module
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        MongooseModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: async (configService: ConfigService) => ({
            uri: process.env.MONGODB_URI,
          }),
          inject: [ConfigService],
        }),
        MongooseModule.forFeature([
          { name: 'Notification', schema: NotificationSchema },
          { name: 'Device', schema: DeviceSchema },
        ]),
        // Import the actual modules needed for integration tests
        // without the full AppModule to keep tests focused
      ],
      providers: [
        NotificationService,
        DeviceService,
        {
          provide: 'KafkaService',
          useValue: {
            produce: jest.fn(),
          },
        },
        {
          provide: 'RedisService',
          useValue: {
            set: jest.fn(),
            get: jest.fn(),
            del: jest.fn(),
            checkRateLimit: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    // Get services
    notificationService = module.get<NotificationService>(NotificationService);
    deviceService = module.get<DeviceService>(DeviceService);
    notificationModel = module.get<Model<any>>(getModelToken('Notification'));
    connection = module.get<Connection>(getConnectionToken());

    // Setup test data - create a test device
    const deviceData = createDeviceMock({ 
      user_id: testUserId,
      platform: 'android',
      _id: undefined // Let MongoDB create the ID
    });
    
    const createdDevice = await deviceService.create(deviceData);
    testDeviceId = createdDevice._id.toString();
  });

  afterAll(async () => {
    await module.close();
    await stopMongoMemoryServer();
  });

  beforeEach(async () => {
    // Clear notifications before each test
    await notificationModel.deleteMany({});
  });

  describe('End-to-end notification flow', () => {
    it('should create, update, and retrieve a notification', async () => {
      // 1. Create a notification
      const notificationData = {
        recipient: {
          user_id: testUserId,
          device_ids: [testDeviceId],
        },
        priority: 'high',
        notification: {
          title: 'Integration Test',
          body: 'This is an integration test notification.',
        },
        data: {
          test_key: 'test_value',
        },
        source: 'integration-test',
        idempotency_key: `test-key-${Date.now()}`,
      };

      const createdNotification = await notificationService.create(notificationData);
      
      expect(createdNotification).toBeDefined();
      expect(createdNotification.status).toEqual(NotificationStatus.CREATED);
      expect(createdNotification.recipient.user_id).toEqual(testUserId);
      expect(createdNotification.recipient.device_ids).toContain(testDeviceId);

      // 2. Update notification status
      const updatedNotification = await notificationService.updateStatus(
        createdNotification._id,
        NotificationStatus.DELIVERED,
      );

      expect(updatedNotification).toBeDefined();
      expect(updatedNotification.status).toEqual(NotificationStatus.DELIVERED);

      // 3. Retrieve notification
      const retrievedNotification = await notificationService.findById(createdNotification._id);
      
      expect(retrievedNotification).toBeDefined();
      expect(retrievedNotification.status).toEqual(NotificationStatus.DELIVERED);

      // 4. Get user notifications
      const userNotifications = await notificationService.findByUserId(testUserId, { limit: 10, offset: 0 });
      
      expect(userNotifications).toBeDefined();
      expect(userNotifications.length).toBeGreaterThan(0);
      expect(userNotifications[0]._id.toString()).toEqual(createdNotification._id.toString());
    });

    it('should handle duplicate idempotency keys', async () => {
      // Create a notification
      const idempotencyKey = `test-idempotency-${Date.now()}`;
      
      const notificationData = {
        recipient: {
          user_id: testUserId,
          device_ids: [testDeviceId],
        },
        priority: 'normal',
        notification: {
          title: 'First Notification',
          body: 'This should be created',
        },
        data: {},
        source: 'integration-test',
        idempotency_key: idempotencyKey,
      };

      const firstNotification = await notificationService.create(notificationData);
      expect(firstNotification).toBeDefined();
      
      // Try to create a second notification with the same idempotency key
      const duplicateData = {
        ...notificationData,
        notification: {
          title: 'Second Notification',
          body: 'This should NOT create a new record',
        },
      };

      const secondNotification = await notificationService.create(duplicateData);
      
      // Should return the first notification without creating a new one
      expect(secondNotification._id.toString()).toEqual(firstNotification._id.toString());
      
      // Total count should still be 1
      const count = await notificationModel.countDocuments();
      expect(count).toEqual(1);
    });

    it('should handle batch notifications', async () => {
      // Create 10 notifications for the same user but with different idempotency keys
      const notifications = [];
      
      for (let i = 0; i < 10; i++) {
        const notificationData = {
          recipient: {
            user_id: testUserId,
            device_ids: [testDeviceId],
          },
          priority: i < 5 ? 'high' : 'normal',
          notification: {
            title: `Notification ${i}`,
            body: `Body for notification ${i}`,
          },
          data: { index: i },
          source: 'integration-test',
          idempotency_key: `batch-test-${Date.now()}-${i}`,
        };
        
        notifications.push(await notificationService.create(notificationData));
      }
      
      // Get paginated results with various page sizes
      const firstPage = await notificationService.findByUserId(testUserId, { limit: 5, offset: 0 });
      expect(firstPage.length).toEqual(5);
      
      const secondPage = await notificationService.findByUserId(testUserId, { limit: 5, offset: 5 });
      expect(secondPage.length).toEqual(5);
      
      // Ensure no overlap between pages
      const firstPageIds = firstPage.map(n => n._id.toString());
      const secondPageIds = secondPage.map(n => n._id.toString());
      const overlap = firstPageIds.filter(id => secondPageIds.includes(id));
      
      expect(overlap.length).toEqual(0);
    });
  });
}); 