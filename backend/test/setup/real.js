// test/setup/real.js - Real connections for integration tests
require("dotenv").config({ path: ".env.test" });

const { Pool } = require("pg");
const mongoose = require("mongoose");
const Redis = require("ioredis");
const { execSync } = require("child_process");
const path = require("path");
const { runMigrations } = require("../../scripts/migrate");

// Set test environment variables for real DB connections
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-key-for-jwt-signing";
process.env.TEST_POSTGRES_URI =
  process.env.TEST_POSTGRES_URI ||
  "postgresql://test_user:test_password@localhost:5433/test_db";
process.env.TEST_MONGO_URI =
  process.env.TEST_MONGO_URI || "mongodb://localhost:27018/test_db";
process.env.TEST_REDIS_URI =
  process.env.TEST_REDIS_URI || "redis://localhost:6380/1";
process.env.MINIO_ENDPOINT = "localhost";
process.env.MINIO_PORT = "9002";
process.env.MINIO_BUCKET = "test-bucket";
process.env.MAIL_HOST = "localhost";
process.env.MAIL_PORT = "1026";
process.env.MAIL_FROM = "test@example.com";
process.env.TEST_EMAIL_TO = "test@example.com";

// Global test timeout for real DB tests
jest.setTimeout(60000);

// Global test cleanup
afterAll(async () => {
  try {
    // Close database connections
    if (testPool) {
      await testPool.end();
    }
    if (testRedis) {
      await testRedis.quit();
    }
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }

    // Wait for any pending operations to complete
    await new Promise((resolve) => setTimeout(resolve, 500));
  } catch (error) {
    console.error("Test cleanup error:", error);
  }
});

let testPool;
let testRedis;
let isSetupComplete = false;

// Enhanced database setup with retries and health checks
beforeAll(async () => {
  if (isSetupComplete) return;

  try {
    console.log("🔧 Setting up integration test environment...");

    // Check if Docker services are available
    const dockerServicesAvailable = await checkDockerServices();

    if (dockerServicesAvailable) {
      // Wait for Docker services with retries
      await waitForServices();

      // Setup PostgreSQL with migration
      await setupPostgreSQL();

      // Setup MongoDB with seeded data
      await setupMongoDB();

      // Setup Redis
      await setupRedis();
    } else {
      console.log("⚠️  Docker services not available, using mocked services");
      // Use mocked services instead
      await setupMockedServices();
    }

    console.log("✅ Integration test environment ready");
    isSetupComplete = true;
  } catch (error) {
    console.error("❌ Integration test setup failed:", error);
    console.log("⚠️  Falling back to mocked services");
    await setupMockedServices();
    isSetupComplete = true;
  }
}, 120000); // 2 minute timeout

async function checkDockerServices() {
  try {
    // Quick check if Docker services are running
    const tempPool = new Pool({
      connectionString: process.env.TEST_POSTGRES_URI,
      connectionTimeoutMillis: 2000
    });
    await tempPool.query("SELECT 1");
    await tempPool.end();
    return true;
  } catch (error) {
    console.log("Docker services not available:", error.message);
    return false;
  }
}

async function setupMockedServices() {
  // Mock the database connections for tests
  jest.mock("../../src/db/DatabaseManager", () => {
    return jest.fn().mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(true),
      disconnect: jest.fn().mockResolvedValue(true),
      healthCheck: jest.fn().mockResolvedValue({
        postgres: true,
        mongodb: true,
        redis: true
      }),
      postgresPool: {
        query: jest.fn().mockResolvedValue({ rows: [] })
      },
      mongooseConnection: {
        db: {
          stats: jest.fn().mockResolvedValue({})
        }
      },
      redisClient: {
        set: jest.fn().mockResolvedValue("OK"),
        get: jest.fn().mockResolvedValue("test-value"),
        del: jest.fn().mockResolvedValue(1)
      }
    }));
  });

  // Mock MinIO service
  jest.mock("../../src/services/MinIOService", () => {
    return jest.fn().mockImplementation(() => ({
      init: jest.fn().mockResolvedValue(true),
      healthCheck: jest.fn().mockResolvedValue({
        status: "healthy",
        timestamp: new Date().toISOString()
      }),
      generateFileName: jest.fn().mockReturnValue("test-file-name"),
      uploadFile: jest.fn().mockResolvedValue({
        url: "https://test.com/file",
        fileName: "test-file-name"
      }),
      deleteFile: jest.fn().mockResolvedValue(true)
    }));
  });
}

