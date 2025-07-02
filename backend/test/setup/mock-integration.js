require("dotenv").config({ path: ".env.test" });

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-key-for-jwt-signing";
process.env.POSTGRES_URL = "postgresql://test:test@localhost:5432/test";
process.env.MONGODB_URL = "mongodb://localhost:27017/test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.MINIO_ENDPOINT = "localhost";
process.env.MINIO_PORT = "9000";
// MinIO credentials removed for anonymous access
process.env.MINIO_BUCKET = "test";
process.env.MAIL_HOST = "localhost";
process.env.MAIL_PORT = "1025";
process.env.MAIL_FROM = "test@example.com";
process.env.TEST_EMAIL_TO = "test@example.com";

// Global test timeout
jest.setTimeout(30000);

// Global test cleanup
afterAll(async () => {
  // Wait for any pending operations to complete
  await new Promise((resolve) => setTimeout(resolve, 100));
});

// Mock all services to return realistic API responses
jest.mock("../../src/services/UserService", () => {
  const mockUserService = {
    registerUser: jest.fn().mockImplementation(async (userData) => {
      // Simulate successful registration
      return {
        id: 1,
        email: userData.email,
        name: userData.name,
        is_verified: false,
        created_at: new Date().toISOString()
      };
    }),

    loginUser: jest.fn().mockImplementation(async (email, password) => {
      // Simulate successful login
      if (email === "test@example.com" && password === "TestPass123!") {
        return {
          user: {
            id: 1,
            email: "test@example.com",
            name: "Test User",
            is_verified: false
          },
          token: "mock.jwt.token.string"
        };
      }
      throw new Error("Invalid credentials");
    }),

    getUserProfile: jest.fn().mockResolvedValue({
      id: 1,
      email: "test@example.com",
      name: "Test User",
      is_verified: false,
      created_at: new Date().toISOString()
    }),

    getUserStats: jest.fn().mockResolvedValue({
      totalLogins: 5,
      lastLogin: new Date().toISOString(),
      accountAge: "30 days"
    }),

    logout: jest.fn().mockResolvedValue(true),
    verifyToken: jest.fn().mockImplementation(async (token) => {
      if (token === "mock.jwt.token.string") {
        return {
          userId: 1,
          email: "test@example.com",
          name: "Test User"
        };
      }
      return null;
    })
  };

  return jest.fn().mockImplementation(() => mockUserService);
});

// Mock route creation functions
jest.mock("../../src/routes/auth", () => {
  const express = require("express");
  const router = express.Router();

  // Mock auth routes
  router.post("/register", (req, res) => {
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({
        error: "Validation failed",
        details: [
          {
            path: !email ? "email" : !password ? "password" : "name",
            message: "Required"
          }
        ]
      });
    }

    if (!email.includes("@")) {
      return res.status(400).json({
        error: "Validation failed",
        details: [{ path: "email", message: "Invalid email format" }]
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Validation failed",
        details: [{ path: "password", message: "Password too short" }]
      });
    }

    if (name.length < 2) {
      return res.status(400).json({
        error: "Validation failed",
        details: [{ path: "name", message: "Name too short" }]
      });
    }

    res.status(201).json({
      user: { id: 1, email, name, is_verified: false },
      token: "mock.jwt.token.string"
    });
  });

  router.post("/login", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Validation failed",
        details: [{ path: !email ? "email" : "password", message: "Required" }]
      });
    }

    if (!email.includes("@")) {
      return res.status(400).json({
        error: "Validation failed",
        details: [{ path: "email", message: "Invalid email format" }]
      });
    }

    res.status(200).json({
      user: { id: 1, email, name: "Test User", is_verified: false },
      token: "mock.jwt.token.string"
    });
  });

  router.get("/profile", (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    res.json({ user: req.user });
  });

  router.get("/stats", (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    res.json({
      stats: { totalLogins: 5, lastLogin: new Date().toISOString() }
    });
  });

  return jest.fn().mockReturnValue(router);
});

jest.mock("../../src/routes/web3", () => {
  const express = require("express");
  const router = express.Router();

  // Mock web3 routes
  router.get("/stats/:contractAddress", (req, res) => {
    const { contractAddress } = req.params;
    res.json({
      contractAddress,
      txCount: 150,
      volume: 1234.56,
      uniqueUsers: 45,
      lastActivity: new Date().toISOString()
    });
  });

  router.post("/transactions", (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    res.status(201).json({
      id: "mock-tx-id",
      hash: req.body.txHash,
      status: "pending",
      timestamp: new Date().toISOString()
    });
  });

  router.get("/transactions", (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    res.json([
      {
        hash: "0x" + "1".repeat(64),
        value: "1000000000000000000",
        timestamp: new Date().toISOString(),
        status: "confirmed"
      }
    ]);
  });

  router.put("/transactions/:txHash/status", (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    res.json({
      hash: req.params.txHash,
      status: req.body.status,
      updatedAt: new Date().toISOString()
    });
  });

  return jest.fn().mockReturnValue(router);
});

