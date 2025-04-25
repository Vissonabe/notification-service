import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Model, Connection } from 'mongoose';
import { BullModule } from '@nestjs/bull';
import { NotificationService } from '../../src/modules/notification/notification.service';
import { DeviceService } from '../../src/modules/device/device.service';
import { RetryService } from '../../src/modules/retry/retry.service';
import { Notification, NotificationSchema } from '../../src/modules/notification/schemas/notification.schema';
import { DeliveryAttempt, DeliveryAttemptSchema } from '../../src/modules/notification/schemas/delivery-attempt.schema';
import { Device, DeviceSchema } from '../../src/modules/device/schemas/device.schema';
import { NotificationPriority } from '../../src/shared/interfaces/notification.interface';
import { DevicePlatform } from '../../src/shared/interfaces/device.interface';
import { startMongoMemoryServer, stopMongoMemoryServer } from '../test-helpers/test-base';
import { getConnectionToken } from '@nestjs/mongoose';

describe('Notification Flow (Integration)', () => {
  let notificationService: NotificationService;
  let deviceService: DeviceService;
  let retryService: RetryService;
  let notificationModel: Model<Notification>;
  let deliveryAttemptModel: Model<DeliveryAttempt>;
  let deviceModel: Model<Device>;
  let connection: Connection;
  let module: TestingModule;
  
  // Test data
  const testUserId = 'test-integration-user';
  let testDeviceId: string;
  let testNotificationId: string;

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
          useFactory: async () => ({
            uri: process.env.MONGODB_URI,
          }),
          inject: [ConfigService],
        }),
        MongooseModule.forFeature([
          { name: Notification.name, schema: NotificationSchema },
          { name: DeliveryAttempt.name, schema: DeliveryAttemptSchema },
          { name: Device.name, schema: DeviceSchema },
        ]),
        BullModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: async () => ({
            redis: {
              host: 'localhost',
              port: 6379,
            },
          }),
          inject: [ConfigService],
        }),
        BullModule.registerQueue({
          name: 'notifications',
        }),
      ],
      providers: [
        NotificationService,
        DeviceService,
        RetryService,
        {
          provide: 'LOGGER',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    // Get services and models
    notificationService = module.get<NotificationService>(NotificationService);
    deviceService = module.get<DeviceService>(DeviceService);
    retryService = module.get<RetryService>(RetryService);
    notificationModel = module.get<Model<Notification>>(getModelToken(Notification.name));
    deliveryAttemptModel = module.get<Model<DeliveryAttempt>>(getModelToken(DeliveryAttempt.name));
    deviceModel = module.get<Model<Device>>(getModelToken(Device.name));
    connection = module.get<Connection>(getConnectionToken());

    // Setup test data - create a test device
    const deviceData = {
      user_id: testUserId,
      device_token: 'fcm-token-integration-test',
      platform: DevicePlatform.ANDROID,
      app_version: '1.0.0',
      device_model: 'Integration Test Device',
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
    await module.close();
    await stopMongoMemoryServer();
  });

  beforeEach(async () => {
    // Clear notifications and delivery attempts before each test
    await notificationModel.deleteMany({});
    await deliveryAttemptModel.deleteMany({});
  });

  describe('End-to-end notification flow', () => {
    it('should create, process, and track a notification', async () => {
      // 1. Create a notification
      const notificationData = {
        recipient: {
          user_id: testUserId,
          device_ids: [testDeviceId],
        },
        priority: NotificationPriority.HIGH,
        notification: {
          title: 'Integration Test',
          body: 'This is an integration test notification',
        },
        data: {
          test_key: 'test_value',
        },
        source: 'integration-test',
        idempotency_key: `integration-test-${Date.now()}`,
      };

      const createResult = await notificationService.create(notificationData);
      testNotificationId = createResult.notification_id;

      // Verify notification was created
      const notification = await notificationService.findById(testNotificationId);
      expect(notification).toBeDefined();
      expect(notification.recipient.user_id).toBe(testUserId);
      expect(notification.priority).toBe(NotificationPriority.HIGH);
      expect(notification.notification.title).toBe('Integration Test');

      // 2. Record a delivery attempt
      const deliveryAttempt = await notificationService.recordDeliveryAttempt(
        testNotificationId,
        testDeviceId,
        'success',
        { message_id: 'fcm-integration-test' },
      );

      expect(deliveryAttempt).toBeDefined();
      expect(deliveryAttempt.notification_id).toBe(testNotificationId);
      expect(deliveryAttempt.device_id).toBe(testDeviceId);
      expect(deliveryAttempt.status).toBe('success');

      // 3. Get notification status
      const status = await notificationService.getDeliveryStatus(testNotificationId);
      expect(status).toBeDefined();
      expect(status.notification_id).toBe(testNotificationId);
      expect(status.delivery_attempts).toHaveLength(1);
      expect(status.delivery_attempts[0].status).toBe('success');
    });

    it('should handle failed delivery and retry scheduling', async () => {
      // 1. Create a notification
      const notificationData = {
        recipient: {
          user_id: testUserId,
          device_ids: [testDeviceId],
        },
        priority: NotificationPriority.MEDIUM,
        notification: {
          title: 'Retry Test',
          body: 'This is a test for retry mechanism',
        },
        source: 'integration-test',
        idempotency_key: `retry-test-${Date.now()}`,
      };

      const createResult = await notificationService.create(notificationData);
      testNotificationId = createResult.notification_id;

      // 2. Record a failed delivery attempt
      const deliveryAttempt = await notificationService.recordDeliveryAttempt(
        testNotificationId,
        testDeviceId,
        'failed',
        null,
        'FCM_ERROR',
        'Device token is invalid',
      );

      expect(deliveryAttempt).toBeDefined();
      expect(deliveryAttempt.status).toBe('failed');
      expect(deliveryAttempt.error_code).toBe('FCM_ERROR');

      // 3. Check if retry is needed
      const notification = await notificationService.findById(testNotificationId);
      const shouldRetry = retryService.shouldRetry(
        notification.priority as NotificationPriority,
        1, // First attempt
      );

      expect(shouldRetry).toBe(true);

      // 4. Schedule a retry
      await retryService.scheduleRetry(
        testNotificationId,
        notification.priority as NotificationPriority,
        1, // First attempt
      );

      // 5. Get notification status
      const status = await notificationService.getDeliveryStatus(testNotificationId);
      expect(status).toBeDefined();
      expect(status.notification_id).toBe(testNotificationId);
      expect(status.delivery_attempts).toHaveLength(1);
      expect(status.delivery_attempts[0].status).toBe('failed');
    });

    it('should handle idempotency for duplicate notifications', async () => {
      // 1. Create a notification with a specific idempotency key
      const idempotencyKey = `idempotency-test-${Date.now()}`;
      const notificationData = {
        recipient: {
          user_id: testUserId,
          device_ids: [testDeviceId],
        },
        priority: NotificationPriority.LOW,
        notification: {
          title: 'Idempotency Test',
          body: 'This is a test for idempotency',
        },
        source: 'integration-test',
        idempotency_key: idempotencyKey,
      };

      // First creation
      const firstResult = await notificationService.create(notificationData);
      const firstNotificationId = firstResult.notification_id;

      // Second creation with same idempotency key
      const secondResult = await notificationService.create(notificationData);
      const secondNotificationId = secondResult.notification_id;

      // Verify both operations returned the same notification ID
      expect(secondNotificationId).toBe(firstNotificationId);

      // Verify only one notification was created
      const notifications = await notificationModel.find({
        idempotency_key: idempotencyKey,
      }).exec();
      
      expect(notifications).toHaveLength(1);
    });
  });

  describe('Device and notification interaction', () => {
    it('should find devices for a notification', async () => {
      // 1. Create multiple devices for the same user
      const secondDeviceData = {
        user_id: testUserId,
        device_token: 'fcm-token-second-device',
        platform: DevicePlatform.ANDROID,
        app_version: '2.0.0',
        device_model: 'Second Test Device',
        os_version: 'Android 14',
        language: 'en-US',
        timezone: 'America/New_York',
      };
      
      const secondDevice = await deviceService.registerDevice(secondDeviceData);
      
      // 2. Create a notification targeting the user (not specific devices)
      const notificationData = {
        recipient: {
          user_id: testUserId,
          // No device_ids specified - should target all user devices
        },
        priority: NotificationPriority.HIGH,
        notification: {
          title: 'Multi-device Test',
          body: 'This should go to all user devices',
        },
        source: 'integration-test',
        idempotency_key: `multi-device-test-${Date.now()}`,
      };

      const createResult = await notificationService.create(notificationData);
      
      // 3. Find all devices for the user
      const userDevices = await deviceService.findByUserId(testUserId);
      
      // Verify both devices are found
      expect(userDevices).toHaveLength(2);
      expect(userDevices.map(d => d._id.toString())).toContain(testDeviceId);
      expect(userDevices.map(d => d._id.toString())).toContain(secondDevice._id.toString());
    });
  });
});
