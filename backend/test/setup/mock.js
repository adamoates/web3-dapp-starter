// test/setup/mock.js - Mock everything for unit/mock-integration tests

// Global test cleanup
afterAll(async () => {
  // Wait for any pending operations to complete
  await new Promise((resolve) => setTimeout(resolve, 100));
});

// Global mock setup for unit tests
const path = require("path");

// Comprehensive mock setup for all external dependencies

// Mongoose Schema Types Mock
jest.mock("mongoose", () => {
  const Schema = jest.fn().mockImplementation(() => ({
    index: jest.fn().mockReturnThis(),
    pre: jest.fn().mockReturnThis(),
    post: jest.fn().mockReturnThis(),
    virtual: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    get: jest.fn().mockReturnThis(),
    methods: {},
    statics: {}
  }));

  Schema.Types = {
    Mixed: "Mixed",
    String: "String",
    Number: "Number",
    Date: "Date",
    Boolean: "Boolean",
    ObjectId: "ObjectId",
    Array: "Array"
  };

  return {
    Schema,
    model: jest.fn().mockReturnValue({
      create: jest
        .fn()
        .mockResolvedValue({ id: "mock-id", email: "test@example.com" }),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([])
          })
        }),
        exec: jest.fn().mockResolvedValue([])
      }),
      findOne: jest
        .fn()
        .mockResolvedValue({ id: "mock-id", email: "test@example.com" }),
      findById: jest
        .fn()
        .mockResolvedValue({ id: "mock-id", email: "test@example.com" }),
      findByIdAndUpdate: jest
        .fn()
        .mockResolvedValue({ id: "mock-id", email: "test@example.com" }),
      findByIdAndDelete: jest
        .fn()
        .mockResolvedValue({ id: "mock-id", email: "test@example.com" }),
      aggregate: jest.fn().mockResolvedValue([]),
      save: jest
        .fn()
        .mockResolvedValue({ id: "mock-id", email: "test@example.com" }),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 1 })
    }),
    connect: jest.fn().mockResolvedValue({}),
    disconnect: jest.fn().mockResolvedValue({}),
    connection: {
      db: {
        admin: jest.fn().mockReturnValue({
          ping: jest.fn().mockResolvedValue({ ok: 1 })
        })
      }
    }
  };
});

// MinIO Client Mock
jest.mock("minio", () => ({
  Client: jest.fn().mockImplementation(() => ({
    bucketExists: jest.fn().mockResolvedValue(true),
    makeBucket: jest.fn().mockResolvedValue(true),
    presignedGetObject: jest.fn().mockResolvedValue("https://example.com/file"),
    removeObject: jest.fn().mockResolvedValue(true),
    listObjects: jest
      .fn()
      .mockReturnValue([
        { name: "test.jpg", size: 1024, lastModified: new Date() }
      ]),
    statObject: jest.fn().mockResolvedValue({
      size: 1024,
      lastModified: new Date(),
      etag: "mock-etag",
      metaData: { "content-type": "image/jpeg" }
    }),
    listBuckets: jest.fn().mockResolvedValue([{ name: "test-bucket" }]),
    putObject: jest.fn().mockResolvedValue(true),
    getObject: jest.fn().mockReturnValue({
      pipe: jest.fn().mockReturnThis(),
      on: jest.fn().mockReturnThis()
    })
  }))
}));

// Bull Queue Mock
jest.mock("bull", () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    add: jest.fn().mockResolvedValue({ id: "job-123", data: {} }),
    process: jest.fn(),
    close: jest.fn().mockResolvedValue(true),
    getJob: jest.fn().mockResolvedValue({ id: "job-123", data: {} }),
    getJobs: jest.fn().mockResolvedValue([]),
    clean: jest.fn().mockResolvedValue([]),
    getJobCounts: jest.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0
    }),
    remove: jest.fn().mockResolvedValue(true),
    pause: jest.fn().mockResolvedValue(true),
    resume: jest.fn().mockResolvedValue(true),
    empty: jest.fn().mockResolvedValue(true)
  }));
});

// Node.js Built-in Modules
jest.mock("crypto", () => ({
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue("random-hex-string-12345678")
  }),
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue("hashed-password")
  }),
  randomUUID: jest.fn().mockReturnValue("mock-uuid-1234-5678-9012-345678901234")
}));

jest.mock("path", () => ({
  extname: jest.fn().mockReturnValue(".jpg"),
  join: jest.fn().mockReturnValue("path/to/file"),
  basename: jest.fn().mockReturnValue("file.jpg"),
  dirname: jest.fn().mockReturnValue("path/to"),
  resolve: jest.fn().mockReturnValue("/absolute/path/to/file")
}));

// PostgreSQL Pool Mock
jest.mock("pg", () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn().mockResolvedValue({
      rows: [{ id: 1, email: "test@example.com" }],
      rowCount: 1
    }),
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({
        rows: [{ id: 1, email: "test@example.com" }],
        rowCount: 1
      }),
      release: jest.fn()
    }),
    end: jest.fn().mockResolvedValue(true),
    on: jest.fn(),
    off: jest.fn()
  }))
}));

// Redis Client Mock
jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue("cached-value"),
    set: jest.fn().mockResolvedValue("OK"),
    setex: jest.fn().mockResolvedValue("OK"),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(1),
    ping: jest.fn().mockResolvedValue("PONG"),
    quit: jest.fn().mockResolvedValue("OK"),
    on: jest.fn(),
    off: jest.fn(),
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true)
  }));
});