jest.mock("../../src/routes/files", () => {
  const express = require("express");
  const router = express.Router();

  // Mock file routes
  router.post("/upload", (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    res.status(201).json({
      url: "https://test.com/file",
      fileName: "test-file-name",
      size: 1024,
      mimetype: "image/jpeg"
    });
  });

  return jest.fn().mockReturnValue(router);
});

jest.mock("../../src/services/Web3Service", () => {
  const mockWeb3Service = {
    getContractStats: jest.fn().mockImplementation(async (contractAddress) => {
      // Simulate contract stats based on address
      return {
        contractAddress,
        txCount: 150,
        volume: 1234.56,
        uniqueUsers: 45,
        lastActivity: new Date().toISOString()
      };
    }),

    recordTransaction: jest.fn().mockResolvedValue({
      id: "mock-tx-id",
      hash: "0x" + "1".repeat(64),
      status: "confirmed",
      timestamp: new Date().toISOString()
    }),

    getTransactionHistory: jest.fn().mockResolvedValue([
      {
        hash: "0x" + "1".repeat(64),
        value: "1000000000000000000",
        timestamp: new Date().toISOString(),
        status: "confirmed"
      }
    ])
  };

  return jest.fn().mockImplementation(() => mockWeb3Service);
});

// Mock auth middleware with proper initialization
jest.mock("../../src/middleware/auth", () => {
  // Create a mock UserService instance
  const mockUserService = {
    verifyToken: jest.fn().mockResolvedValue({
      id: 1,
      email: "test@example.com",
      name: "Test User",
      walletAddress: "0x1234567890abcdef"
    })
  };

  return {
    initializeAuth: jest.fn((databases) => {
      // Mock initialization - do nothing
      console.log("Mock initializeAuth called");
    }),
    authenticateToken: () => (req, res, next) => {
      // Mock authentication - always succeed
      req.user = {
        id: 1,
        email: "test@example.com",
        name: "Test User",
        walletAddress: "0x1234567890abcdef"
      };
      next();
    },
    requireAuth: () => (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      next();
    },
    optionalAuth: () => (req, res, next) => next(),
    requireRole: () => (req, res, next) => next(),
    rateLimit: () => (req, res, next) => next(),
    validateWalletOwnership: () => (req, res, next) => next()
  };
});

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
  createTransport: jest.fn().mockReturnValue({
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

// Suppress console output
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: console.error
};

// Mock integration setup for testing routes with mocked dependencies

// Mock all external dependencies
jest.mock("ioredis", () => {
  const mockRedis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue("OK"),
    setex: jest.fn().mockResolvedValue("OK"),
    del: jest.fn().mockResolvedValue(1),
    ping: jest.fn().mockResolvedValue("PONG"),
    quit: jest.fn().mockResolvedValue("OK"),
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(),
    disconnect: jest.fn().mockResolvedValue()
  };
  return jest.fn(() => mockRedis);
});

jest.mock("pg", () => {
  const mockPool = {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: jest.fn()
    }),
    end: jest.fn().mockResolvedValue(),
    on: jest.fn()
  };
  return { Pool: jest.fn(() => mockPool) };
});

jest.mock("mongoose", () => {
  const mockMongoose = {
    connect: jest.fn().mockResolvedValue(),
    disconnect: jest.fn().mockResolvedValue(),
    connection: {
      on: jest.fn(),
      once: jest.fn(),
      readyState: 1
    }
  };
  return mockMongoose;
});

jest.mock("minio", () => {
  const mockMinioClient = {
    bucketExists: jest.fn().mockResolvedValue(true),
    makeBucket: jest.fn().mockResolvedValue(),
    putObject: jest.fn().mockResolvedValue({ etag: "mock-etag" }),
    getObject: jest.fn().mockResolvedValue({ pipe: jest.fn() }),
    removeObject: jest.fn().mockResolvedValue(),
    listObjects: jest.fn().mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        yield {
          name: "test-file.jpg",
          size: 1024,
          lastModified: new Date()
        };
      }
    }),
    presignedGetObject: jest
      .fn()
      .mockResolvedValue("https://presigned-url.com"),
    statObject: jest.fn().mockResolvedValue({
      size: 1024,
      lastModified: new Date(),
      etag: "mock-etag"
    }),
    setBucketPolicy: jest.fn().mockResolvedValue(),
    listBuckets: jest.fn().mockResolvedValue([])
  };
  return { Client: jest.fn(() => mockMinioClient) };
});

