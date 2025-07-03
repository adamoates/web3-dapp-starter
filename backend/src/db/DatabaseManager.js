const { setupDatabase, getDatabase, closeDatabase } = require("../database");

class DatabaseManager {
  constructor() {
    this.databases = null;
  }

  async connect() {
    try {
      // Use the centralized database setup
      this.databases = await setupDatabase();
      console.log("✅ All databases connected via DatabaseManager");
      return this;
    } catch (error) {
      console.error("❌ Database connection failed:", error);
      throw error;
    }
  }

  async disconnect() {
    try {
      await closeDatabase();
      this.databases = null;
      console.log("✅ All databases disconnected via DatabaseManager");
    } catch (error) {
      console.error("❌ Database disconnection failed:", error);
      throw error;
    }
  }

  async healthCheck() {
    const health = {
      postgres: false,
      mongodb: false,
      redis: false,
      timestamp: new Date().toISOString()
    };

    if (!this.databases) {
      return health;
    }

    try {
      // Check PostgreSQL
      await this.databases.postgres.query("SELECT 1");
      health.postgres = true;
    } catch (error) {
      console.error("PostgreSQL health check failed:", error.message);
    }

    try {
      // Check MongoDB
      if (this.databases.mongo && this.databases.mongo.readyState === 1) {
        await this.databases.mongo.db.admin().ping();
        health.mongodb = true;
      }
    } catch (error) {
      console.error("MongoDB health check failed:", error.message);
    }

    try {
      // Check Redis
      await this.databases.redis.ping();
      health.redis = true;
    } catch (error) {
      console.error("Redis health check failed:", error.message);
    }

    return health;
  }

  // Getter methods for easy access
  get postgresPool() {
    return this.databases?.postgres;
  }

  get redisClient() {
    return this.databases?.redis;
  }

  get mongooseConnection() {
    return this.databases?.mongo;
  }
}

module.exports = DatabaseManager;
