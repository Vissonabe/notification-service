import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { NotificationService } from '../../../src/modules/notification/notification.service';
import { DeviceService } from '../../../src/modules/device/device.service';
import { createNotificationMock, createDeviceMock, mockLogger } from '../../test-helpers/test-base';
import { MockKafkaService } from '../../test-helpers/mock-kafka.service';
import { InternalServerErrorException, NotFoundException } from '@nestjs/common';

describe('NotificationService', () => {
  let service: NotificationService;
  let deviceService: DeviceService;
  let kafkaService: MockKafkaService;
  let notificationModel: Model<any>;
  let configService: ConfigService;

  // Mock data
  const mockNotification = createNotificationMock();
  const mockDevice = createDeviceMock();

  // Mock notification model
  const notificationModelMock = {
    findById: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    updateOne: jest.fn(),
    countDocuments: jest.fn(),
  };

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getModelToken('Notification'),
          useValue: notificationModelMock,
        },
        {
          provide: DeviceService,
          useValue: {
            findById: jest.fn(),
            findByUserId: jest.fn(),
            validateDeviceExists: jest.fn(),
          },
        },
        {
          provide: 'KafkaService',
          useClass: MockKafkaService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'notifications.defaultTtl':
                  return 86400;
                case 'notifications.retryConfig':
                  return {
                    initialInterval: 1000,
                    maxRetries: 3,
                    multiplier: 2,
                  };
                default:
                  return null;
              }
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
    deviceService = module.get<DeviceService>(DeviceService);
    kafkaService = module.get<MockKafkaService>('KafkaService');
    notificationModel = module.get<Model<any>>(getModelToken('Notification'));
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    beforeEach(() => {
      jest.spyOn(deviceService, 'validateDeviceExists').mockResolvedValue(true);
      jest.spyOn(notificationModel, 'create').mockResolvedValue(mockNotification);
      jest.spyOn(kafkaService, 'produce').mockResolvedValue(undefined);
    });

    it('should create a notification successfully', async () => {
      const createDto = {
        recipient: {
          user_id: 'user123',
          device_ids: ['device-456'],
        },
        priority: 'high',
        notification: {
          title: 'Test Notification',
          body: 'This is a test notification.',
        },
        data: {
          test_id: '12345',
        },
        source: 'test-service',
        idempotency_key: 'test-notification-12345',
      };

      const result = await service.create(createDto);

      expect(notificationModel.create).toHaveBeenCalledWith(expect.objectContaining({
        recipient: createDto.recipient,
        priority: createDto.priority,
        notification: createDto.notification,
        data: createDto.data,
        source: createDto.source,
        idempotency_key: createDto.idempotency_key,
        status: 'created',
      }));
      expect(kafkaService.produce).toHaveBeenCalledWith(
        'notification.created',
        expect.any(Object),
      );
      expect(result).toEqual(mockNotification);
    });

    it('should throw an error when device validation fails', async () => {
      jest.spyOn(deviceService, 'validateDeviceExists').mockResolvedValue(false);

      const createDto = {
        recipient: {
          user_id: 'user123',
          device_ids: ['invalid-device'],
        },
        priority: 'high',
        notification: {
          title: 'Test Notification',
          body: 'This is a test notification.',
        },
        data: {},
        source: 'test-service',
        idempotency_key: 'test-notification-12345',
      };

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
      expect(notificationModel.create).not.toHaveBeenCalled();
      expect(kafkaService.produce).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      jest.spyOn(notificationModel, 'create').mockRejectedValue(new Error('Database error'));

      const createDto = {
        recipient: {
          user_id: 'user123',
          device_ids: ['device-456'],
        },
        priority: 'high',
        notification: {
          title: 'Test Notification',
          body: 'This is a test notification.',
        },
        data: {},
        source: 'test-service',
        idempotency_key: 'test-notification-12345',
      };

      await expect(service.create(createDto)).rejects.toThrow(InternalServerErrorException);
      expect(kafkaService.produce).not.toHaveBeenCalled();
    });

    it('should check for duplicate idempotency keys', async () => {
      jest.spyOn(notificationModel, 'findOne').mockResolvedValue(mockNotification);

      const createDto = {
        recipient: {
          user_id: 'user123',
          device_ids: ['device-456'],
        },
        priority: 'high',
        notification: {
          title: 'Test Notification',
          body: 'This is a test notification.',
        },
        data: {},
        source: 'test-service',
        idempotency_key: 'test-notification-12345',
      };

      const result = await service.create(createDto);

      expect(notificationModel.findOne).toHaveBeenCalledWith({
        idempotency_key: 'test-notification-12345',
      });
      expect(notificationModel.create).not.toHaveBeenCalled();
      expect(result).toEqual(mockNotification);
    });
  });

  describe('findById', () => {
    it('should return a notification by id', async () => {
      jest.spyOn(notificationModel, 'findById').mockResolvedValue(mockNotification);

      const result = await service.findById('notif-123');

      expect(notificationModel.findById).toHaveBeenCalledWith('notif-123');
      expect(result).toEqual(mockNotification);
    });

    it('should throw NotFoundException if notification not found', async () => {
      jest.spyOn(notificationModel, 'findById').mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should update the notification status', async () => {
      jest.spyOn(notificationModel, 'findByIdAndUpdate').mockResolvedValue({
        ...mockNotification,
        status: 'delivered',
      });

      const result = await service.updateStatus('notif-123', 'delivered');

      expect(notificationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'notif-123',
        { status: 'delivered', updated_at: expect.any(Date) },
        { new: true },
      );
      expect(result.status).toEqual('delivered');
    });

    it('should throw NotFoundException if notification not found', async () => {
      jest.spyOn(notificationModel, 'findByIdAndUpdate').mockResolvedValue(null);

      await expect(service.updateStatus('non-existent', 'delivered')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByUserId', () => {
    it('should return notifications for a user', async () => {
      jest.spyOn(notificationModel, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            skip: jest.fn().mockResolvedValue([mockNotification]),
          }),
        }),
      } as any);

      const result = await service.findByUserId('user123', { limit: 10, offset: 0 });

      expect(notificationModel.find).toHaveBeenCalledWith({
        'recipient.user_id': 'user123',
      });
      expect(result).toEqual([mockNotification]);
    });

    it('should apply pagination correctly', async () => {
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockResolvedValue([mockNotification]),
      };
      
      jest.spyOn(notificationModel, 'find').mockReturnValue(mockFind as any);
      jest.spyOn(notificationModel, 'countDocuments').mockResolvedValue(1);

      const result = await service.findByUserId('user123', { limit: 10, offset: 20 });

      expect(mockFind.sort).toHaveBeenCalledWith({ created_at: -1 });
      expect(mockFind.limit).toHaveBeenCalledWith(10);
      expect(mockFind.skip).toHaveBeenCalledWith(20);
      expect(result).toEqual([mockNotification]);
    });
  });
}); 