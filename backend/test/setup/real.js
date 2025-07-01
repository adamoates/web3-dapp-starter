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
  "postgresql://testuser:testpass@localhost:5433/test_dapp";
process.env.TEST_MONGO_URI =
  process.env.TEST_MONGO_URI || "mongodb://localhost:27018/test_dapp";
process.env.TEST_REDIS_URI =
  process.env.TEST_REDIS_URI || "redis://localhost:6380/1";
process.env.MINIO_ENDPOINT = "localhost";
process.env.MINIO_PORT = "9000";
process.env.MINIO_ACCESS_KEY = "minioadmin";
process.env.MINIO_SECRET_KEY = "minioadmin";
process.env.MINIO_BUCKET = "dapp-test";
process.env.MAIL_HOST = "localhost";
process.env.MAIL_PORT = "1025";
process.env.MAIL_FROM = "test@example.com";
process.env.TEST_EMAIL_TO = "test@example.com";

// Global test timeout for real DB tests
jest.setTimeout(30000);

let testPool;
let testRedis;
let isSetupComplete = false;

// Enhanced database setup with retries and health checks
beforeAll(async () => {
  if (isSetupComplete) return;

  try {
    console.log("🔧 Setting up integration test environment...");

    // Wait for Docker services with retries
    await waitForServices();

    // Setup PostgreSQL with migration
    await setupPostgreSQL();

    // Setup MongoDB with seeded data
    await setupMongoDB();

    // Setup Redis
    await setupRedis();

    console.log("✅ Integration test environment ready");
    isSetupComplete = true;
  } catch (error) {
    console.error("❌ Integration test setup failed:", error);
    throw error;
  }
}, 120000); // 2 minute timeout

async function waitForServices() {
  const maxRetries = 20;
  const retryDelay = 3000;

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
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    connectTimeout: 10000
  });

  await testRedis.ping();
  console.log("✅ Redis connected");
}

async function seedBlockchainEvents() {
  try {
    // Define blockchain event schema
    const blockchainEventSchema = new mongoose.Schema({
      contractAddress: { type: String, required: true, index: true },
      eventName: { type: String, required: true },
      blockNumber: { type: Number, required: true },
      transactionHash: { type: String, required: true, unique: true },
      eventData: { type: mongoose.Schema.Types.Mixed },
      createdAt: { type: Date, default: Date.now }
    });

    const BlockchainEvent =
      mongoose.models.BlockchainEvent ||
      mongoose.model("BlockchainEvent", blockchainEventSchema);

    // Clear existing events
    await BlockchainEvent.deleteMany({});

    // Seed test data for web3 stats
    const testContractAddress = "0x" + "2".repeat(40);
    const events = [
      {
        contractAddress: testContractAddress,
        eventName: "Transfer",
        blockNumber: 12345,
        transactionHash: "0x" + "1".repeat(64),
        eventData: { from: "0x123", to: "0x456", value: "1000000000000000000" }
      },
      {
        contractAddress: testContractAddress,
        eventName: "Transfer",
        blockNumber: 12346,
        transactionHash: "0x" + "2".repeat(64),
        eventData: { from: "0x456", to: "0x789", value: "500000000000000000" }
      },
      {
        contractAddress: testContractAddress,
        eventName: "Approval",
        blockNumber: 12347,
        transactionHash: "0x" + "3".repeat(64),
        eventData: {
          owner: "0x123",
          spender: "0x789",
          value: "1000000000000000000"
        }
      }
    ];

    await BlockchainEvent.insertMany(events);
    console.log(`✅ Seeded ${events.length} blockchain events`);
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
  getTestMongoose: () => mongoose.connection
};
