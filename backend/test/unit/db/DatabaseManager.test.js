const DatabaseManager = require("../../../src/db/DatabaseManager");

// Mock the database module
jest.mock("../../../src/database", () => ({
  setupDatabase: jest.fn(),
  closeDatabase: jest.fn(),
  getDatabase: jest.fn()
}));

describe("DatabaseManager", () => {
  let dbManager;
  let mockDatabases;
  let mockSetupDatabase;
  let mockCloseDatabase;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDatabases = {
      postgres: {
        query: jest.fn().mockResolvedValue({ rows: [{ now: new Date() }] })
      },
      mongo: {
        db: {
          admin: jest.fn().mockReturnValue({
            ping: jest.fn().mockResolvedValue({ ok: 1 })
          })
        }
      },
      redis: {
        ping: jest.fn().mockResolvedValue("PONG")
      }
    };

    mockSetupDatabase = require("../../../src/database").setupDatabase;
    mockCloseDatabase = require("../../../src/database").closeDatabase;

    mockSetupDatabase.mockReturnValue(mockDatabases);
    mockCloseDatabase.mockResolvedValue();

    dbManager = new DatabaseManager();
  });

  describe("constructor", () => {
    it("should initialize with null databases", () => {
      expect(dbManager.databases).toBeNull();
    });
  });

  describe("connect", () => {
    it("should setup database connections successfully", async () => {
      const result = await dbManager.connect();

      expect(mockSetupDatabase).toHaveBeenCalled();
      expect(dbManager.databases).toBe(mockDatabases);
      expect(result).toBe(dbManager);
    });

    it("should handle connection errors", async () => {
      const error = new Error("Connection failed");
      mockSetupDatabase.mockImplementation(() => {
        throw error;
      });

      await expect(dbManager.connect()).rejects.toThrow("Connection failed");
      expect(dbManager.databases).toBeNull();
    });
  });

  describe("healthCheck", () => {
    beforeEach(async () => {
      await dbManager.connect();
    });

    it("should return healthy status for all databases", async () => {
      const health = await dbManager.healthCheck();

      expect(health).toEqual({
        postgres: true,
        mongodb: true,
        redis: true,
        timestamp: expect.any(String)
      });
    });

    it("should handle PostgreSQL health check failure", async () => {
      mockDatabases.postgres.query.mockRejectedValue(new Error("DB error"));

      const health = await dbManager.healthCheck();

      expect(health.postgres).toBe(false);
      expect(health.mongodb).toBe(true);
      expect(health.redis).toBe(true);
    });

    it("should handle MongoDB health check failure", async () => {
      mockDatabases.mongo.db
        .admin()
        .ping.mockRejectedValue(new Error("Mongo error"));

      const health = await dbManager.healthCheck();

      expect(health.postgres).toBe(true);
      expect(health.mongodb).toBe(false);
      expect(health.redis).toBe(true);
    });

    it("should handle Redis health check failure", async () => {
      mockDatabases.redis.ping.mockRejectedValue(new Error("Redis error"));

      const health = await dbManager.healthCheck();

      expect(health.postgres).toBe(true);
      expect(health.mongodb).toBe(true);
      expect(health.redis).toBe(false);
    });

    it("should handle multiple database failures", async () => {
      mockDatabases.postgres.query.mockRejectedValue(new Error("DB error"));
      mockDatabases.redis.ping.mockRejectedValue(new Error("Redis error"));

      const health = await dbManager.healthCheck();

      expect(health.postgres).toBe(false);
      expect(health.mongodb).toBe(true);
      expect(health.redis).toBe(false);
    });
  });

  describe("disconnect", () => {
    it("should close database connections", async () => {
      await dbManager.disconnect();

      expect(mockCloseDatabase).toHaveBeenCalled();
    });

    it("should handle disconnect errors", async () => {
      const error = new Error("Disconnect failed");
      mockCloseDatabase.mockRejectedValue(error);

      await expect(dbManager.disconnect()).rejects.toThrow("Disconnect failed");
    });
  });

  describe("getter methods", () => {
    beforeEach(async () => {
      await dbManager.connect();
    });

    describe("postgresPool", () => {
      it("should return PostgreSQL pool when connected", () => {
        expect(dbManager.postgresPool).toBe(mockDatabases.postgres);
      });

      it("should return undefined when not connected", () => {
        dbManager.databases = null;
        expect(dbManager.postgresPool).toBeUndefined();
      });
    });

    describe("redisClient", () => {
      it("should return Redis client when connected", () => {
        expect(dbManager.redisClient).toBe(mockDatabases.redis);
      });

      it("should return undefined when not connected", () => {
        dbManager.databases = null;
        expect(dbManager.redisClient).toBeUndefined();
      });
    });

    describe("mongooseConnection", () => {
      it("should return MongoDB connection when connected", () => {
        expect(dbManager.mongooseConnection).toBe(mockDatabases.mongo);
      });

      it("should return undefined when not connected", () => {
        dbManager.databases = null;
        expect(dbManager.mongooseConnection).toBeUndefined();
      });
    });
  });

  describe("edge cases", () => {
    it("should handle health check when not connected", async () => {
      const health = await dbManager.healthCheck();

      expect(health).toEqual({
        postgres: false,
        mongodb: false,
        redis: false,
        timestamp: expect.any(String)
      });
    });

    it("should handle partial database setup", async () => {
      const partialDatabases = {
        postgres: mockDatabases.postgres
        // Missing mongo and redis
      };

      mockSetupDatabase.mockReturnValue(partialDatabases);
      await dbManager.connect();

      const health = await dbManager.healthCheck();

      expect(health.postgres).toBe(true);
      expect(health.mongodb).toBe(false);
      expect(health.redis).toBe(false);
    });
  });
});
