import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { NotificationService } from './notification.service';
import { DeviceService } from '../device/device.service';
import { Notification } from './schemas/notification.schema';
import { DeliveryAttempt } from './schemas/delivery-attempt.schema';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationPriority, NotificationStatus } from '../../shared/interfaces/notification.interface';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('NotificationService', () => {
  let service: NotificationService;
  let notificationModel: Model<Notification>;
  let deliveryAttemptModel: Model<DeliveryAttempt>;
  let deviceService: DeviceService;
  let notificationsQueue: Queue;
  let configService: ConfigService;

  const mockNotification = {
    _id: 'notification-id-123',
    recipient: {
      user_id: 'user123',
      device_ids: ['device456'],
    },
    priority: NotificationPriority.HIGH,
    notification: {
      title: 'Test Notification',
      body: 'This is a test notification',
    },
    source: 'test-service',
    idempotency_key: 'test-key-123',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    created_at: new Date(),
    save: jest.fn().mockResolvedValue(this),
    toObject: jest.fn().mockReturnValue(this),
    toString: jest.fn().mockReturnValue('notification-id-123'),
  };

  const mockDeliveryAttempt = {
    _id: 'attempt-id-123',
    notification_id: 'notification-id-123',
    device_id: 'device456',
    status: 'success',
    attempted_at: new Date(),
    platform_response: { message_id: 'fcm-123' },
    save: jest.fn().mockResolvedValue(this),
  };

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getModelToken('Notification'),
          useValue: {
            new: jest.fn().mockResolvedValue(mockNotification),
            constructor: jest.fn().mockResolvedValue(mockNotification),
            find: jest.fn(),
            findOne: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            exec: jest.fn(),
          },
        },
        {
          provide: getModelToken('DeliveryAttempt'),
          useValue: {
            new: jest.fn().mockResolvedValue(mockDeliveryAttempt),
            constructor: jest.fn().mockResolvedValue(mockDeliveryAttempt),
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            exec: jest.fn(),
          },
        },
        {
          provide: DeviceService,
          useValue: {
            findById: jest.fn(),
            findByUserId: jest.fn(),
            findByIds: jest.fn(),
          },
        },
        {
          provide: 'BullQueue_notifications',
          useValue: {
            add: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'NOTIFICATION_DEFAULT_TTL') {
                return 86400; // 24 hours in seconds
              }
              return null;
            }),
          },
        },
        {
          provide: 'LOGGER',
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    notificationModel = module.get<Model<Notification>>(getModelToken('Notification'));
    deliveryAttemptModel = module.get<Model<DeliveryAttempt>>(getModelToken('DeliveryAttempt'));
    deviceService = module.get<DeviceService>(DeviceService);
    notificationsQueue = module.get<Queue>('BullQueue_notifications');
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new notification successfully', async () => {
      // Arrange
      const createNotificationDto: CreateNotificationDto = {
        recipient: {
          user_id: 'user123',
          device_ids: ['device456'],
        },
        priority: NotificationPriority.HIGH,
        notification: {
          title: 'Test Notification',
          body: 'This is a test notification',
        },
        source: 'test-service',
        idempotency_key: 'test-key-123',
      };

      jest.spyOn(notificationModel, 'findOne').mockResolvedValue(null);
      jest.spyOn(notificationModel, 'create').mockImplementation(() => {
        return Promise.resolve(mockNotification as any);
      });

      // Mock the queueNotification method
      jest.spyOn(service as any, 'queueNotification').mockResolvedValue(undefined);

      // Act
      const result = await service.create(createNotificationDto);

      // Assert
      expect(notificationModel.findOne).toHaveBeenCalledWith({
        idempotency_key: 'test-key-123',
      });
      expect(notificationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...createNotificationDto,
          expires_at: expect.any(Date),
        }),
      );
      expect(service['queueNotification']).toHaveBeenCalledWith(mockNotification);
      expect(result).toEqual({
        notification_id: 'notification-id-123',
        status: 'accepted',
      });
    });

    it('should return existing notification when idempotency key already exists', async () => {
      // Arrange
      const createNotificationDto: CreateNotificationDto = {
        recipient: {
          user_id: 'user123',
          device_ids: ['device456'],
        },
        priority: NotificationPriority.HIGH,
        notification: {
          title: 'Test Notification',
          body: 'This is a test notification',
        },
        source: 'test-service',
        idempotency_key: 'test-key-123',
      };

      jest.spyOn(notificationModel, 'findOne').mockResolvedValue(mockNotification as any);

      // Act
      const result = await service.create(createNotificationDto);

      // Assert
      expect(notificationModel.findOne).toHaveBeenCalledWith({
        idempotency_key: 'test-key-123',
      });
      expect(notificationModel.create).not.toHaveBeenCalled();
      expect(result).toEqual({
        notification_id: 'notification-id-123',
        status: 'accepted',
      });
    });

    it('should use custom TTL when provided', async () => {
      // Arrange
      const customTtl = 3600; // 1 hour in seconds
      const createNotificationDto: CreateNotificationDto = {
        recipient: {
          user_id: 'user123',
          device_ids: ['device456'],
        },
        priority: NotificationPriority.HIGH,
        notification: {
          title: 'Test Notification',
          body: 'This is a test notification',
        },
        source: 'test-service',
        idempotency_key: 'test-key-123',
        ttl: customTtl,
      };

      jest.spyOn(notificationModel, 'findOne').mockResolvedValue(null);
      jest.spyOn(notificationModel, 'create').mockImplementation(() => {
        return Promise.resolve(mockNotification as any);
      });

      // Mock the queueNotification method
      jest.spyOn(service as any, 'queueNotification').mockResolvedValue(undefined);

      // Act
      await service.create(createNotificationDto);

      // Assert
      expect(notificationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ttl: customTtl,
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return a notification by ID', async () => {
      // Arrange
      const notificationId = 'notification-id-123';
      jest.spyOn(notificationModel, 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockNotification),
      } as any);

      // Act
      const result = await service.findById(notificationId);

      // Assert
      expect(notificationModel.findById).toHaveBeenCalledWith(notificationId);
      expect(result).toEqual(mockNotification);
    });

    it('should throw NotFoundException when notification not found', async () => {
      // Arrange
      const notificationId = 'non-existent-id';
      jest.spyOn(notificationModel, 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as any);

      // Act & Assert
      await expect(service.findById(notificationId)).rejects.toThrow(NotFoundException);
      expect(notificationModel.findById).toHaveBeenCalledWith(notificationId);
    });
  });

  describe('findByUserId', () => {
    it('should return notifications for a user', async () => {
      // Arrange
      const userId = 'user123';
      const mockNotifications = [mockNotification, { ...mockNotification, _id: 'notification-id-456' }];

      jest.spyOn(notificationModel, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockNotifications),
      } as any);

      // Act
      const result = await service.findByUserId(userId);

      // Assert
      expect(notificationModel.find).toHaveBeenCalledWith({
        'recipient.user_id': userId,
      });
      expect(result).toEqual(mockNotifications);
    });
  });

  describe('recordDeliveryAttempt', () => {
    it('should record a successful delivery attempt', async () => {
      // Arrange
      const notificationId = 'notification-id-123';
      const deviceId = 'device456';
      const status = NotificationStatus.DELIVERED;
      const platformResponse = { message_id: 'fcm-123' };

      // Mock findOne for getting the last attempt
      jest.spyOn(deliveryAttemptModel, 'findOne').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null), // No previous attempts
      } as any);

      // Mock the new DeliveryAttempt constructor and save method
      jest.spyOn(deliveryAttemptModel, 'new').mockImplementation(() => mockDeliveryAttempt);

      // Act
      const result = await service.recordDeliveryAttempt(
        notificationId,
        deviceId,
        status,
        platformResponse,
      );

      // Assert
      expect(deliveryAttemptModel.findOne).toHaveBeenCalledWith({
        notification_id: notificationId,
        device_id: deviceId,
      });
      expect(mockDeliveryAttempt.save).toHaveBeenCalled();
      expect(result).toEqual(mockDeliveryAttempt);
    });

    it('should record a failed delivery attempt with error details', async () => {
      // Arrange
      const notificationId = 'notification-id-123';
      const deviceId = 'device456';
      const status = NotificationStatus.FAILED;
      const errorCode = 'FCM_ERROR';
      const errorMessage = 'Failed to deliver notification';

      const mockFailedAttempt = {
        ...mockDeliveryAttempt,
        status: NotificationStatus.FAILED,
        error_code: errorCode,
        error_message: errorMessage,
        save: jest.fn().mockResolvedValue({
          ...mockDeliveryAttempt,
          status: NotificationStatus.FAILED,
          error_code: errorCode,
          error_message: errorMessage,
        }),
      };

      // Mock findOne for getting the last attempt
      jest.spyOn(deliveryAttemptModel, 'findOne').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ attempt_number: 1 }), // Previous attempt exists
      } as any);

      // Mock the new DeliveryAttempt constructor
      jest.spyOn(deliveryAttemptModel, 'new').mockImplementation(() => mockFailedAttempt);

      // Act
      const result = await service.recordDeliveryAttempt(
        notificationId,
        deviceId,
        status,
        null,
        errorCode,
        errorMessage,
      );

      // Assert
      expect(deliveryAttemptModel.findOne).toHaveBeenCalledWith({
        notification_id: notificationId,
        device_id: deviceId,
      });
      expect(mockFailedAttempt.save).toHaveBeenCalled();
      expect(result).toEqual({
        ...mockDeliveryAttempt,
        status: NotificationStatus.FAILED,
        error_code: errorCode,
        error_message: errorMessage,
      });
    });
  });

  // Additional tests for other methods would follow the same pattern
});
