#!/usr/bin/env node

const { Pool } = require("pg");
const mongoose = require("mongoose");
const Redis = require("ioredis");
const Minio = require("minio");
const bcrypt = require("bcryptjs");
const { faker } = require("@faker-js/faker");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

// Database configuration
const config = {
  postgres: {
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT) || 5432,
    user: process.env.POSTGRES_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD || "password",
    database: process.env.POSTGRES_DB || "dapp"
  },
  mongo: {
    uri: process.env.MONGODB_URI || "mongodb://localhost:27017/dapp"
  },
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT) || 6379
  },
  minio: {
    endPoint: process.env.MINIO_ENDPOINT || "localhost",
    port: parseInt(process.env.MINIO_PORT) || 9000,
    useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
    secretKey: process.env.MINIO_SECRET_KEY || "minioadmin"
  }
};

let postgresPool;
let mongoConnection;
let redisClient;
let minioClient;

async function connectDatabases() {
  console.log("🔌 Connecting to databases...");

  // PostgreSQL
  postgresPool = new Pool(config.postgres);
  await postgresPool.query("SELECT NOW()");
  console.log("✅ PostgreSQL connected");

  // MongoDB
  mongoConnection = await mongoose.connect(config.mongo.uri);
  console.log("✅ MongoDB connected");

  // Redis
  redisClient = new Redis(config.redis);
  await redisClient.ping();
  console.log("✅ Redis connected");

  // MinIO
  minioClient = new Minio.Client(config.minio);
  await minioClient.listBuckets();
  console.log("✅ MinIO connected");
}

async function seedTenants() {
  console.log("🏢 Seeding tenants...");

  // Clear existing data in correct order (respecting foreign keys)
  await postgresPool.query("DELETE FROM users");
  await postgresPool.query("DELETE FROM transactions");
  await postgresPool.query("DELETE FROM tenants");

  const tenants = [
    {
      name: "Default Tenant",
      slug: "default",
      domain: "localhost:5001",
      status: "active",
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      name: "Test Tenant",
      slug: "test",
      domain: "test.localhost:5001",
      status: "active",
      created_at: new Date(),
      updated_at: new Date()
    }
  ];

  for (const tenant of tenants) {
    await postgresPool.query(
      `
      INSERT INTO tenants (name, slug, domain, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (slug) DO NOTHING
    `,
      [
        tenant.name,
        tenant.slug,
        tenant.domain,
        tenant.status,
        tenant.created_at,
        tenant.updated_at
      ]
    );
  }

  console.log(`✅ Created ${tenants.length} tenants`);
  return tenants;
}

async function seedUsers() {
  console.log("👥 Seeding users...");

  const users = [];
  const hashedPassword = await bcrypt.hash("TestPass123!", 10);

  // Create test users
  for (let i = 0; i < 10; i++) {
    const user = {
      email: faker.internet.email(),
      password_hash: hashedPassword,
      name: faker.person.fullName(),
      wallet_address: `0x${faker.string.alphanumeric(40)}`,
      is_verified: faker.datatype.boolean(),
      created_at: faker.date.past(),
      updated_at: new Date()
    };
    users.push(user);
  }

  // Get default tenant ID
  const tenantResult = await postgresPool.query(
    "SELECT id FROM tenants WHERE slug = 'default' LIMIT 1"
  );
  const defaultTenantId = tenantResult.rows[0]?.id;

  if (!defaultTenantId) {
    throw new Error(
      "Default tenant not found. Please ensure tenants are seeded first."
    );
  }

  // Insert users
  for (const user of users) {
    await postgresPool.query(
      `
      INSERT INTO users (email, password_hash, name, wallet_address, is_verified, created_at, updated_at, tenant_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (email) DO NOTHING
    `,
      [
        user.email,
        user.password_hash,
        user.name,
        user.wallet_address,
        user.is_verified,
        user.created_at,
        user.updated_at,
        defaultTenantId
      ]
    );
  }

  console.log(`✅ Created ${users.length} users`);
  return users;
}

