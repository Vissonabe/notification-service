import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../src/modules/queue/redis.service';
import { mockLogger } from '../../test-helpers/test-base';

describe('RedisService', () => {
  let service: RedisService;
  let configService: ConfigService;

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
                  return '6379';
                case 'REDIS_PASSWORD':
                  return '';
                case 'REDIS_DB':
                  return '0';
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
    
    // Mock Redis client to prevent actual connections
    const mockRedisClient = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      incr: jest.fn(),
      quit: jest.fn(),
    };
    
    jest.spyOn(service as any, 'createClient').mockReturnValue(mockRedisClient);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize Redis client', async () => {
      await service.onModuleInit();
      
      expect(service['createClient']).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith('Redis service initialized');
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Connection error');
      jest.spyOn(service as any, 'createClient').mockImplementation(() => {
        throw error;
      });
      
      await expect(service.onModuleInit()).rejects.toThrow('Connection error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize Redis service', error);
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect Redis client', async () => {
      // First initialize to create a client
      await service.onModuleInit();
      
      const mockQuit = jest.fn().mockResolvedValue('OK');
      service['client'].quit = mockQuit;
      
      await service.onModuleDestroy();
      
      expect(mockQuit).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith('Redis service shut down');
    });

    it('should handle shutdown errors', async () => {
      // First initialize to create a client
      await service.onModuleInit();
      
      const error = new Error('Disconnect error');
      service['client'].quit = jest.fn().mockRejectedValue(error);
      
      await expect(service.onModuleDestroy()).rejects.toThrow('Disconnect error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to shut down Redis service', error);
    });
  });

  describe('set', () => {
    it('should set a key with value', async () => {
      // First initialize to create a client
      await service.onModuleInit();
      
      const mockSet = jest.fn().mockResolvedValue('OK');
      service['client'].set = mockSet;
      
      await service.set('test-key', 'test-value');
      
      expect(mockSet).toHaveBeenCalledWith('test-key', 'test-value', expect.any(Object));
    });

    it('should set a key with TTL when provided', async () => {
      // First initialize to create a client
      await service.onModuleInit();
      
      const mockSet = jest.fn().mockResolvedValue('OK');
      service['client'].set = mockSet;
      
      await service.set('test-key', 'test-value', 60);
      
      expect(mockSet).toHaveBeenCalledWith('test-key', 'test-value', 'EX', 60);
    });
  });

  describe('get', () => {
    it('should get a value by key', async () => {
      // First initialize to create a client
      await service.onModuleInit();
      
      const mockGet = jest.fn().mockResolvedValue('test-value');
      service['client'].get = mockGet;
      
      const result = await service.get('test-key');
      
      expect(mockGet).toHaveBeenCalledWith('test-key');
      expect(result).toEqual('test-value');
    });

    it('should return null for non-existent key', async () => {
      // First initialize to create a client
      await service.onModuleInit();
      
      const mockGet = jest.fn().mockResolvedValue(null);
      service['client'].get = mockGet;
      
      const result = await service.get('non-existent');
      
      expect(mockGet).toHaveBeenCalledWith('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('del', () => {
    it('should delete a key', async () => {
      // First initialize to create a client
      await service.onModuleInit();
      
      const mockDel = jest.fn().mockResolvedValue(1);
      service['client'].del = mockDel;
      
      await service.del('test-key');
      
      expect(mockDel).toHaveBeenCalledWith('test-key');
    });
  });

  describe('checkRateLimit', () => {
    it('should check rate limit and return true when under limit', async () => {
      // First initialize to create a client
      await service.onModuleInit();
      
      // Mock the required methods
      const mockGet = jest.fn().mockResolvedValue('5'); // Already 5 attempts
      const mockSet = jest.fn().mockResolvedValue('OK');
      const mockExists = jest.fn().mockResolvedValue(1); // Key exists
      
      service['client'].get = mockGet;
      service['client'].set = mockSet;
      service['client'].exists = mockExists;
      
      const result = await service.checkRateLimit('rate:test', 10, 60);
      
      expect(mockExists).toHaveBeenCalledWith('rate:test');
      expect(mockGet).toHaveBeenCalledWith('rate:test');
      expect(mockSet).toHaveBeenCalled();
      expect(result).toBe(true); // Under limit (5 < 10)
    });

    it('should check rate limit and return false when over limit', async () => {
      // First initialize to create a client
      await service.onModuleInit();
      
      // Mock the required methods
      const mockGet = jest.fn().mockResolvedValue('10'); // Already 10 attempts
      const mockSet = jest.fn().mockResolvedValue('OK');
      const mockExists = jest.fn().mockResolvedValue(1); // Key exists
      
      service['client'].get = mockGet;
      service['client'].set = mockSet;
      service['client'].exists = mockExists;
      
      const result = await service.checkRateLimit('rate:test', 10, 60);
      
      expect(mockExists).toHaveBeenCalledWith('rate:test');
      expect(mockGet).toHaveBeenCalledWith('rate:test');
      expect(result).toBe(false); // At limit (10 >= 10)
    });

    it('should initialize counter when key does not exist', async () => {
      // First initialize to create a client
      await service.onModuleInit();
      
      // Mock the required methods
      const mockExists = jest.fn().mockResolvedValue(0); // Key doesn't exist
      const mockSet = jest.fn().mockResolvedValue('OK');
      
      service['client'].exists = mockExists;
      service['client'].set = mockSet;
      
      const result = await service.checkRateLimit('rate:new', 10, 60);
      
      expect(mockExists).toHaveBeenCalledWith('rate:new');
      expect(mockSet).toHaveBeenCalledWith('rate:new', '1', 'EX', 60);
      expect(result).toBe(true); // First attempt (1 < 10)
    });
  });
}); 