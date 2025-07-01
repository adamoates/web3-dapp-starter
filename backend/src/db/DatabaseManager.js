const { Pool } = require("pg");
const mongoose = require("mongoose");
const Redis = require("ioredis");

class DatabaseManager {
  constructor() {
    this.postgres = null;
    this.redis = null;
    this.mongoConnection = null;
  }

  async connect() {
    try {
      // PostgreSQL for structured data
      this.postgres = new Pool({
        connectionString: process.env.POSTGRES_URI || process.env.POSTGRES_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
      });

      // MongoDB for flexible documents
      this.mongoConnection = await mongoose.connect(
        process.env.MONGO_URI || process.env.MONGO_URL,
        {
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000
        }
      );

      // Redis for caching and sessions
      this.redis = new Redis({
        host: process.env.REDIS_HOST || "redis",
        port: process.env.REDIS_PORT || 6379,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3
      });

      console.log("✅ All databases connected");
      return this;
    } catch (error) {
      console.error("❌ Database connection failed:", error);
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

    try {
      // Check PostgreSQL
      await this.postgres.query("SELECT 1");
      health.postgres = true;
    } catch (error) {
      console.error("PostgreSQL health check failed:", error.message);
    }

    try {
      // Check MongoDB
      await mongoose.connection.db.admin().ping();
      health.mongodb = true;
    } catch (error) {
      console.error("MongoDB health check failed:", error.message);
    }

    try {
      // Check Redis
      await this.redis.ping();
      health.redis = true;
    } catch (error) {
      console.error("Redis health check failed:", error.message);
    }

    return health;
  }

  async disconnect() {
    if (this.postgres) await this.postgres.end();
    if (this.mongoConnection) await mongoose.disconnect();
    if (this.redis) await this.redis.quit();
  }

  // Getter methods for easy access
  get postgresPool() {
    return this.postgres;
  }

  get redisClient() {
    return this.redis;
  }

  get mongooseConnection() {
    return this.mongoConnection;
  }
}

module.exports = DatabaseManager;
