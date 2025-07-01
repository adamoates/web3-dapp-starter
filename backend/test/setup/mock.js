// test/setup/mock.js - Mock everything for unit/mock-integration tests

// Mock database connections
jest.mock("pg", () => ({
  Pool: jest.fn(() => ({
    query: jest.fn().mockResolvedValue({ rows: [] }),
    connect: jest.fn().mockResolvedValue(true),
    end: jest.fn().mockResolvedValue(true)
  }))
}));

jest.mock("ioredis", () =>
  jest.fn(() => ({
    setex: jest.fn().mockResolvedValue("OK"),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue("OK"),
    exists: jest.fn().mockResolvedValue(0),
    flushdb: jest.fn().mockResolvedValue("OK")
  }))
);

jest.mock("minio");
jest.mock("mongoose");

// Mock bcrypt
jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("$2a$12$mocked.hash.value"),
  compare: jest.fn().mockResolvedValue(true)
}));

// Mock jsonwebtoken
jest.mock("jsonwebtoken", () => ({
  sign: jest.fn().mockReturnValue("mocked.jwt.token"),
  verify: jest.fn().mockReturnValue({
    userId: 1,
    type: "access",
    iat: 1234567890,
    exp: 1234654290
  })
}));

// Mock nodemailer
jest.mock("nodemailer", () => ({
  createTransporter: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({
      messageId: "test-message-id",
      response: "OK"
    })
  })
}));

// Mock DatabaseManager
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
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            id: 1,
            email: "test@example.com",
            name: "Test User",
            wallet_address: "0x1234567890abcdef",
            is_verified: false,
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      })
    },
    mongooseConnection: {
      db: {
        stats: jest.fn().mockResolvedValue({})
      }
    },
    redisClient: {
      set: jest.fn().mockResolvedValue("OK"),
      setex: jest.fn().mockResolvedValue("OK"),
      get: jest.fn().mockResolvedValue(
        JSON.stringify({
          id: 1,
          email: "test@example.com",
          name: "Test User",
          walletAddress: "0x1234567890abcdef"
        })
      ),
      del: jest.fn().mockResolvedValue(1),
      exists: jest.fn().mockResolvedValue(1)
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
      fileName: "test-file-name",
      size: 1024,
      mimetype: "image/jpeg"
    }),
    deleteFile: jest.fn().mockResolvedValue(true),
    ensureBucket: jest.fn().mockResolvedValue(true)
  }));
});

// Mock User model
jest.mock("../../src/models/sql/User", () => {
  return jest.fn().mockImplementation(() => ({
    create: jest.fn().mockResolvedValue({
      id: 1,
      email: "test@example.com",
      name: "Test User",
      wallet_address: "0x1234567890abcdef",
      is_verified: false,
      created_at: new Date()
    }),
    findByEmail: jest.fn().mockResolvedValue({
      id: 1,
      email: "test@example.com",
      name: "Test User",
      password_hash: "$2a$12$mocked.hash.value",
      wallet_address: "0x1234567890abcdef",
      is_verified: false,
      created_at: new Date()
    }),
    findById: jest.fn().mockResolvedValue({
      id: 1,
      email: "test@example.com",
      name: "Test User",
      wallet_address: "0x1234567890abcdef",
      is_verified: false,
      created_at: new Date()
    }),
    findByWallet: jest.fn().mockResolvedValue({
      id: 1,
      email: "test@example.com",
      name: "Test User",
      wallet_address: "0x1234567890abcdef",
      is_verified: false,
      created_at: new Date()
    }),
    linkWallet: jest.fn().mockResolvedValue({
      id: 1,
      email: "test@example.com",
      name: "Test User",
      wallet_address: "0x1234567890abcdef"
    }),
    updateProfile: jest.fn().mockResolvedValue({
      id: 1,
      email: "test@example.com",
      name: "Updated User",
      wallet_address: "0x1234567890abcdef",
      is_verified: false,
      created_at: new Date(),
      updated_at: new Date()
    }),
    validatePassword: jest.fn().mockResolvedValue(true),
    generateToken: jest.fn().mockReturnValue("mocked.jwt.token"),
    verifyToken: jest.fn().mockResolvedValue({ userId: 1, type: "access" })
  }));
});

