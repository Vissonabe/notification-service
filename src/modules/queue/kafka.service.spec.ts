import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KafkaService } from './kafka.service';

describe('KafkaService', () => {
  let service: KafkaService;
  let configService: ConfigService;

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

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
    jest.spyOn(service as any, 'connect').mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize Kafka client', async () => {
      // Act
      await service.onModuleInit();

      // Assert
      expect(service['connect']).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith('Kafka service initialized');
    });

    it('should handle initialization errors', async () => {
      // Arrange
      const error = new Error('Connection error');
      jest.spyOn(service as any, 'connect').mockRejectedValue(error);

      // Act & Assert
      await expect(service.onModuleInit()).rejects.toThrow('Connection error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize Kafka service', error);
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect Kafka client', async () => {
      // Arrange
      const disconnectSpy = jest.spyOn(service as any, 'disconnect').mockResolvedValue(undefined);

      // Act
      await service.onModuleDestroy();

      // Assert
      expect(disconnectSpy).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith('Kafka service disconnected');
    });
  });

  describe('produce', () => {
    it('should produce message to topic', async () => {
      // Arrange
      const topic = 'test-topic';
      const message = { key: 'value' };
      const produceSpy = jest.spyOn(service as any, 'produceMessage').mockResolvedValue(undefined);

      // Act
      await service.produce(topic, message);

      // Assert
      expect(produceSpy).toHaveBeenCalledWith(topic, message);
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Producing message to topic: test-topic',
        expect.any(Object)
      );
    });

    it('should handle production errors', async () => {
      // Arrange
      const topic = 'test-topic';
      const message = { key: 'value' };
      const error = new Error('Production error');
      jest.spyOn(service as any, 'produceMessage').mockRejectedValue(error);

      // Act & Assert
      await expect(service.produce(topic, message)).rejects.toThrow('Production error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to produce message to topic: test-topic',
        error
      );
    });
  });

  describe('subscribe', () => {
    it('should subscribe to topic', () => {
      // Arrange
      const topic = 'test-topic';
      const groupId = 'test-group';
      const handler = jest.fn();
      const subscribeSpy = jest.spyOn(service as any, 'subscribeToTopic').mockImplementation(() => {});

      // Act
      service.subscribe(topic, groupId, handler);

      // Assert
      expect(subscribeSpy).toHaveBeenCalledWith(topic, groupId, handler);
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Subscribing to Kafka topic: test-topic'
      );
    });

    it('should handle subscription errors', () => {
      // Arrange
      const topic = 'test-topic';
      const groupId = 'test-group';
      const handler = jest.fn();
      const error = new Error('Subscription error');
      jest.spyOn(service as any, 'subscribeToTopic').mockImplementation(() => {
        throw error;
      });

      // Act & Assert
      expect(() => service.subscribe(topic, groupId, handler)).toThrow('Subscription error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to subscribe to topic: test-topic',
        error
      );
    });
  });
});
