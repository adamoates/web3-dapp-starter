const { Pool } = require("pg");
const mongoose = require("mongoose");
const Redis = require("ioredis");
const Minio = require("minio");
const fs = require("fs");
const path = require("path");

// Test database configuration
const TEST_CONFIG = {
  postgres: {
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT) || 5433,
    user: process.env.POSTGRES_USER || "test_user",
    password: process.env.POSTGRES_PASSWORD || "test_password",
    database: process.env.POSTGRES_DB || "test_db"
  },
  mongo: {
    uri: process.env.MONGODB_URI || "mongodb://localhost:27018/test_db"
  },
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT) || 6380
  },
  minio: {
    endPoint: process.env.MINIO_ENDPOINT || "localhost",
    port: parseInt(process.env.MINIO_PORT) || 9002,
    useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
    secretKey: process.env.MINIO_SECRET_KEY || "minioadmin"
  }
};

let postgresPool;
let mongoConnection;
let redisClient;
let minioClient;

async function waitForServices() {
  console.log("🔄 Waiting for test services to be ready...");

  // Wait for PostgreSQL
  let retries = 0;
  while (retries < 30) {
    try {
      const pool = new Pool(TEST_CONFIG.postgres);
      await pool.query("SELECT NOW()");
      await pool.end();
      console.log("✅ PostgreSQL is ready");
      break;
    } catch (error) {
      retries++;
      if (retries >= 30) {
        throw new Error("PostgreSQL failed to start after 30 attempts");
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Wait for MongoDB
  retries = 0;
  while (retries < 30) {
    try {
      await mongoose.connect(TEST_CONFIG.mongo.uri, {
        serverSelectionTimeoutMS: 5000
      });
      await mongoose.disconnect();
      console.log("✅ MongoDB is ready");
      break;
    } catch (error) {
      retries++;
      if (retries >= 30) {
        throw new Error("MongoDB failed to start after 30 attempts");
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Wait for Redis
  retries = 0;
  while (retries < 30) {
    try {
      const redis = new Redis(TEST_CONFIG.redis);
      await redis.ping();
      await redis.quit();
      console.log("✅ Redis is ready");
      break;
    } catch (error) {
      retries++;
      if (retries >= 30) {
        throw new Error("Redis failed to start after 30 attempts");
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Wait for MinIO
  retries = 0;
  while (retries < 30) {
    try {
      const minio = new Minio.Client(TEST_CONFIG.minio);
      await minio.listBuckets();
      console.log("✅ MinIO is ready");
      break;
    } catch (error) {
      retries++;
      if (retries >= 30) {
        throw new Error("MinIO failed to start after 30 attempts");
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

async function setupDatabase() {
  console.log("🔧 Setting up test database connections...");

  // Initialize PostgreSQL
  postgresPool = new Pool(TEST_CONFIG.postgres);
  await postgresPool.query("SELECT NOW()");
  console.log("✅ PostgreSQL connected");

  // Initialize MongoDB
  mongoConnection = await mongoose.connect(TEST_CONFIG.mongo.uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    bufferCommands: false
  });
  console.log("✅ MongoDB connected");

  // Initialize Redis
  redisClient = new Redis(TEST_CONFIG.redis);
  await redisClient.ping();
  console.log("✅ Redis connected");

  // Initialize MinIO
  minioClient = new Minio.Client(TEST_CONFIG.minio);
  await minioClient.listBuckets();
  console.log("✅ MinIO connected");

  // Run PostgreSQL migrations
  console.log("📦 Running PostgreSQL migrations...");
  const migrationsDir = path.join(__dirname, "../migrations");
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const migrationPath = path.join(migrationsDir, file);
    const migrationSQL = fs.readFileSync(migrationPath, "utf8");

    // Extract only the "Up migration" part
    const upMigrationMatch = migrationSQL.match(
      /-- Up migration\s*([\s\S]*?)(?=-- Down migration|$)/i
    );

    if (upMigrationMatch) {
      const upMigration = upMigrationMatch[1].trim();
      if (upMigration) {
        try {
          await postgresPool.query(upMigration);
          console.log(`✅ Applied migration: ${file}`);
        } catch (error) {
          // Handle "already exists" errors gracefully
          if (
            error.code === "42710" ||
            error.message.includes("already exists")
          ) {
            console.log(
              `ℹ️ Migration ${file} already applied: ${error.message}`
            );
          } else {
            console.error(`❌ Migration ${file} failed: ${error.message}`);
            throw error;
          }
        }
      }
    }
  }

  // Set up MinIO buckets
  console.log("📦 Setting up MinIO buckets...");
  const buckets = ["test-bucket", "avatars", "nft-assets", "documents"];
  for (const bucket of buckets) {
    try {
      const exists = await minioClient.bucketExists(bucket);
      if (!exists) {
        await minioClient.makeBucket(bucket);
        console.log(`✅ Created MinIO bucket: ${bucket}`);
      }
    } catch (error) {
      console.log(
        `ℹ️ Bucket ${bucket} already exists or error: ${error.message}`
      );
    }
  }

  console.log("🎉 Test database setup complete!");
}

module.exports = async () => {
  console.log("🚀 Starting global test setup...");

  // Check if we're running unit or mock tests (which don't need real databases)
  const isUnitTest =
    process.argv.includes("--selectProjects") && process.argv.includes("unit");
  const isMockTest =
    process.argv.includes("--selectProjects") &&
    process.argv.includes("mock-integration");

  if (isUnitTest || isMockTest) {
    console.log(
      `📝 ${
        isUnitTest ? "Unit" : "Mock integration"
      } tests detected - skipping database setup`
    );
    global.__TEST_DB__ = {
      postgres: null,
      mongo: null,
      redis: null,
      minio: null
    };
    console.log("✅ Global test setup completed for mock tests!");
    return;
  }

  try {
    await waitForServices();
    await setupDatabase();

    // Store connections globally for tests to use
    global.__TEST_DB__ = {
      postgres: postgresPool,
      mongo: mongoConnection,
      redis: redisClient,
      minio: minioClient
    };

    console.log("✅ Global test setup completed successfully!");
  } catch (error) {
    console.error("❌ Global test setup failed:", error);
    throw error;
  }
};