jest.mock("bull", () => {
  const createMockQueue = () => ({
    on: jest.fn(),
    add: jest.fn().mockResolvedValue({ id: 1 }),
    process: jest.fn(),
    getWaiting: jest.fn().mockResolvedValue([]),
    getActive: jest.fn().mockResolvedValue([]),
    getCompleted: jest.fn().mockResolvedValue([]),
    getFailed: jest.fn().mockResolvedValue([]),
    getJobs: jest.fn().mockResolvedValue([]),
    close: jest.fn().mockResolvedValue(),
    pause: jest.fn().mockResolvedValue(),
    resume: jest.fn().mockResolvedValue(),
    isPaused: jest.fn().mockResolvedValue(false),
    getJob: jest.fn().mockResolvedValue({ retry: jest.fn() }),
    remove: jest.fn().mockResolvedValue(),
    repeat: {
      add: jest.fn().mockResolvedValue({ id: 1 })
    }
  });
  return jest.fn().mockImplementation(() => createMockQueue());
});

jest.mock("nodemailer", () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: "mock-message-id" }),
    verify: jest.fn().mockResolvedValue(true)
  })
}));

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn().mockReturnValue("mock-jwt-token"),
  verify: jest.fn().mockReturnValue({ userId: 1, tenantId: 123 }),
  decode: jest.fn().mockReturnValue({ userId: 1, tenantId: 123 })
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashed-password"),
  compare: jest.fn().mockResolvedValue(true),
  genSalt: jest.fn().mockResolvedValue("mock-salt")
}));

jest.mock("multer", () => {
  const mockSingle = jest.fn().mockReturnValue((req, res, next) => {
    req.file = {
      fieldname: "file",
      originalname: "test.jpg",
      encoding: "7bit",
      mimetype: "image/jpeg",
      size: 1024,
      buffer: Buffer.from("test content"),
      destination: "/tmp",
      filename: "test-123.jpg",
      path: "/tmp/test-123.jpg"
    };
    next();
  });

  const mockMulter = jest.fn().mockImplementation(() => ({
    single: mockSingle,
    array: jest.fn(),
    fields: jest.fn()
  }));

  mockMulter.memoryStorage = jest.fn().mockReturnValue({
    _handleFile: jest.fn(),
    _removeFile: jest.fn()
  });

  return mockMulter;
});

jest.mock("ethers", () => ({
  ethers: {
    verifyMessage: jest
      .fn()
      .mockReturnValue("0x1234567890123456789012345678901234567890"),
    getAddress: jest.fn().mockImplementation((address) => address),
    isAddress: jest.fn().mockReturnValue(true)
  }
}));

// Mock services
jest.mock("../../src/services/UserService", () => {
  return jest.fn().mockImplementation(() => ({
    createUser: jest.fn().mockResolvedValue({
      id: 1,
      email: "test@example.com",
      name: "Test User",
      tenantId: 123
    }),
    authenticateUser: jest.fn().mockResolvedValue({
      user: { id: 1, email: "test@example.com", tenantId: 123 },
      token: "mock-jwt-token"
    }),
    verifyToken: jest.fn().mockResolvedValue({
      userId: 1,
      email: "test@example.com",
      tenantId: 123
    }),
    createWalletChallenge: jest.fn().mockResolvedValue("mock-challenge"),
    verifyWalletSignature: jest.fn().mockResolvedValue({
      user: { id: 1, email: "test@example.com", tenantId: 123 },
      token: "mock-jwt-token"
    })
  }));
});

jest.mock("../../src/services/TenantService", () => {
  return jest.fn().mockImplementation(() => ({
    resolveTenantFromRequest: jest.fn().mockResolvedValue({
      id: 123,
      name: "Test Tenant",
      domain: "test.com"
    }),
    validateTenantAccess: jest.fn().mockResolvedValue(true),
    isFeatureEnabled: jest.fn().mockResolvedValue(true),
    getTenantById: jest.fn().mockResolvedValue({
      id: 123,
      name: "Test Tenant"
    })
  }));
});

