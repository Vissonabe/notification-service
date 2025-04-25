import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KafkaService } from '../../../src/modules/queue/kafka.service';
import { mockLogger } from '../../test-helpers/test-base';

describe('KafkaService', () => {
  let service: KafkaService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KafkaService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'KAFKA_BROKERS':
                  return 'localhost:9092';
                case 'KAFKA_CLIENT_ID':
                  return 'test-client';
                case 'KAFKA_GROUP_ID':
                  return 'test-group';
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

    service = module.get<KafkaService>(KafkaService);
    configService = module.get<ConfigService>(ConfigService);
    
    // Mock internal methods to prevent actual connection attempts
    jest.spyOn(service as any, 'setupClient').mockImplementation(() => {});
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize Kafka client', async () => {
      const connectSpy = jest.spyOn(service as any, 'connect').mockResolvedValue(undefined);
      
      await service.onModuleInit();
      
      expect(connectSpy).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith('Kafka service initialized');
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Connection error');
      jest.spyOn(service as any, 'connect').mockRejectedValue(error);
      
      await expect(service.onModuleInit()).rejects.toThrow('Connection error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize Kafka service', error);
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect Kafka client', async () => {
      const disconnectSpy = jest.spyOn(service as any, 'disconnect').mockResolvedValue(undefined);
      
      await service.onModuleDestroy();
      
      expect(disconnectSpy).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith('Kafka service shut down');
    });

    it('should handle shutdown errors', async () => {
      const error = new Error('Disconnect error');
      jest.spyOn(service as any, 'disconnect').mockRejectedValue(error);
      
      await expect(service.onModuleDestroy()).rejects.toThrow('Disconnect error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to shut down Kafka service', error);
    });
  });

  describe('produce', () => {
    it('should produce message to topic', async () => {
      // Even though this is a placeholder, we can test our logging
      await service.produce('test-topic', { key: 'value' });
      
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Producing message to topic: test-topic',
        expect.any(Object)
      );
    });
  });

  describe('subscribe', () => {
    it('should subscribe to topic', () => {
      const handler = jest.fn();
      
      service.subscribe('test-topic', handler);
      
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Subscribing to Kafka topic: test-topic'
      );
    });
  });
}); 