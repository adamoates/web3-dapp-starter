// test/setup/teardownTestEnv.js - Test environment teardown
const mongoose = require("mongoose");

// Global teardown for all tests
const globalTeardown = async () => {
  console.log("🧹 Global test teardown...");

  try {
    // Close MongoDB connections
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log("✅ MongoDB connection closed");
    }

    // Close any other database connections
    // Add PostgreSQL pool cleanup if needed
    // Add Redis client cleanup if needed

    // Wait for any pending operations
    await new Promise((resolve) => setTimeout(resolve, 500));

    console.log("✅ Global teardown completed");
  } catch (error) {
    console.error("❌ Global teardown error:", error);
  }
};

module.exports = globalTeardown;
