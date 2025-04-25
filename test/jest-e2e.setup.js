// Increase timeout for E2E tests
jest.setTimeout(60000);

// Global setup for E2E tests
beforeAll(async () => {
  // Wait for test database to be ready
  // For example, wait for MongoDB container to be ready
  console.log('Starting E2E test suite...');

  // You can add additional setup logic here
  // like setting up test data, etc.
});

// Global teardown for E2E tests
afterAll(async () => {
  // Clean up test resources
  console.log('E2E test suite completed.');
}); 