// Nodemailer Mock
jest.mock("nodemailer", () => ({
  createTransporter: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({
      messageId: "mock-message-id",
      response: "OK"
    }),
    verify: jest.fn().mockResolvedValue(true)
  })
}));

// Web3 Mock
jest.mock("web3", () => ({
  Web3: jest.fn().mockImplementation(() => ({
    eth: {
      getBalance: jest.fn().mockResolvedValue("1000000000000000000"),
      getTransactionCount: jest.fn().mockResolvedValue(5),
      sendTransaction: jest.fn().mockResolvedValue({
        transactionHash: "0x1234567890abcdef"
      }),
      getTransaction: jest.fn().mockResolvedValue({
        hash: "0x1234567890abcdef",
        blockNumber: 12345,
        gasUsed: 21000
      }),
      getBlock: jest.fn().mockResolvedValue({
        number: 12345,
        hash: "0xblockhash",
        timestamp: Math.floor(Date.now() / 1000)
      }),
      Contract: jest.fn().mockImplementation(() => ({
        methods: {
          balanceOf: jest.fn().mockReturnValue({
            call: jest.fn().mockResolvedValue("1000000000000000000")
          }),
          transfer: jest.fn().mockReturnValue({
            send: jest.fn().mockResolvedValue({
              transactionHash: "0x1234567890abcdef"
            })
          })
        },
        events: {
          Transfer: jest.fn().mockReturnValue({
            getPastEvents: jest.fn().mockResolvedValue([])
          })
        }
      }))
    },
    utils: {
      toWei: jest.fn().mockReturnValue("1000000000000000000"),
      fromWei: jest.fn().mockReturnValue("1"),
      toChecksumAddress: jest.fn().mockImplementation((addr) => addr),
      isAddress: jest.fn().mockReturnValue(true)
    }
  }))
}));

// Express Rate Limit Mock
jest.mock("express-rate-limit", () => {
  const rateLimit = jest.fn().mockImplementation(() => {
    return (req, res, next) => next();
  });

  return rateLimit;
});

// Multer Mock
jest.mock("multer", () => {
  const multer = jest.fn().mockImplementation(() => {
    return (req, res, next) => {
      req.file = {
        fieldname: "file",
        originalname: "test.jpg",
        encoding: "7bit",
        mimetype: "image/jpeg",
        size: 1024,
        destination: "/tmp",
        filename: "test-123.jpg",
        path: "/tmp/test-123.jpg",
        buffer: Buffer.from("test")
      };
      next();
    };
  });

  multer.memoryStorage = jest.fn().mockReturnValue({});
  multer.diskStorage = jest.fn().mockReturnValue({});

  return multer;
});

// Helmet Mock
jest.mock("helmet", () => {
  return jest.fn().mockImplementation(() => {
    return (req, res, next) => next();
  });
});

// CORS Mock
jest.mock("cors", () => {
  return jest.fn().mockImplementation(() => {
    return (req, res, next) => next();
  });
});

// JWT Mock
jest.mock("jsonwebtoken", () => ({
  sign: jest.fn().mockReturnValue("mock-jwt-token"),
  verify: jest.fn().mockImplementation((token, secret) => {
    if (token === "valid-token") {
      return { userId: 1, email: "test@example.com", tenantId: 1 };
    }
    throw new Error("Invalid token");
  }),
  decode: jest.fn().mockReturnValue({ userId: 1, email: "test@example.com" })
}));

// BCrypt Mock
jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashed-password"),
  compare: jest.fn().mockImplementation((password, hash) => {
    return Promise.resolve(password === "correct-password");
  }),
  genSalt: jest.fn().mockResolvedValue("salt")
}));

// UUID Mock
jest.mock("uuid", () => ({
  v4: jest.fn().mockReturnValue("mock-uuid-1234-5678-9012-345678901234"),
  validate: jest.fn().mockReturnValue(true)
}));

// Console Mock (to reduce noise in tests)
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Process Mock
process.env = {
  ...process.env,
  NODE_ENV: "test",
  JWT_SECRET: "test-secret",
  JWT_EXPIRES_IN: "24h",
  POSTGRES_HOST: "localhost",
  POSTGRES_PORT: "5433",
  POSTGRES_USER: "test_user",
  POSTGRES_PASSWORD: "test_password",
  POSTGRES_DB: "test_db",
  MONGODB_URI: "mongodb://localhost:27018/test_db",
  REDIS_HOST: "localhost",
  REDIS_PORT: "6380",
  MINIO_ENDPOINT: "localhost",
  MINIO_PORT: "9002",
  MINIO_ACCESS_KEY: "test-key",
  MINIO_SECRET_KEY: "test-secret",
  MINIO_BUCKET: "test-bucket"
};

module.exports = {
  // Export mock functions for use in tests
  mockMongoose: require("mongoose"),
  mockMinio: require("minio"),
  mockBull: require("bull"),
  mockCrypto: require("crypto"),
  mockPath: require("path"),
  mockPg: require("pg"),
  mockRedis: require("ioredis"),
  mockNodemailer: require("nodemailer"),
  mockWeb3: require("web3"),
  mockJwt: require("jsonwebtoken"),
  mockBcrypt: require("bcryptjs")
};

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

// Global test utilities
global.testUtils = {
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
  })
};

// Suppress console logs in tests unless explicitly needed
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

// Global test timeout
jest.setTimeout(10000);