jest.mock("../../src/services/Web3Service", () => {
  return jest.fn().mockImplementation(() => ({
    getContractStats: jest.fn().mockResolvedValue({
      totalTransactions: 100,
      uniqueUsers: 50,
      lastActivity: new Date()
    }),
    getUserTransactions: jest.fn().mockResolvedValue([
      {
        id: 1,
        hash: "0x123...",
        status: "confirmed",
        timestamp: new Date()
      }
    ])
  }));
});

jest.mock("../../src/services/MinIOService", () => {
  return jest.fn().mockImplementation(() => ({
    uploadFile: jest.fn().mockResolvedValue({
      fileName: "test-file.jpg",
      url: "https://example.com/test-file.jpg",
      size: 1024
    }),
    listUserFiles: jest.fn().mockResolvedValue([
      {
        name: "test-file.jpg",
        size: 1024,
        url: "https://example.com/test-file.jpg"
      }
    ])
  }));
});

jest.mock("../../src/services/EmailService", () => {
  return jest.fn().mockImplementation(() => ({
    sendVerificationEmail: jest.fn().mockResolvedValue(true),
    sendWelcomeEmail: jest.fn().mockResolvedValue(true),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true)
  }));
});

// Mock middleware
jest.mock("../../src/middleware/auth", () => ({
  initializeAuth: jest.fn(),
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { id: 1, email: "test@example.com", tenantId: 123 };
    next();
  }),
  createRateLimit: jest.fn(() => (req, res, next) => next()),
  requireAuth: jest.fn((req, res, next) => next()),
  optionalAuth: jest.fn((req, res, next) => next())
}));

jest.mock("../../src/middleware/tenant", () => ({
  initializeTenant: jest.fn(),
  resolveTenant: jest.fn((req, res, next) => {
    req.tenant = { id: 123, name: "Test Tenant" };
    req.tenantId = 123;
    next();
  }),
  requireTenant: jest.fn((req, res, next) => next()),
  validateTenantAccess: jest.fn((req, res, next) => next()),
  optionalTenant: jest.fn((req, res, next) => next())
}));

jest.mock("../../src/middleware/logging", () => ({
  initializeLogging: jest.fn(),
  logApiRequests: jest.fn((req, res, next) => next()),
  logSecurityEvents: jest.fn((req, res, next) => next()),
  performanceMonitor: jest.fn((req, res, next) => next()),
  errorLogger: jest.fn((req, res, next) => next())
}));

// Mock database manager
jest.mock("../../src/db/DatabaseManager", () => {
  return jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(),
    disconnect: jest.fn().mockResolvedValue(),
    databases: {
      postgres: {
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 })
      },
      redis: {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue("OK"),
        setex: jest.fn().mockResolvedValue("OK")
      },
      mongodb: {
        collection: jest.fn().mockReturnValue({
          find: jest
            .fn()
            .mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
          findOne: jest.fn().mockResolvedValue(null),
          insertOne: jest.fn().mockResolvedValue({ insertedId: "mock-id" }),
          updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
          deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 })
        })
      }
    }
  }));
});

// Mock environment variables
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.MONGODB_URI = "mongodb://localhost:27017/test";
process.env.MINIO_ENDPOINT = "localhost";
process.env.MINIO_PORT = "9000";
process.env.MINIO_ACCESS_KEY = "test";
process.env.MINIO_SECRET_KEY = "test";

// Global test utilities for mock integration tests
global.mockIntegrationUtils = {
  createMockRequest: (overrides = {}) => ({
    headers: {},
    body: {},
    query: {},
    params: {},
    ip: "127.0.0.1",
    method: "GET",
    path: "/api/test",
    ...overrides
  }),

  createMockResponse: () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      getHeader: jest.fn(),
      clearCookie: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis()
    };
    return res;
  },

  createMockNext: () => jest.fn(),

  createMockUser: (overrides = {}) => ({
    id: 1,
    userId: 1,
    email: "test@example.com",
    name: "Test User",
    tenantId: 123,
    role: "user",
    isAdmin: false,
    walletAddress: "0x1234567890123456789012345678901234567890",
    ...overrides
  }),

  createMockTenant: (overrides = {}) => ({
    id: 123,
    name: "Test Tenant",
    domain: "test.com",
    settings: {},
    features: ["wallet-auth", "file-upload"],
    ...overrides
  }),

  createMockApp: () => {
    const express = require("express");
    const app = express();

    // Add basic middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    return app;
  }
};

// Suppress console logs in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});
