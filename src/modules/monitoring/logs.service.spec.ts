import { Test, TestingModule } from '@nestjs/testing';
import { LogsService } from './logs.service';
import * as winston from 'winston';

// Mock winston
jest.mock('winston', () => {
  const mockFormat = {
    timestamp: jest.fn().mockReturnValue('timestamp-format'),
    json: jest.fn().mockReturnValue('json-format'),
    combine: jest.fn().mockReturnValue('combined-format'),
  };

  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };

  return {
    createLogger: jest.fn().mockReturnValue(mockLogger),
    format: mockFormat,
    transports: {
      Console: jest.fn(),
    },
    mockLogger,
  };
});

describe('LogsService', () => {
  let service: LogsService;
  let mockWinstonLogger: any;

  beforeEach(async () => {
    // Reset environment variables
    process.env.LOG_LEVEL = 'info';

    const module: TestingModule = await Test.createTestingModule({
      providers: [LogsService],
    }).compile();

    service = module.get<LogsService>(LogsService);
    mockWinstonLogger = (winston as any).mockLogger;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('should log info message with context', () => {
      // Arrange
      const message = 'Test info message';
      const context = 'TestContext';

      // Act
      service.log(message, context);

      // Assert
      expect(mockWinstonLogger.info).toHaveBeenCalledWith(message, { context });
    });
  });

  describe('error', () => {
    it('should log error message with trace and context', () => {
      // Arrange
      const message = 'Test error message';
      const trace = 'Error stack trace';
      const context = 'TestContext';

      // Act
      service.error(message, trace, context);

      // Assert
      expect(mockWinstonLogger.error).toHaveBeenCalledWith(message, { trace, context });
    });
  });

  describe('warn', () => {
    it('should log warning message with context', () => {
      // Arrange
      const message = 'Test warning message';
      const context = 'TestContext';

      // Act
      service.warn(message, context);

      // Assert
      expect(mockWinstonLogger.warn).toHaveBeenCalledWith(message, { context });
    });
  });

  describe('debug', () => {
    it('should log debug message with context', () => {
      // Arrange
      const message = 'Test debug message';
      const context = 'TestContext';

      // Act
      service.debug(message, context);

      // Assert
      expect(mockWinstonLogger.debug).toHaveBeenCalledWith(message, { context });
    });
  });

  describe('verbose', () => {
    it('should log verbose message with context', () => {
      // Arrange
      const message = 'Test verbose message';
      const context = 'TestContext';

      // Act
      service.verbose(message, context);

      // Assert
      expect(mockWinstonLogger.verbose).toHaveBeenCalledWith(message, { context });
    });
  });

  describe('logRequest', () => {
    it('should log API request details', () => {
      // Arrange
      const req = {
        method: 'GET',
        url: '/api/notifications',
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };
      const res = {
        statusCode: 200,
      };
      const duration = 42;

      // Act
      service.logRequest(req, res, duration);

      // Assert
      expect(mockWinstonLogger.info).toHaveBeenCalledWith('API Request', {
        method: 'GET',
        url: '/api/notifications',
        statusCode: 200,
        duration: '42ms',
        userAgent: 'Mozilla/5.0',
        ip: '127.0.0.1',
      });
    });

    it('should handle missing user agent', () => {
      // Arrange
      const req = {
        method: 'POST',
        url: '/api/notifications',
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue(''),
      };
      const res = {
        statusCode: 201,
      };
      const duration = 100;

      // Act
      service.logRequest(req, res, duration);

      // Assert
      expect(mockWinstonLogger.info).toHaveBeenCalledWith('API Request', {
        method: 'POST',
        url: '/api/notifications',
        statusCode: 201,
        duration: '100ms',
        userAgent: '',
        ip: '127.0.0.1',
      });
    });
  });

  describe('logNotificationEvent', () => {
    it('should log notification events with data', () => {
      // Arrange
      const eventType = 'NOTIFICATION_CREATED';
      const notificationId = 'notif-123';
      const data = {
        userId: 'user-456',
        priority: 'high',
      };

      // Act
      service.logNotificationEvent(eventType, notificationId, data);

      // Assert
      expect(mockWinstonLogger.info).toHaveBeenCalledWith('Notification Event', {
        eventType: 'NOTIFICATION_CREATED',
        notificationId: 'notif-123',
        userId: 'user-456',
        priority: 'high',
      });
    });

    it('should log notification events without data', () => {
      // Arrange
      const eventType = 'NOTIFICATION_DELIVERED';
      const notificationId = 'notif-123';

      // Act
      service.logNotificationEvent(eventType, notificationId);

      // Assert
      expect(mockWinstonLogger.info).toHaveBeenCalledWith('Notification Event', {
        eventType: 'NOTIFICATION_DELIVERED',
        notificationId: 'notif-123',
      });
    });
  });

  describe('logDeviceEvent', () => {
    it('should log device events with data', () => {
      // Arrange
      const eventType = 'DEVICE_REGISTERED';
      const deviceId = 'device-123';
      const userId = 'user-456';
      const data = {
        platform: 'iOS',
        model: 'iPhone 13',
      };

      // Act
      service.logDeviceEvent(eventType, deviceId, userId, data);

      // Assert
      expect(mockWinstonLogger.info).toHaveBeenCalledWith('Device Event', {
        eventType: 'DEVICE_REGISTERED',
        deviceId: 'device-123',
        userId: 'user-456',
        platform: 'iOS',
        model: 'iPhone 13',
      });
    });

    it('should log device events without data', () => {
      // Arrange
      const eventType = 'DEVICE_UPDATED';
      const deviceId = 'device-123';
      const userId = 'user-456';

      // Act
      service.logDeviceEvent(eventType, deviceId, userId);

      // Assert
      expect(mockWinstonLogger.info).toHaveBeenCalledWith('Device Event', {
        eventType: 'DEVICE_UPDATED',
        deviceId: 'device-123',
        userId: 'user-456',
      });
    });
  });

  describe('winston configuration', () => {
    it('should create logger with correct configuration', () => {
      // Assert
      expect(winston.createLogger).toHaveBeenCalledWith({
        level: 'info',
        format: 'combined-format',
        defaultMeta: { service: 'notification-service' },
        transports: [expect.any(winston.transports.Console)],
      });

      expect(winston.format.combine).toHaveBeenCalledWith(
        'timestamp-format',
        'json-format'
      );
    });

    it('should use environment variable for log level if available', () => {
      // Arrange
      process.env.LOG_LEVEL = 'debug';

      // Act
      new LogsService();

      // Assert
      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'debug',
        })
      );
    });
  });
});
