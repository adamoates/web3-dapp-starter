async function cleanupDatabase() {
  console.log("🧹 Cleaning up test database connections...");

  try {
    // Close PostgreSQL pool
    if (global.__TEST_DB__ && global.__TEST_DB__.postgres) {
      await global.__TEST_DB__.postgres.end();
      console.log("✅ PostgreSQL connection closed");
    }

    // Close MongoDB connection
    if (global.__TEST_DB__ && global.__TEST_DB__.mongo) {
      await global.__TEST_DB__.mongo.disconnect();
      console.log("✅ MongoDB connection closed");
    }

    // Close Redis connection
    if (global.__TEST_DB__ && global.__TEST_DB__.redis) {
      await global.__TEST_DB__.redis.quit();
      console.log("✅ Redis connection closed");
    }

    // MinIO client doesn't need explicit cleanup
    console.log("✅ MinIO client cleanup complete");

    console.log("🎉 All test database connections cleaned up successfully!");
  } catch (error) {
    console.error("❌ Error during database cleanup:", error.message);
  }
}

module.exports = async () => {
  console.log("🔄 Starting global test teardown...");

  try {
    await cleanupDatabase();
    console.log("✅ Global test teardown completed successfully!");
  } catch (error) {
    console.error("❌ Global test teardown failed:", error);
    throw error;
  }
};