// Mock UserActivity model
jest.mock("../../src/models/nosql/UserActivity", () => {
  const mockActivity = {
    userId: 1,
    action: "test_action",
    details: { test: "data" },
    ipAddress: "127.0.0.1",
    userAgent: "test-agent",
    save: jest.fn().mockResolvedValue(true)
  };

  return jest.fn().mockImplementation(() => mockActivity);
});

// Mock Transaction model
jest.mock("../../src/models/sql/Transaction", () => {
  return jest.fn().mockImplementation(() => ({
    create: jest.fn().mockResolvedValue({
      id: 1,
      user_id: 1,
      tx_hash: "0x1234567890abcdef",
      type: "transfer",
      amount: "100.0",
      status: "pending",
      created_at: new Date()
    }),
    findByHash: jest.fn().mockResolvedValue({
      id: 1,
      user_id: 1,
      tx_hash: "0x1234567890abcdef",
      type: "transfer",
      amount: "100.0",
      status: "pending",
      created_at: new Date()
    }),
    updateStatus: jest.fn().mockResolvedValue({
      id: 1,
      user_id: 1,
      tx_hash: "0x1234567890abcdef",
      type: "transfer",
      amount: "100.0",
      status: "confirmed",
      block_number: 12345,
      updated_at: new Date()
    }),
    getUserTransactions: jest.fn().mockResolvedValue([
      {
        id: 1,
        user_id: 1,
        tx_hash: "0x1234567890abcdef",
        type: "transfer",
        amount: "100.0",
        status: "pending",
        created_at: new Date()
      }
    ])
  }));
});

// Mock Web3Service
jest.mock("../../src/services/Web3Service", () => {
  return jest.fn().mockImplementation(() => ({
    recordTransaction: jest.fn().mockResolvedValue({
      id: 1,
      tx_hash: "0x1234567890abcdef",
      type: "transfer",
      amount: "100.0",
      status: "pending",
      created_at: new Date()
    }),
    updateTransactionStatus: jest.fn().mockResolvedValue({
      id: 1,
      tx_hash: "0x1234567890abcdef",
      type: "transfer",
      amount: "100.0",
      status: "confirmed",
      block_number: 12345,
      updated_at: new Date()
    }),
    getTransactionStatus: jest.fn().mockResolvedValue({
      tx_hash: "0x1234567890abcdef",
      status: "pending",
      block_number: null
    }),
    getUserTransactions: jest.fn().mockResolvedValue([
      {
        id: 1,
        tx_hash: "0x1234567890abcdef",
        type: "transfer",
        amount: "100.0",
        status: "pending",
        created_at: new Date()
      }
    ]),
    processPendingTransactions: jest.fn().mockResolvedValue(5),
    storeNFTMetadata: jest.fn().mockResolvedValue({
      _id: "mocked-nft-id",
      tokenId: "123",
      contractAddress: "0x1234567890abcdef",
      name: "Test NFT",
      owner: 1,
      isListed: false,
      lastUpdated: new Date()
    }),
    getNFTsByOwner: jest.fn().mockResolvedValue([
      {
        _id: "mocked-nft-id",
        tokenId: "123",
        contractAddress: "0x1234567890abcdef",
        name: "Test NFT",
        owner: 1,
        isListed: false,
        lastUpdated: new Date()
      }
    ]),
    getListedNFTs: jest.fn().mockResolvedValue([
      {
        _id: "mocked-nft-id",
        tokenId: "123",
        contractAddress: "0x1234567890abcdef",
        name: "Test NFT",
        owner: 1,
        isListed: true,
        listingPrice: "1.0",
        lastUpdated: new Date()
      }
    ]),
    getContractStats: jest.fn().mockResolvedValue({
      totalTransactions: 100,
      totalVolume: "10000.0",
      uniqueUsers: 50
    })
  }));
});

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-key-for-jwt-signing";
process.env.POSTGRES_URL = "postgresql://test:test@localhost:5432/test";
process.env.MONGODB_URL = "mongodb://localhost:27017/test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.MINIO_ENDPOINT = "localhost";
process.env.MINIO_PORT = "9000";
process.env.MINIO_ACCESS_KEY = "test";
process.env.MINIO_SECRET_KEY = "test";
process.env.MINIO_BUCKET = "test";
process.env.MAIL_HOST = "localhost";
process.env.MAIL_PORT = "1025";
process.env.MAIL_FROM = "test@example.com";
process.env.TEST_EMAIL_TO = "test@example.com";

// Global test timeout
jest.setTimeout(10000);
