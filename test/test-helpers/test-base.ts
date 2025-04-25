import { ModuleMetadata } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { Connection } from 'mongoose';
import { BullModule } from '@nestjs/bull';
import * as Redis from 'ioredis';
import { MockRedisService } from './mock-redis.service';
import { MockKafkaService } from './mock-kafka.service';

/**
 * Test environment types
 */
export enum TestEnv {
  UNIT = 'unit',
  INTEGRATION = 'integration',
  E2E = 'e2e'
}

/**
 * MongoDB Memory Server instance for testing
 */
let mongoMemoryServer: MongoMemoryServer;
let redisClient: Redis.Redis;

/**
 * Creates a testing module with the specified metadata
 * @param metadata Module metadata
 * @param env Test environment
 * @returns TestingModule
 */
export async function createTestingModule(
  metadata: ModuleMetadata,
  env: TestEnv = TestEnv.UNIT,
): Promise<TestingModule> {
  let envFile = '.env.test';
  
  if (env === TestEnv.INTEGRATION) {
    envFile = '.env.integration';
  } else if (env === TestEnv.E2E) {
    envFile = '.env.e2e';
  }
  
  const imports = [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: envFile,
    }),
    ...(metadata.imports || []),
  ];
  
  // For unit tests, we add mock queue module
  if (env === TestEnv.UNIT) {
    imports.push(
      BullModule.forRoot({
        redis: {
          host: 'localhost',
          port: 6379,
        },
      }),
    );
  }
  
  return Test.createTestingModule({
    imports,
    controllers: [...(metadata.controllers || [])],
    providers: [
      ...(metadata.providers || []),
      // Add mock services for unit tests
      ...(env === TestEnv.UNIT ? [
        { provide: 'KafkaService', useClass: MockKafkaService },
        { provide: 'RedisService', useClass: MockRedisService },
      ] : []),
    ],
    exports: [...(metadata.exports || [])],
  }).compile();
}

/**
 * Starts MongoDB Memory Server for testing
 * @returns Connection URI
 */
export async function startMongoMemoryServer(): Promise<string> {
  mongoMemoryServer = await MongoMemoryServer.create();
  const uri = mongoMemoryServer.getUri();
  process.env.MONGODB_URI = uri;
  return uri;
}

/**
 * Stops MongoDB Memory Server
 */
export async function stopMongoMemoryServer(): Promise<void> {
  if (mongoMemoryServer) {
    await mongoMemoryServer.stop();
  }
}

/**
 * Starts Redis for testing
 */
export async function startRedisForTesting(): Promise<void> {
  redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    db: parseInt(process.env.REDIS_DB || '1', 10),
  });
}

/**
 * Stops Redis
 */
export async function stopRedisForTesting(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
  }
}

/**
 * Clears Redis database for testing
 */
export async function clearRedisForTesting(): Promise<void> {
  if (redisClient) {
    await redisClient.flushdb();
  }
}

/**
 * Clears MongoDB database for testing
 * @param connection Mongoose connection
 */
export async function clearDatabase(connection: Connection): Promise<void> {
  if (connection) {
    const collections = connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  }
}

/**
 * Creates a mock JWT token for testing
 * @param payload Token payload
 * @returns Mock JWT token
 */
export function createMockJwtToken(payload: Record<string, any> = {}): string {
  const defaultPayload = {
    sub: 'test-user-id',
    roles: ['user'],
    name: 'Test User',
    ...payload,
  };
  
  // Create a mock token - this is not a real JWT, just a test mock
  const encodedPayload = Buffer.from(JSON.stringify(defaultPayload)).toString('base64');
  return `header.${encodedPayload}.signature`;
}

/**
 * Creates a notification mock object
 */
export function createNotificationMock(overrides = {}) {
  return {
    _id: 'notif-123',
    recipient: {
      user_id: 'user123',
      device_ids: ['device-456'],
    },
    priority: 'high',
    notification: {
      title: 'Test Notification',
      body: 'This is a test notification.',
      image_url: 'https://example.com/image.png',
      deep_link: 'app://test',
    },
    data: {
      test_id: '12345',
    },
    source: 'test-service',
    idempotency_key: 'test-notification-12345',
    status: 'created',
    created_at: new Date(),
    ...overrides,
  };
}

/**
 * Creates a device mock object
 */
export function createDeviceMock(overrides = {}) {
  return {
    _id: 'device-456',
    user_id: 'user123',
    device_token: 'test-device-token',
    platform: 'android',
    app_version: '1.0.0',
    device_model: 'Test Device',
    os_version: 'Android 13',
    language: 'en-US',
    timezone: 'America/New_York',
    notification_preferences: {
      enabled: true,
      categories: {
        marketing: true,
        transactional: true,
      },
      quiet_hours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
        timezone: 'America/New_York',
      },
    },
    created_at: new Date(),
    updated_at: new Date(),
    last_seen: new Date(),
    ...overrides,
  };
}

/**
 * Delay utility for testing async operations
 */
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Mock logger for tests
 */
export const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
}; 