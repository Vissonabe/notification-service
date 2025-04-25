// Set default timeout for all tests
jest.setTimeout(30000);

// Hide console output during tests
if (process.env.JEST_SILENT) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

// Configure global mocks if needed
// jest.mock('some-module', () => {
//   return {
//     // Mock implementation
//   };
// });

// Clean up operations after all tests finish
afterAll(async () => {
  // Clean up any test connections or resources
  // For example, close MongoDB connections, etc.
}); 