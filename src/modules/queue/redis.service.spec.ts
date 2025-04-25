import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

describe('RedisService', () => {
  let service: RedisService;
  let configService: ConfigService;

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  const mockRedisClient = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue('value'),
    del: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'REDIS_HOST':
                  return 'localhost';
                case 'REDIS_PORT':
                  return 6379;
                case 'REDIS_PASSWORD':
                  return '';
                case 'REDIS_DB':
                  return 0;
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

    service = module.get<RedisService>(RedisService);
    configService = module.get<ConfigService>(ConfigService);

    jest.spyOn(service as any, 'createClient').mockReturnValue(mockRedisClient);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize Redis client', async () => {
      // Act
      await service.onModuleInit();

      // Assert
      expect(service['createClient']).toHaveBeenCalled();
      expect(mockRedisClient.connect).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith('Redis service initialized');
    });

    it('should handle initialization errors', async () => {
      // Arrange
      const error = new Error('Connection error');
      jest.spyOn(service as any, 'createClient').mockImplementation(() => {
        throw error;
      });

      // Act & Assert
      await expect(service.onModuleInit()).rejects.toThrow('Connection error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize Redis service', error);
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect Redis client', async () => {
      // Arrange
      await service.onModuleInit(); // Initialize first

      // Act
      await service.onModuleDestroy();

      // Assert
      expect(mockRedisClient.disconnect).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith('Redis service disconnected');
    });
  });

  describe('set', () => {
    it('should set a key-value pair', async () => {
      // Arrange
      await service.onModuleInit(); // Initialize first
      const key = 'test-key';
      const value = 'test-value';
      const ttl = 60;

      // Act
      await service.set(key, value, ttl);

      // Assert
      expect(mockRedisClient.set).toHaveBeenCalledWith(key, value);
      expect(mockRedisClient.expire).toHaveBeenCalledWith(key, ttl);
    });

    it('should not set TTL when not provided', async () => {
      // Arrange
      await service.onModuleInit(); // Initialize first
      const key = 'test-key';
      const value = 'test-value';

      // Act
      await service.set(key, value);

      // Assert
      expect(mockRedisClient.set).toHaveBeenCalledWith(key, value);
      expect(mockRedisClient.expire).not.toHaveBeenCalled();
    });

    it('should handle set errors', async () => {
      // Arrange
      await service.onModuleInit(); // Initialize first
      const key = 'test-key';
      const value = 'test-value';
      const error = new Error('Set error');
      mockRedisClient.set.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(service.set(key, value)).rejects.toThrow('Set error');
      expect(mockLogger.error).toHaveBeenCalledWith(`Failed to set Redis key: ${key}`, error);
    });
  });

  describe('get', () => {
    it('should get a value by key', async () => {
      // Arrange
      await service.onModuleInit(); // Initialize first
      const key = 'test-key';
      mockRedisClient.get.mockResolvedValueOnce('test-value');

      // Act
      const result = await service.get(key);

      // Assert
      expect(mockRedisClient.get).toHaveBeenCalledWith(key);
      expect(result).toBe('test-value');
    });

    it('should return null for non-existent key', async () => {
      // Arrange
      await service.onModuleInit(); // Initialize first
      const key = 'non-existent-key';
      mockRedisClient.get.mockResolvedValueOnce(null);

      // Act
      const result = await service.get(key);

      // Assert
      expect(mockRedisClient.get).toHaveBeenCalledWith(key);
      expect(result).toBeNull();
    });

    it('should handle get errors', async () => {
      // Arrange
      await service.onModuleInit(); // Initialize first
      const key = 'test-key';
      const error = new Error('Get error');
      mockRedisClient.get.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(service.get(key)).rejects.toThrow('Get error');
      expect(mockLogger.error).toHaveBeenCalledWith(`Failed to get Redis key: ${key}`, error);
    });
  });

  describe('delete', () => {
    it('should delete a key', async () => {
      // Arrange
      await service.onModuleInit(); // Initialize first
      const key = 'test-key';

      // Act
      await service.delete(key);

      // Assert
      expect(mockRedisClient.del).toHaveBeenCalledWith(key);
    });

    it('should handle delete errors', async () => {
      // Arrange
      await service.onModuleInit(); // Initialize first
      const key = 'test-key';
      const error = new Error('Delete error');
      mockRedisClient.del.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(service.delete(key)).rejects.toThrow('Delete error');
      expect(mockLogger.error).toHaveBeenCalledWith(`Failed to delete Redis key: ${key}`, error);
    });
  });

  describe('isRateLimited', () => {
    it('should allow request when under rate limit', async () => {
      // Arrange
      await service.onModuleInit(); // Initialize first
      const key = 'rate-limit:test';
      const limit = 10;
      const windowSec = 60;
      mockRedisClient.incr.mockResolvedValueOnce(5); // 5th request

      // Act
      const result = await service.isRateLimited(key, limit, windowSec);

      // Assert
      expect(mockRedisClient.incr).toHaveBeenCalledWith(key);
      expect(mockRedisClient.expire).toHaveBeenCalledWith(key, windowSec);
      expect(result).toBe(false); // Not rate limited
    });

    it('should block request when over rate limit', async () => {
      // Arrange
      await service.onModuleInit(); // Initialize first
      const key = 'rate-limit:test';
      const limit = 10;
      const windowSec = 60;
      mockRedisClient.incr.mockResolvedValueOnce(11); // 11th request

      // Act
      const result = await service.isRateLimited(key, limit, windowSec);

      // Assert
      expect(mockRedisClient.incr).toHaveBeenCalledWith(key);
      expect(result).toBe(true); // Is rate limited
    });

    it('should handle rate limit errors', async () => {
      // Arrange
      await service.onModuleInit(); // Initialize first
      const key = 'rate-limit:test';
      const limit = 10;
      const windowSec = 60;
      const error = new Error('Rate limit error');
      mockRedisClient.incr.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(service.isRateLimited(key, limit, windowSec)).rejects.toThrow('Rate limit error');
      expect(mockLogger.error).toHaveBeenCalledWith(`Failed to check rate limit for key: ${key}`, error);
    });
  });
});
