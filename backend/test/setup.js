// Test setup file

// Mock database connections for testing
jest.mock("../src/db/DatabaseManager", () => {
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

// Mock nodemailer
jest.mock("nodemailer", () => ({
  createTransporter: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({
      messageId: "test-message-id"
    })
  })
}));

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-key";
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
jest.setTimeout(10000);
