# Notification Service Testing Guide

This guide outlines the testing strategy for the Notification Service to achieve and maintain 80% code coverage.

## Testing Environments

The Notification Service uses three testing environments:

1. **Unit Testing** - For testing individual components in isolation
2. **Integration Testing** - For testing interactions between components
3. **End-to-End (E2E) Testing** - For testing complete API flows

Each environment has a dedicated configuration file:
- `.env.test` - Unit test configuration
- `.env.integration` - Integration test configuration
- `.env.e2e` - E2E test configuration

## Running Tests

The project includes several npm scripts for running tests:

```bash
# Run all unit tests
npm test

# Run unit tests with watch mode
npm run test:watch

# Run unit tests with coverage
npm run test:cov

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run all tests (unit, integration, and E2E)
npm run test:all
```

## Code Coverage Requirements

The project is configured to enforce 80% code coverage across the codebase with the following thresholds:

```json
"coverageThreshold": {
  "global": {
    "statements": 80,
    "branches": 70,
    "functions": 80,
    "lines": 80
  }
}
```

## Directory Structure

Tests are organized in the following structure:

```
test/
  ├── jest.setup.js             # Global Jest setup
  ├── jest-e2e.json             # E2E test configuration
  ├── jest-e2e.setup.js         # E2E test setup
  ├── test-utils.ts             # Common test utilities
  ├── test-helpers/             # Reusable test helpers
  │   ├── test-base.ts          # Base testing utilities
  │   ├── mock-kafka.service.ts # Mock Kafka service
  │   └── mock-redis.service.ts # Mock Redis service
  ├── examples/                 # Example test implementations
  │   ├── unit/                 # Unit test examples
  │   ├── integration/          # Integration test examples
  │   ├── e2e/                  # E2E test examples
  │   └── utils/                # Utility test examples
  └── mocks/                    # Test mock data
```

## Writing Tests

### Unit Tests

Unit tests focus on testing individual components in isolation. External dependencies are mocked.

Example:
```typescript
describe('NotificationService', () => {
  let service: NotificationService;
  
  beforeEach(async () => {
    // Setup test module with mocked dependencies
  });
  
  it('should create a notification', async () => {
    // Test specific functionality
  });
});
```

### Integration Tests

Integration tests verify that different components work together correctly.

Example:
```typescript
describe('Notification Flow Integration', () => {
  beforeAll(async () => {
    // Set up MongoDB memory server
    await startMongoMemoryServer();
  });
  
  afterAll(async () => {
    // Clean up resources
    await stopMongoMemoryServer();
  });
  
  it('should process a notification through multiple services', async () => {
    // Test an entire flow
  });
});
```

### E2E Tests

E2E tests verify that the API endpoints work end-to-end.

Example:
```typescript
describe('Notification API (e2e)', () => {
  let app: INestApplication;
  
  beforeAll(async () => {
    // Set up the NestJS app with the entire module tree
  });
  
  it('POST /api/v1/notifications should create a notification', async () => {
    // Test API endpoint
    await request(app.getHttpServer())
      .post('/api/v1/notifications')
      .send(data)
      .expect(201);
  });
});
```

## Testing Tools

The Notification Service uses the following testing tools:

1. **Jest** - Testing framework
2. **SuperTest** - HTTP assertion library
3. **mongodb-memory-server** - In-memory MongoDB for isolated testing
4. **jest-html-reporters** - HTML report generation

## Test Mocks

We provide several mock utilities for testing:

- **MockKafkaService** - Mocks Kafka functionality for unit tests
- **MockRedisService** - Mocks Redis functionality for unit tests
- **createNotificationMock()** - Creates mock notification data
- **createDeviceMock()** - Creates mock device data
- **createMockJwtToken()** - Creates mock JWT tokens for authentication

## Strategies for Achieving 80% Coverage

1. **Test All Public Methods**: Ensure every public method has at least one test
2. **Test Edge Cases**: Cover error handling, boundary values, and edge cases
3. **Integration Testing for Complex Flows**: Use integration tests for complex workflows
4. **Cover Critical Paths**: Prioritize testing critical business logic paths
5. **Use Parameterized Tests**: For methods with multiple input variations

## Running Tests in CI Pipeline

The CI pipeline runs all tests to ensure code quality:

1. Unit tests
2. Integration tests
3. E2E tests
4. Code coverage report generation

## Common Test Patterns

### Arrange-Act-Assert Pattern

```typescript
// Arrange
const notificationData = createNotificationMock();
jest.spyOn(service, 'findById').mockResolvedValue(notificationData);

// Act
const result = await service.findById('test-id');

// Assert
expect(result).toEqual(notificationData);
```

### Exception Testing

```typescript
// Test expected exceptions
await expect(service.findById('non-existent'))
  .rejects.toThrow(NotFoundException);
```

### Mocking Dependencies

```typescript
// Mock dependencies for unit tests
{
  provide: DeviceService,
  useValue: {
    findById: jest.fn(),
    validateDeviceExists: jest.fn(),
  },
}
```

## Best Practices

1. **Test Independence**: Each test should be independent and not rely on other tests
2. **Clean Up Resources**: Always clean up resources after tests
3. **Descriptive Test Names**: Use descriptive test names that explain the test purpose
4. **Small, Focused Tests**: Keep tests small and focused on specific functionality
5. **Avoid Test Duplication**: Reuse test setup code where possible
6. **Test Real-World Scenarios**: Create tests that represent real-world use cases

## Test Troubleshooting

Common issues and solutions:

1. **Memory Leaks**: Ensure all resources are properly closed in `afterAll` hooks
2. **Test Isolation**: Use `beforeEach` to reset mocks between tests
3. **Asynchronous Testing**: Always return promises or use async/await in tests
4. **CI Pipeline Failures**: Check for environment-specific issues in CI pipeline

## Continuous Improvement

Regularly review and improve the test suite:

1. Monitor code coverage reports
2. Add tests for new features
3. Refactor tests when improving code
4. Review failing tests in PRs 