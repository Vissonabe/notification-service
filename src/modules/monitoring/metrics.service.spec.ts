import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
      ],
    }).compile();

    service = module.get<MetricsService>(MetricsService);

    // Mock the logger methods
    jest.spyOn(service['logger'], 'debug').mockImplementation(mockLogger.debug);
    jest.spyOn(service['logger'], 'log').mockImplementation(mockLogger.log);
    jest.spyOn(service['logger'], 'error').mockImplementation(mockLogger.error);
    jest.spyOn(service['logger'], 'warn').mockImplementation(mockLogger.warn);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('incrementCounter', () => {
    it('should increment counter with default value', () => {
      // Arrange
      service['counters'] = { 'test_counter': 0 };

      // Act
      service.incrementCounter('test_counter');

      // Assert
      expect(service['counters']['test_counter']).toBe(1);
      expect(mockLogger.debug).toHaveBeenCalledWith('Metric test_counter = 1');
    });

    it('should increment counter with specified value', () => {
      // Arrange
      service['counters'] = { 'test_counter': 0 };

      // Act
      service.incrementCounter('test_counter', 5);

      // Assert
      expect(service['counters']['test_counter']).toBe(5);
      expect(mockLogger.debug).toHaveBeenCalledWith('Metric test_counter = 5');
    });

    it('should create counter if it does not exist', () => {
      // Arrange
      service['counters'] = {};

      // Act
      service.incrementCounter('new_counter');

      // Assert
      expect(service['counters']['new_counter']).toBe(1);
      expect(mockLogger.debug).toHaveBeenCalledWith('Metric new_counter = 1');
    });

    it('should include tags in log message when provided', () => {
      // Arrange
      service['counters'] = { 'test_counter': 0 };
      const tags = { service: 'notifications', priority: 'high' };

      // Act
      service.incrementCounter('test_counter', 1, tags);

      // Assert
      expect(service['counters']['test_counter']).toBe(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Metric test_counter = 1 {"service":"notifications","priority":"high"}'
      );
    });
  });

  describe('recordHistogram', () => {
    it('should record histogram value', () => {
      // Arrange
      service['histograms'] = { 'test_histogram': [] };

      // Act
      service.recordHistogram('test_histogram', 42);

      // Assert
      expect(service['histograms']['test_histogram']).toContain(42);
      expect(mockLogger.debug).toHaveBeenCalledWith('Histogram test_histogram = 42');
    });

    it('should create histogram if it does not exist', () => {
      // Arrange
      service['histograms'] = {};

      // Act
      service.recordHistogram('new_histogram', 42);

      // Assert
      expect(service['histograms']['new_histogram']).toEqual([42]);
      expect(mockLogger.debug).toHaveBeenCalledWith('Histogram new_histogram = 42');
    });

    it('should include tags in log message when provided', () => {
      // Arrange
      service['histograms'] = { 'test_histogram': [] };
      const tags = { service: 'notifications', priority: 'high' };

      // Act
      service.recordHistogram('test_histogram', 42, tags);

      // Assert
      expect(service['histograms']['test_histogram']).toContain(42);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Histogram test_histogram = 42 {"service":"notifications","priority":"high"}'
      );
    });
  });

  describe('measureExecutionTime', () => {
    beforeEach(() => {
      // Mock Date.now to control time measurements
      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(1000) // Start time
        .mockReturnValueOnce(1500); // End time (500ms elapsed)
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should measure execution time of a function', async () => {
      // Arrange
      service['histograms'] = { 'execution_time': [] };
      const mockFn = jest.fn().mockResolvedValue('result');

      // Act
      const result = await service.measureExecutionTime('execution_time', mockFn);

      // Assert
      expect(result).toBe('result');
      expect(mockFn).toHaveBeenCalled();
      expect(service['histograms']['execution_time']).toContain(500);
      expect(mockLogger.debug).toHaveBeenCalledWith('Histogram execution_time = 500');
    });

    it('should record execution time even if function throws', async () => {
      // Arrange
      service['histograms'] = { 'execution_time': [] };
      const mockError = new Error('Test error');
      const mockFn = jest.fn().mockRejectedValue(mockError);

      // Act & Assert
      await expect(service.measureExecutionTime('execution_time', mockFn))
        .rejects.toThrow(mockError);

      expect(mockFn).toHaveBeenCalled();
      expect(service['histograms']['execution_time']).toContain(500);
      expect(mockLogger.debug).toHaveBeenCalledWith('Histogram execution_time = 500');
    });

    it('should include tags when provided', async () => {
      // Arrange
      service['histograms'] = { 'execution_time': [] };
      const mockFn = jest.fn().mockResolvedValue('result');
      const tags = { operation: 'db_query', service: 'notifications' };

      // Act
      await service.measureExecutionTime('execution_time', mockFn, tags);

      // Assert
      expect(service['histograms']['execution_time']).toContain(500);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Histogram execution_time = 500 {"operation":"db_query","service":"notifications"}'
      );
    });
  });

  describe('getAllMetrics', () => {
    it('should return all metrics', () => {
      // Arrange
      service['counters'] = {
        'counter1': 5,
        'counter2': 10
      };
      service['histograms'] = {
        'histogram1': [1, 2, 3],
        'histogram2': [4, 5, 6]
      };

      // Act
      const metrics = service.getAllMetrics();

      // Assert
      expect(metrics).toEqual({
        counters: {
          'counter1': 5,
          'counter2': 10
        },
        histograms: {
          'histogram1': [1, 2, 3],
          'histogram2': [4, 5, 6]
        }
      });

      // Verify that we get a copy, not the original objects
      expect(metrics.counters).not.toBe(service['counters']);
      expect(metrics.histograms).not.toBe(service['histograms']);
    });
  });
});