async function seedTransactions() {
  console.log("💰 Seeding transactions...");

  // Get user IDs and tenant IDs
  const userResult = await postgresPool.query(
    "SELECT id, tenant_id FROM users LIMIT 5"
  );
  const users = userResult.rows; // [{id, tenant_id}, ...]

  const transactions = [];
  const types = ["transfer", "mint", "burn", "swap", "stake", "unstake"];
  const statuses = ["pending", "confirmed", "failed"];

  for (let i = 0; i < 50; i++) {
    const user = faker.helpers.arrayElement(users);
    const transaction = {
      user_id: user.id,
      tenant_id: user.tenant_id,
      tx_hash: `0x${faker.string.alphanumeric(64)}`,
      type: faker.helpers.arrayElement(types),
      amount: faker.number
        .float({ min: 0.1, max: 1000, precision: 0.01 })
        .toString(),
      status: faker.helpers.arrayElement(statuses),
      created_at: faker.date.past()
    };
    transactions.push(transaction);
  }

  // Insert transactions
  for (const tx of transactions) {
    await postgresPool.query(
      `
      INSERT INTO transactions (user_id, tx_hash, type, amount, status, created_at, tenant_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (tx_hash) DO NOTHING
    `,
      [
        tx.user_id,
        tx.tx_hash,
        tx.type,
        tx.amount,
        tx.status,
        tx.created_at,
        tx.tenant_id
      ]
    );
  }

  console.log(`✅ Created ${transactions.length} transactions`);
  return transactions;
}

async function seedBlockchainEvents() {
  console.log("🔗 Seeding blockchain events...");

  const BlockchainEvent = require("../src/models/nosql/BlockchainEvent");

  // Clear existing events
  await BlockchainEvent.deleteMany({});

  const events = [];
  const eventTypes = ["Transfer", "Mint", "Burn", "Approval", "Swap"];
  const contractAddresses = [
    "0x1234567890abcdef1234567890abcdef12345678",
    "0xabcdef1234567890abcdef1234567890abcdef12",
    "0x9876543210fedcba9876543210fedcba98765432"
  ];

  for (let i = 0; i < 100; i++) {
    const event = {
      eventName: faker.helpers.arrayElement(eventTypes),
      contractAddress: faker.helpers.arrayElement(contractAddresses),
      tokenId: faker.number.int({ min: 1, max: 999999 }).toString(),
      from: `0x${faker.string.alphanumeric(40)}`,
      to: `0x${faker.string.alphanumeric(40)}`,
      blockNumber: faker.number.int({ min: 1000, max: 999999 }),
      transactionHash: `0x${faker.string.alphanumeric(64)}`,
      timestamp: faker.date.past(),
      value: faker.number
        .float({ min: 0.001, max: 100, precision: 0.001 })
        .toString(),
      gasUsed: faker.number.int({ min: 21000, max: 1000000 }),
      gasPrice: faker.number
        .int({ min: 1000000000, max: 100000000000 })
        .toString()
    };
    events.push(event);
  }

  await BlockchainEvent.insertMany(events);
  console.log(`✅ Created ${events.length} blockchain events`);
  return events;
}

async function seedNFTMetadata() {
  console.log("🖼️ Seeding NFT metadata...");

  const NFTMetadata = require("../src/models/nosql/NFTMetadata");

  // Clear existing metadata
  await NFTMetadata.deleteMany({});

  const metadata = [];
  const collections = [
    "Bored Apes",
    "CryptoPunks",
    "Doodles",
    "Azuki",
    "Moonbirds"
  ];
  const rarities = ["Common", "Rare", "Epic", "Legendary"];

  for (let i = 0; i < 50; i++) {
    const nft = {
      tokenId: faker.number.int({ min: 1, max: 999999 }).toString(),
      contractAddress: `0x${faker.string.alphanumeric(40)}`,
      name: `${faker.helpers.arrayElement(collections)} #${faker.number.int({
        min: 1,
        max: 10000
      })}`,
      description: faker.lorem.paragraph(),
      image: faker.image.url(),
      externalUrl: faker.internet.url(),
      attributes: [
        { trait_type: "Rarity", value: faker.helpers.arrayElement(rarities) },
        { trait_type: "Level", value: faker.number.int({ min: 1, max: 100 }) },
        { trait_type: "Power", value: faker.number.int({ min: 10, max: 1000 }) }
      ],
      owner: faker.number.int({ min: 1, max: 1000 }),
      metadata: {
        additional: faker.lorem.sentence(),
        collection: faker.helpers.arrayElement(collections)
      },
      network: "ethereum",
      tokenStandard: faker.helpers.arrayElement(["ERC-721", "ERC-1155"]),
      isListed: faker.datatype.boolean(),
      listingPrice: faker.number
        .float({ min: 0.01, max: 100, precision: 0.01 })
        .toString(),
      createdAt: faker.date.past(),
      updatedAt: new Date()
    };
    metadata.push(nft);
  }

  await NFTMetadata.insertMany(metadata);
  console.log(`✅ Created ${metadata.length} NFT metadata entries`);
  return metadata;
}

