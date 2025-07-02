const { Pool } = require("pg");
const mongoose = require("mongoose");
const Redis = require("ioredis");
const Minio = require("minio");

// Database configuration based on environment
const getDatabaseConfig = () => {
  const env = process.env.NODE_ENV || "development";

  const config = {
    postgres: {
      host: process.env.POSTGRES_HOST || "localhost",
      port: parseInt(process.env.POSTGRES_PORT) || 5432,
      user: process.env.POSTGRES_USER || "postgres",
      password: process.env.POSTGRES_PASSWORD || "password",
      database: process.env.POSTGRES_DB || "dapp_db",
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    },
    mongo: {
      uri: process.env.MONGODB_URI || "mongodb://localhost:27017/dapp_db"
    },
    redis: {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT) || 6379
    },
    minio: {
      endPoint: process.env.MINIO_ENDPOINT || "localhost",
      port: parseInt(process.env.MINIO_PORT) || 9000,
      useSSL: process.env.MINIO_USE_SSL === "true",
      accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
      secretKey: process.env.MINIO_SECRET_KEY || "minioadmin"
    }
  };

  // Override with test config if in test environment
  if (env === "test") {
    config.postgres = {
      ...config.postgres,
      host: process.env.POSTGRES_HOST || "localhost",
      port: parseInt(process.env.POSTGRES_PORT) || 5433,
      user: process.env.POSTGRES_USER || "test_user",
      password: process.env.POSTGRES_PASSWORD || "test_password",
      database: process.env.POSTGRES_DB || "test_db"
    };
    config.mongo.uri =
      process.env.MONGODB_URI || "mongodb://localhost:27018/test_db";
    config.redis = {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT) || 6380
    };
    config.minio = {
      ...config.minio,
      endPoint: process.env.MINIO_ENDPOINT || "localhost",
      port: parseInt(process.env.MINIO_PORT) || 9002
    };
  }

  return config;
};

let postgresPool = null;
let mongoConnection = null;
let redisClient = null;
let minioClient = null;

function setupDatabase() {
  const config = getDatabaseConfig();

  // Initialize PostgreSQL
  if (!postgresPool) {
    postgresPool = new Pool(config.postgres);
    console.log("✅ PostgreSQL pool initialized");
  }

  // Initialize MongoDB
  if (!mongoConnection) {
    mongoConnection = mongoose.connect(config.mongo.uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false
    });
    console.log("✅ MongoDB connection initialized");
  }

  // Initialize Redis
  if (!redisClient) {
    redisClient = new Redis(config.redis);
    console.log("✅ Redis client initialized");
  }

  // Initialize MinIO
  if (!minioClient) {
    minioClient = new Minio.Client(config.minio);
    console.log("✅ MinIO client initialized");
  }

  return {
    postgres: postgresPool,
    mongo: mongoConnection,
    redis: redisClient,
    minio: minioClient
  };
}

function getDatabase() {
  if (!postgresPool || !mongoConnection || !redisClient || !minioClient) {
    return setupDatabase();
  }

  return {
    postgres: postgresPool,
    mongo: mongoConnection,
    redis: redisClient,
    minio: minioClient
  };
}

async function closeDatabase() {
  console.log("🧹 Closing database connections...");

  try {
    if (postgresPool) {
      await postgresPool.end();
      postgresPool = null;
      console.log("✅ PostgreSQL pool closed");
    }

    if (mongoConnection) {
      await mongoose.disconnect();
      mongoConnection = null;
      console.log("✅ MongoDB connection closed");
    }

    if (redisClient) {
      await redisClient.quit();
      redisClient = null;
      console.log("✅ Redis client closed");
    }

    minioClient = null;
    console.log("✅ MinIO client closed");

    console.log("🎉 All database connections closed successfully!");
  } catch (error) {
    console.error("❌ Error closing database connections:", error);
    throw error;
  }
}

module.exports = {
  setupDatabase,
  getDatabase,
  closeDatabase,
  getDatabaseConfig
};
