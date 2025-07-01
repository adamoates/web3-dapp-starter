const { Pool } = require("pg");
const mongoose = require("mongoose");
const Redis = require("ioredis");
const Minio = require("minio");
const path = require("path");
const createApp = require("../../src/app");

// Load test environment variables
require("dotenv").config({
  path: path.join(__dirname, "../../test.env.docker")
});

// Docker test environment configuration
const DOCKER_CONFIG = {
  postgres: {
    host: "localhost",
    port: 5433,
    user: "test_user",
    password: "test_password",
    database: "test_db"
  },
  mongo: {
    uri: "mongodb://localhost:27018/test_db"
  },
  redis: {
    host: "localhost",
    port: 6380
  },
  minio: {
    endPoint: "localhost",
    port: 9002,
    useSSL: false,
    accessKey: "test_user",
    secretKey: "test_password"
  }
};

// Database connections for Docker tests
let postgresPool;
let mongoConnection;
let redisClient;
let minioClient;

/**
 * Initialize all database connections for Docker testing
 */
async function initializeDockerConnections() {
  console.log("🔧 Initializing Docker test connections...");

  try {
    // PostgreSQL connection
    postgresPool = new Pool({
      host: DOCKER_CONFIG.postgres.host,
      port: DOCKER_CONFIG.postgres.port,
      user: DOCKER_CONFIG.postgres.user,
      password: DOCKER_CONFIG.postgres.password,
      database: DOCKER_CONFIG.postgres.database,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    });

    // Test PostgreSQL connection
    await postgresPool.query("SELECT NOW()");
    console.log("✅ PostgreSQL connected");

    // MongoDB connection
    mongoConnection = await mongoose.connect(DOCKER_CONFIG.mongo.uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false
    });
    console.log("✅ MongoDB connected");

    // Redis connection
    redisClient = new Redis({
      host: DOCKER_CONFIG.redis.host,
      port: DOCKER_CONFIG.redis.port,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });

    await redisClient.ping();
    console.log("✅ Redis connected");

    // MinIO connection
    minioClient = new Minio.Client({
      endPoint: DOCKER_CONFIG.minio.endPoint,
      port: DOCKER_CONFIG.minio.port,
      useSSL: DOCKER_CONFIG.minio.useSSL,
      accessKey: DOCKER_CONFIG.minio.accessKey,
      secretKey: DOCKER_CONFIG.minio.secretKey
    });

    // Test MinIO connection
    await minioClient.listBuckets();
    console.log("✅ MinIO connected");

    console.log("🎉 All Docker test connections established successfully!");
    return true;
  } catch (error) {
    console.error("❌ Failed to initialize Docker connections:", error.message);
    throw error;
  }
}

/**
 * Clean up all database connections
 */
async function cleanupDockerConnections() {
  console.log("🧹 Cleaning up Docker test connections...");

  try {
    // Close PostgreSQL pool
    if (postgresPool) {
      await postgresPool.end();
      console.log("✅ PostgreSQL connection closed");
    }

    // Close MongoDB connection
    if (mongoConnection) {
      await mongoose.disconnect();
      console.log("✅ MongoDB connection closed");
    }

    // Close Redis connection
    if (redisClient) {
      await redisClient.quit();
      console.log("✅ Redis connection closed");
    }

    console.log("🎉 All Docker test connections cleaned up successfully!");
  } catch (error) {
    console.error("❌ Error during cleanup:", error.message);
  }
}

/**
 * Reset all test databases
 */
async function resetTestDatabases() {
  console.log("🔄 Resetting test databases...");

  try {
    // Reset PostgreSQL
    await postgresPool.query("DROP SCHEMA IF EXISTS public CASCADE");
    await postgresPool.query("CREATE SCHEMA public");
    await postgresPool.query("GRANT ALL ON SCHEMA public TO test_user");
    console.log("✅ PostgreSQL reset");

    // Reset MongoDB
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();
    for (const collection of collections) {
      await mongoose.connection.db.dropCollection(collection.name);
    }
    console.log("✅ MongoDB reset");

    // Reset Redis
    await redisClient.flushall();
    console.log("✅ Redis reset");

    // Reset MinIO (delete all objects in test bucket)
    try {
      const objectsStream = minioClient.listObjects("test-bucket", "", true);
      const objects = [];

      objectsStream.on("data", (obj) => objects.push(obj.name));
      objectsStream.on("end", async () => {
        if (objects.length > 0) {
          await minioClient.removeObjects("test-bucket", objects);
        }
      });
      console.log("✅ MinIO reset");
    } catch (error) {
      // Bucket might not exist, which is fine
      console.log("ℹ️ MinIO bucket already empty");
    }

    console.log("🎉 All test databases reset successfully!");
  } catch (error) {
    console.error("❌ Error resetting databases:", error.message);
    throw error;
  }
}