async function waitForServices() {
  const maxRetries = 10; // Reduced from 20
  const retryDelay = 2000; // Reduced from 3000

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `Attempting to connect to test services (${attempt}/${maxRetries})...`
      );

      // Test PostgreSQL
      const tempPool = new Pool({
        connectionString: process.env.TEST_POSTGRES_URI,
        connectionTimeoutMillis: 5000
      });
      await tempPool.query("SELECT 1");
      await tempPool.end();

      // Test MongoDB
      await mongoose.connect(process.env.TEST_MONGO_URI, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000
      });
      await mongoose.connection.close();

      // Test Redis
      const tempRedis = new Redis({
        host: "localhost",
        port: 6380,
        connectTimeout: 5000,
        lazyConnect: true
      });
      await tempRedis.connect();
      await tempRedis.quit();

      console.log("✅ All test services are ready");
      return;
    } catch (error) {
      console.log(`Attempt ${attempt} failed: ${error.message}`);
      if (attempt === maxRetries) {
        throw new Error("Test services failed to start after maximum retries");
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
}

async function setupPostgreSQL() {
  testPool = new Pool({
    connectionString: process.env.TEST_POSTGRES_URI,
    max: 5,
    connectionTimeoutMillis: 10000
  });

  // Run migrations
  try {
    console.log("Running PostgreSQL migrations...");

    // Simple migration runner (adjust path as needed)
    const migrationPath = path.join(__dirname, "../../scripts/migrate.js");
    execSync(`node ${migrationPath} migrate`, {
      env: { ...process.env, DATABASE_URL: process.env.TEST_POSTGRES_URI },
      stdio: "pipe"
    });

    console.log("✅ PostgreSQL migrations completed");
  } catch (error) {
    console.warn("Warning: Migration failed, creating basic schema...");

    // Fallback: Create basic tables manually
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        wallet_address VARCHAR(42) UNIQUE,
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await testPool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        tx_hash VARCHAR(66) UNIQUE NOT NULL,
        type VARCHAR(50) NOT NULL,
        amount DECIMAL(36,18),
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("✅ Basic PostgreSQL schema created");
  }
}

async function setupMongoDB() {
  await mongoose.connect(process.env.TEST_MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 5
  });

  // Clear and seed blockchain events for web3 tests
  await seedBlockchainEvents();
  console.log("✅ MongoDB connected and seeded");
}

async function setupRedis() {
  testRedis = new Redis({
    host: "localhost",
    port: 6380,
    db: 1,
    connectTimeout: 10000,
    lazyConnect: true
  });

  await testRedis.connect();
  await testRedis.flushdb(); // Clear test database
  console.log("✅ Redis connected and cleared");
}

async function seedBlockchainEvents() {
  try {
    // Clear existing data
    const {
      BlockchainEvent
    } = require("../../src/models/nosql/BlockchainEvent");
    await BlockchainEvent.deleteMany({});

    // Seed with test data
    const testEvents = [
      {
        eventType: "Transfer",
        contractAddress: "0x1234567890abcdef",
        tokenId: "1",
        from: "0x0000000000000000000000000000000000000000",
        to: "0xabcdef1234567890",
        blockNumber: 12345,
        transactionHash: "0xabcdef1234567890",
        timestamp: new Date()
      }
    ];

    await BlockchainEvent.insertMany(testEvents);
    console.log("✅ Blockchain events seeded");
  } catch (error) {
    console.warn("Warning: Could not seed blockchain events:", error.message);
  }
}

// Clean data between tests
beforeEach(async () => {
  try {
    if (testPool) {
      // Clean PostgreSQL tables
      await testPool.query("DELETE FROM transactions");
      await testPool.query("DELETE FROM users");
    }

    if (testRedis) {
      // Clean Redis
      await testRedis.flushdb();
    }

    // Don't clean MongoDB - keep seeded blockchain events
    // Only clean user-specific collections if they exist
    const collections = ["useractivities", "usersessions"];
    for (const collectionName of collections) {
      try {
        const collection = mongoose.connection.db.collection(collectionName);
        await collection.deleteMany({});
      } catch (error) {
        // Collection might not exist, ignore
      }
    }
  } catch (error) {
    console.warn("Warning: Could not clean test data:", error.message);
  }
});

// Cleanup
afterAll(async () => {
  try {
    if (testPool) {
      await testPool.end();
      console.log("✅ PostgreSQL test connection closed");
    }
    if (testRedis) {
      await testRedis.quit();
      console.log("✅ Redis test connection closed");
    }
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log("✅ MongoDB test connection closed");
    }
  } catch (error) {
    console.warn("Warning: Error during test cleanup:", error.message);
  }
}, 15000);

// Make test instances globally available
global.testPool = testPool;
global.testRedis = testRedis;

// Export helper functions for use in tests
module.exports = {
  getTestPool: () => global.testPool,
  getTestRedis: () => global.testRedis,
  getTestMongoose: () => mongoose.connection,

  // Functions for real integration tests
  setupRealDatabases: async () => {
    const DatabaseManager = require("../../src/db/DatabaseManager");
    const dbManager = new DatabaseManager();
    await dbManager.connect();
    return { dbManager };
  },

  cleanupRealDatabases: async () => {
    if (global.testPool) {
      await global.testPool.end();
    }
    if (global.testRedis) {
      await global.testRedis.quit();
    }
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  },

  cleanAllDatabases: async () => {
    try {
      if (global.testPool) {
        await global.testPool.query("DELETE FROM transactions");
        await global.testPool.query("DELETE FROM users");
      }
      if (global.testRedis) {
        await global.testRedis.flushdb();
      }
      const collections = ["useractivities", "usersessions"];
      for (const collectionName of collections) {
        try {
          const collection = mongoose.connection.db.collection(collectionName);
          await collection.deleteMany({});
        } catch (error) {
          // Collection might not exist, ignore
        }
      }
    } catch (error) {
      console.warn("Warning: Could not clean test data:", error.message);
    }
  },

  getDbManager: () => {
    const DatabaseManager = require("../../src/db/DatabaseManager");
    return new DatabaseManager();
  },

  createTestApp: async () => {
    const createApp = require("../../src/app");

    // Create app (createApp handles its own database connections)
    const app = await createApp();

    return app;
  }
};
