import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Job } from 'bull';
import { NotificationProcessor } from './notification.processor';
import { NotificationService } from './notification.service';
import { DeviceService } from '../device/device.service';
import { Notification } from './schemas/notification.schema';

describe('NotificationProcessor', () => {
  let processor: NotificationProcessor;
  let notificationService: NotificationService;
  let deviceService: DeviceService;
  let notificationModel: Model<Notification>;

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationProcessor,
        {
          provide: getModelToken('Notification'),
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            findById: jest.fn(),
            recordDeliveryAttempt: jest.fn(),
          },
        },
        {
          provide: DeviceService,
          useValue: {
            findByIds: jest.fn(),
            findByUserId: jest.fn(),
            updateLastSeen: jest.fn(),
          },
        },
      ],
    }).compile();

    processor = module.get<NotificationProcessor>(NotificationProcessor);
    notificationService = module.get<NotificationService>(NotificationService);
    deviceService = module.get<DeviceService>(DeviceService);
    notificationModel = module.get<Model<Notification>>(getModelToken('Notification'));

    // We can't mock the logger directly as it's a readonly property
    // We'll just test the processor functionality
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('isInQuietHours', () => {
    it('should return false when quiet hours are not enabled', () => {
      // Arrange
      const device = {
        timezone: 'America/New_York',
        notification_preferences: {
          quiet_hours: {
            enabled: false
          }
        }
      };

      // Act
      const result = processor['isInQuietHours'](device);

      // Assert
      expect(result).toBe(false);
    });
  })
});
