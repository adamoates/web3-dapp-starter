// test/setup/setupTestEnv.js - Comprehensive test environment setup
require("dotenv").config({ path: ".env.test" });

const {
  setupTestEnvironment,
  teardownTestEnvironment
} = require("../helpers/testHelpers");

// Global test setup
beforeAll(async () => {
  console.log("🔧 Setting up test environment...");

  // Setup test environment variables
  setupTestEnvironment();

  // Wait for any async operations to complete
  await new Promise((resolve) => setTimeout(resolve, 100));

  console.log("✅ Test environment ready");
}, 30000);

// Global test cleanup
afterAll(async () => {
  console.log("🧹 Cleaning up test environment...");

  // Teardown test environment
  await teardownTestEnvironment();

  console.log("✅ Test environment cleaned up");
}, 10000);

// Global test timeout
jest.setTimeout(30000);

// Handle unhandled promise rejections in tests
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// Handle uncaught exceptions in tests
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});
