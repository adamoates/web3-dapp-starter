const {
  setupDatabase,
  getDatabase,
  closeDatabase,
  getDatabaseConfig
} = require("../../src/database");

// Mock dependencies
jest.mock("pg");
jest.mock("mongoose");
jest.mock("ioredis");
jest.mock("minio");

describe("Database Module", () => {
  let mockPool;
  let mockMongoose;
  let mockRedis;
  let mockMinio;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Pool
    mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      end: jest.fn().mockResolvedValue(true)
    };
    require("pg").Pool.mockImplementation(() => mockPool);

    // Mock Mongoose
    mockMongoose = {
      connect: jest.fn().mockResolvedValue({}),
      disconnect: jest.fn().mockResolvedValue(true)
    };
    require("mongoose").connect = mockMongoose.connect;
    require("mongoose").disconnect = mockMongoose.disconnect;

    // Mock Redis
    mockRedis = {
      set: jest.fn().mockResolvedValue("OK"),
      get: jest.fn().mockResolvedValue("value"),
      quit: jest.fn().mockResolvedValue("OK")
    };
    require("ioredis").mockImplementation(() => mockRedis);

    // Mock MinIO
    mockMinio = {
      Client: jest.fn().mockImplementation(() => ({
        listBuckets: jest.fn().mockResolvedValue([])
      }))
    };
    require("minio").Client = mockMinio.Client;
  });

  describe("getDatabaseConfig", () => {
    it("should return development config by default", () => {
      const config = getDatabaseConfig();

      expect(config.postgres).toBeDefined();
      expect(config.mongo).toBeDefined();
      expect(config.redis).toBeDefined();
      expect(config.minio).toBeDefined();
      expect(config.postgres.host).toBe("localhost");
      expect(config.postgres.port).toBe(5432);
      expect(config.minio.port).toBe(9000);
    });

    it("should return test config when NODE_ENV is test", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "test";

      const config = getDatabaseConfig();

      expect(config.postgres.port).toBe(5433);
      expect(config.mongo.uri).toContain("27018");
      expect(config.redis.port).toBe(6380);
      expect(config.minio.port).toBe(9002);

      process.env.NODE_ENV = originalEnv;
    });

    it("should use environment variables when provided", () => {
      const originalEnv = process.env.POSTGRES_HOST;
      process.env.POSTGRES_HOST = "custom-host";
      process.env.POSTGRES_PORT = "5433";

      const config = getDatabaseConfig();

      expect(config.postgres.host).toBe("custom-host");
      expect(config.postgres.port).toBe(5433);

      process.env.POSTGRES_HOST = originalEnv;
      delete process.env.POSTGRES_PORT;
    });
  });

  describe("setupDatabase", () => {
    it("should initialize all database connections", () => {
      const databases = setupDatabase();

      expect(databases.postgres).toBeDefined();
      expect(databases.mongo).toBeDefined();
      expect(databases.redis).toBeDefined();
      expect(databases.minio).toBeDefined();
      expect(require("pg").Pool).toHaveBeenCalled();
      expect(mockMongoose.connect).toHaveBeenCalled();
      expect(require("ioredis")).toHaveBeenCalled();
      expect(mockMinio.Client).toHaveBeenCalled();
    });

    it("should reuse existing connections on subsequent calls", () => {
      const databases1 = setupDatabase();
      const databases2 = setupDatabase();

      expect(databases1).toEqual(databases2);
      expect(require("pg").Pool).toHaveBeenCalledTimes(1);
    });
  });

  describe("getDatabase", () => {
    it("should return existing connections if available", () => {
      const databases1 = setupDatabase();
      const databases2 = getDatabase();

      expect(databases2).toEqual(databases1);
    });

    it("should setup new connections if none exist", () => {
      const databases = getDatabase();

      expect(databases.postgres).toBeDefined();
      expect(databases.mongo).toBeDefined();
      expect(databases.redis).toBeDefined();
      expect(databases.minio).toBeDefined();
    });
  });

  describe("closeDatabase", () => {
    it("should close all database connections", async () => {
      setupDatabase(); // Initialize connections

      await closeDatabase();

      expect(mockPool.end).toHaveBeenCalled();
      expect(mockMongoose.disconnect).toHaveBeenCalled();
      expect(mockRedis.quit).toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      setupDatabase();
      mockPool.end.mockRejectedValue(new Error("Connection error"));

      await expect(closeDatabase()).rejects.toThrow("Connection error");
    });

    it("should work when no connections exist", async () => {
      await expect(closeDatabase()).resolves.not.toThrow();
    });
  });
});
