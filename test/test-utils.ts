import { ModuleMetadata } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';

/**
 * MongoDB Memory Server instance for testing
 */
let mongoMemoryServer: MongoMemoryServer;

/**
 * Creates a testing module with the specified metadata
 * @param metadata Module metadata
 * @returns TestingModule
 */
export async function createTestingModule(
  metadata: ModuleMetadata,
): Promise<TestingModule> {
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        cache: true,
        envFilePath: '.env.test',
      }),
      ...(metadata.imports || []),
    ],
    controllers: [...(metadata.controllers || [])],
    providers: [...(metadata.providers || [])],
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