/**
 * Run database migrations for testing
 */
async function runTestMigrations() {
  console.log("📦 Running test migrations...");
  console.log("📦 Migration runner started");

  try {
    // Read and execute migration files
    const fs = require("fs");
    const path = require("path");
    const migrationsDir = path.join(__dirname, "../../migrations");

    console.log(`📦 Looking for migrations in: ${migrationsDir}`);

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    console.log(
      `📦 Found ${migrationFiles.length} migration files:`,
      migrationFiles
    );

    for (const file of migrationFiles) {
      const migrationPath = path.join(migrationsDir, file);
      const migrationSQL = fs.readFileSync(migrationPath, "utf8");

      // Extract only the "Up migration" part (before "Down migration")
      const upMigrationMatch = migrationSQL.match(
        /-- Up migration\s*([\s\S]*?)(?=-- Down migration|$)/i
      );
      if (!upMigrationMatch) {
        console.log(`⚠️ No up migration found in ${file}, skipping...`);
        continue;
      }

      const upMigration = upMigrationMatch[1];
      console.log(`\n--- MIGRATION FILE: ${file} ---`);
      console.log(
        "--- UP MIGRATION SQL ---\n" + upMigration + "\n--- END SQL ---"
      );

      try {
        const result = await postgresPool.query(upMigration);
        console.log(`✅ Executed migration: ${file}`);
        if (result && result.command) {
          console.log(`Result: ${result.command}`);
        }
      } catch (error) {
        // Skip errors for IF NOT EXISTS/EXISTS statements
        if (
          error.message.includes("already exists") ||
          error.message.includes("does not exist")
        ) {
          console.log(`ℹ️ Skipped statement in ${file}: ${error.message}`);
        } else {
          console.error(`❌ Error in migration ${file}:`, error.message);
          throw error;
        }
      }
    }

    console.log("🎉 All test migrations completed successfully!");
  } catch (error) {
    console.error("❌ Error running migrations:", error.message);
    console.error("❌ Migration error stack:", error.stack);
    throw error;
  }
}

/**
 * Wait for Docker services to be ready
 */
async function waitForDockerServices() {
  console.log("⏳ Waiting for Docker services to be ready...");

  const maxAttempts = 30;
  const delay = 2000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Test PostgreSQL
      const pgPool = new Pool({
        host: DOCKER_CONFIG.postgres.host,
        port: DOCKER_CONFIG.postgres.port,
        user: DOCKER_CONFIG.postgres.user,
        password: DOCKER_CONFIG.postgres.password,
        database: DOCKER_CONFIG.postgres.database,
        connectionTimeoutMillis: 1000
      });

      await pgPool.query("SELECT 1");
      await pgPool.end();

      // Test Redis
      const testRedis = new Redis({
        host: DOCKER_CONFIG.redis.host,
        port: DOCKER_CONFIG.redis.port,
        lazyConnect: true,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 1
      });

      await testRedis.ping();
      await testRedis.quit();

      console.log("✅ All Docker services are ready!");
      return true;
    } catch (error) {
      if (attempt === maxAttempts) {
        console.error("❌ Docker services failed to start within timeout");
        throw error;
      }

      console.log(
        `⏳ Attempt ${attempt}/${maxAttempts}: Waiting for services... (${error.message})`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

function createDockerTestApp() {
  // Use the Docker-initialized connections
  return createApp({
    dbManager: {
      postgresPool,
      mongooseConnection: mongoConnection,
      redisClient,
      healthCheck: async () => ({
        postgres: !!postgresPool,
        mongodb: !!mongoConnection,
        redis: !!redisClient
      })
    }
    // Optionally, you can inject minioService if needed
  });
}

function getDockerDbManager() {
  return {
    postgresPool,
    mongooseConnection: mongoConnection,
    redisClient,
    healthCheck: async () => ({
      postgres: !!postgresPool,
      mongodb: !!mongoConnection,
      redis: !!redisClient
    })
  };
}

module.exports = {
  DOCKER_CONFIG,
  initializeDockerConnections,
  cleanupDockerConnections,
  resetTestDatabases,
  runTestMigrations,
  waitForDockerServices,
  getConnections: () => ({
    postgres: postgresPool,
    mongo: mongoConnection,
    redis: redisClient,
    minio: minioClient
  }),
  createDockerTestApp,
  getDockerDbManager
};
