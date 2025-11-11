import { Sequelize } from 'sequelize';

// Set test environment
process.env.NODE_ENV = 'test';

// Create test database connection
const testSequelize = new Sequelize('sqlite::memory:', {
  logging: false,
});

// Override the default sequelize instance for tests
jest.mock('../src/database/config', () => {
  return testSequelize;
});

// Setup and teardown
beforeAll(async () => {
  // Sync database before all tests
  await testSequelize.sync({ force: true });
});

afterAll(async () => {
  // Close database connection after all tests
  await testSequelize.close();
});

afterEach(async () => {
  // Clear all tables after each test
  await testSequelize.truncate({ cascade: true, restartIdentity: true });
});