async function seedUserActivity() {
  console.log("📊 Seeding user activity...");

  const UserActivity = require("../src/models/nosql/UserActivity").Model;

  // Clear existing activity
  await UserActivity.deleteMany({});

  // Get default tenant ID
  const tenantResult = await postgresPool.query(
    "SELECT id FROM tenants WHERE slug = 'default' LIMIT 1"
  );
  const defaultTenantId = tenantResult.rows[0]?.id;
  if (!defaultTenantId) {
    throw new Error(
      "Default tenant not found. Please ensure tenants are seeded first."
    );
  }

  const activities = [];
  const activityTypes = [
    "login",
    "logout",
    "transaction",
    "nft_mint",
    "nft_transfer",
    "wallet_connect"
  ];

  for (let i = 0; i < 200; i++) {
    const activity = {
      userId: faker.number.int({ min: 1, max: 1000 }),
      tenantId: defaultTenantId,
      action: faker.helpers.arrayElement(activityTypes),
      description: faker.lorem.sentence(),
      metadata: {
        ip: faker.internet.ip(),
        userAgent: faker.internet.userAgent(),
        location: faker.location.city(),
        device: faker.helpers.arrayElement(["desktop", "mobile", "tablet"])
      },
      timestamp: faker.date.past(),
      sessionId: faker.string.uuid(),
      walletAddress: `0x${faker.string.alphanumeric(40)}`
    };
    activities.push(activity);
  }

  await UserActivity.insertMany(activities);
  console.log(`✅ Created ${activities.length} user activity records`);
  return activities;
}

async function setupMinIOBuckets() {
  console.log("🪣 Setting up MinIO buckets...");

  const buckets = ["avatars", "nft-assets", "documents", "test-bucket"];

  for (const bucket of buckets) {
    try {
      const exists = await minioClient.bucketExists(bucket);
      if (!exists) {
        await minioClient.makeBucket(bucket);
        console.log(`✅ Created bucket: ${bucket}`);
      } else {
        console.log(`ℹ️ Bucket already exists: ${bucket}`);
      }
    } catch (error) {
      console.log(`⚠️ Error with bucket ${bucket}: ${error.message}`);
    }
  }
}

async function seedRedisData() {
  console.log("🔴 Seeding Redis data...");

  // Seed some test cache data
  const cacheData = {
    "user:1:profile": JSON.stringify({
      id: 1,
      name: "Test User",
      email: "test@example.com",
      walletAddress: "0x1234567890abcdef1234567890abcdef12345678"
    }),
    "stats:global": JSON.stringify({
      totalUsers: 10,
      totalTransactions: 50,
      totalNFTs: 25,
      totalVolume: "1234.56"
    }),
    "recent:transactions": JSON.stringify([
      { txHash: "0xabc123", type: "transfer", amount: "1.5" },
      { txHash: "0xdef456", type: "mint", amount: "0.1" }
    ])
  };

  for (const [key, value] of Object.entries(cacheData)) {
    await redisClient.set(key, value, "EX", 3600); // 1 hour expiry
  }

  console.log(`✅ Seeded ${Object.keys(cacheData).length} Redis keys`);
}

async function runMigrations() {
  console.log("📦 Running migrations...");

  try {
    const migrationPath = path.join(__dirname, "migrate.js");
    const { execSync } = require("child_process");

    execSync(`node ${migrationPath} migrate`, {
      env: {
        ...process.env,
        DATABASE_URL: `postgresql://${config.postgres.user}:${config.postgres.password}@${config.postgres.host}:${config.postgres.port}/${config.postgres.database}`
      },
      stdio: "pipe"
    });

    console.log("✅ Migrations completed");
  } catch (error) {
    console.warn("⚠️ Migration failed, creating basic schema...");

    // Fallback: Create basic tables
    await postgresPool.query(`
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

    await postgresPool.query(`
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

    console.log("✅ Basic schema created");
  }
}

async function main() {
  try {
    console.log("🚀 Starting database seeding...");

    await connectDatabases();
    await runMigrations();
    await setupMinIOBuckets();

    // Seed data
    await seedTenants();
    await seedUsers();
    await seedTransactions();
    await seedBlockchainEvents();
    await seedNFTMetadata();
    await seedUserActivity();
    await seedRedisData();

    console.log("\n🎉 Seeding completed successfully!");
    console.log("\n📊 Seeded data summary:");
    console.log("   • 10 users with wallet addresses");
    console.log("   • 50 transactions");
    console.log("   • 100 blockchain events");
    console.log("   • 50 NFT metadata entries");
    console.log("   • 200 user activity records");
    console.log("   • Redis cache data");
    console.log("   • MinIO buckets");

    console.log("\n🔗 You can now test your frontend with this data!");
    console.log(
      "   • Use any of the seeded user emails with password: TestPass123!"
    );
    console.log("   • Blockchain events are available for Web3 testing");
    console.log("   • NFT metadata is ready for marketplace features");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    // Close connections
    if (postgresPool) await postgresPool.end();
    if (mongoConnection) await mongoose.disconnect();
    if (redisClient) await redisClient.quit();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };
