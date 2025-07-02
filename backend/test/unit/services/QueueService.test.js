const QueueService = require("../../../src/services/QueueService");

// Mock Bull Queue
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
  remove: jest.fn().mockResolvedValue()
});

jest.mock("bull", () => {
  return jest.fn().mockImplementation(() => createMockQueue());
});

// Mock Redis
jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => ({
    ping: jest.fn().mockResolvedValue("PONG"),
    quit: jest.fn().mockResolvedValue()
  }));
});

describe("QueueService", () => {
  let queueService;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create a new instance for each test
    queueService = new QueueService();
  });

  afterEach(async () => {
    if (queueService) {
      await queueService.shutdown();
    }
  });

  describe("initialization", () => {
    it("should initialize with all required queues", () => {
      expect(queueService.queues.has("email")).toBe(true);
      expect(queueService.queues.has("file-processing")).toBe(true);
      expect(queueService.queues.has("blockchain")).toBe(true);
      expect(queueService.queues.has("maintenance")).toBe(true);
    });

    it("should setup queue event handlers", () => {
      const emailQueue = queueService.queues.get("email");
      expect(emailQueue.on).toHaveBeenCalledWith("error", expect.any(Function));
      expect(emailQueue.on).toHaveBeenCalledWith(
        "failed",
        expect.any(Function)
      );
      expect(emailQueue.on).toHaveBeenCalledWith(
        "completed",
        expect.any(Function)
      );
      expect(emailQueue.on).toHaveBeenCalledWith(
        "stalled",
        expect.any(Function)
      );
    });
  });

  describe("email queue methods", () => {
    it("should add email job with correct priority", async () => {
      const emailData = {
        user: { id: 1, email: "test@example.com", name: "Test User" },
        tenantId: "test-tenant"
      };

      const job = await queueService.addEmailJob("welcome", emailData);

      expect(job).toEqual({ id: 1 });

      const emailQueue = queueService.queues.get("email");
      expect(emailQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "welcome",
          data: emailData,
          tenantId: "test-tenant",
          timestamp: expect.any(String)
        }),
        expect.objectContaining({
          priority: 4, // welcome email priority
          delay: 0
        })
      );
    });

    it("should set correct priorities for different email types", () => {
      expect(queueService.getEmailPriority("security-alert")).toBe(1);
      expect(queueService.getEmailPriority("password-reset")).toBe(2);
      expect(queueService.getEmailPriority("verification")).toBe(3);
      expect(queueService.getEmailPriority("welcome")).toBe(4);
      expect(queueService.getEmailPriority("newsletter")).toBe(5);
      expect(queueService.getEmailPriority("unknown")).toBe(3); // default
    });
  });

  describe("blockchain queue methods", () => {
    it("should add blockchain job with correct priority", async () => {
      const blockchainData = {
        txHash: "0x123...",
        status: "confirmed",
        tenantId: "test-tenant"
      };

      const job = await queueService.addBlockchainJob(
        "transaction-status-update",
        blockchainData
      );

      expect(job).toEqual({ id: 1 });

      const blockchainQueue = queueService.queues.get("blockchain");
      expect(blockchainQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "transaction-status-update",
          data: blockchainData,
          tenantId: "test-tenant",
          timestamp: expect.any(String)
        }),
        expect.objectContaining({
          priority: 1 // transaction status update priority
        })
      );
    });

    it("should set correct priorities for different blockchain job types", () => {
      expect(
        queueService.getBlockchainPriority("transaction-status-update")
      ).toBe(1);
      expect(
        queueService.getBlockchainPriority("pending-transaction-check")
      ).toBe(2);
      expect(
        queueService.getBlockchainPriority("blockchain-event-monitoring")
      ).toBe(3);
      expect(queueService.getBlockchainPriority("nft-metadata-update")).toBe(4);
      expect(queueService.getBlockchainPriority("unknown")).toBe(3); // default
    });
  });

  describe("maintenance queue methods", () => {
    it("should add maintenance job", async () => {
      const maintenanceData = {
        olderThanHours: 24,
        tenantId: "test-tenant"
      };

      const job = await queueService.addMaintenanceJob(
        "cleanup-temp-files",
        maintenanceData
      );

      expect(job).toEqual({ id: 1 });

      const maintenanceQueue = queueService.queues.get("maintenance");
      expect(maintenanceQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "cleanup-temp-files",
          data: maintenanceData,
          tenantId: "test-tenant",
          timestamp: expect.any(String)
        })
      );
    });
  });

  describe("scheduled jobs", () => {
    it("should schedule recurring job", async () => {
      const jobData = { tenantId: "test-tenant" };
      const cronPattern = "0 2 * * *";

      const job = await queueService.scheduleRecurringJob(
        "maintenance",
        "cleanup-temp-files",
        jobData,
        cronPattern
      );

      expect(job).toEqual({ id: 1 });

      const maintenanceQueue = queueService.queues.get("maintenance");
      expect(maintenanceQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "cleanup-temp-files",
          data: jobData,
          tenantId: "test-tenant",
          timestamp: expect.any(String)
        }),
        expect.objectContaining({
          repeat: { cron: cronPattern }
        })
      );
    });

    it("should throw error for invalid queue name", async () => {
      await expect(
        queueService.scheduleRecurringJob(
          "invalid-queue",
          "test",
          {},
          "0 0 * * *"
        )
      ).rejects.toThrow("Queue invalid-queue not found");
    });
  });

  describe("queue statistics", () => {
    it("should get queue stats", async () => {
      const stats = await queueService.getQueueStats();

      expect(stats).toHaveProperty("email");
      expect(stats).toHaveProperty("file-processing");
      expect(stats).toHaveProperty("blockchain");
      expect(stats).toHaveProperty("maintenance");

      expect(stats.email).toHaveProperty("waiting");
      expect(stats.email).toHaveProperty("active");
      expect(stats.email).toHaveProperty("completed");
      expect(stats.email).toHaveProperty("failed");
      expect(stats.email).toHaveProperty("total");
    });

    it("should get tenant stats", async () => {
      const stats = await queueService.getTenantStats("test-tenant");

      expect(stats).toHaveProperty("email");
      expect(stats).toHaveProperty("file-processing");
      expect(stats).toHaveProperty("blockchain");
      expect(stats).toHaveProperty("maintenance");

      expect(stats.email).toHaveProperty("total");
      expect(stats.email).toHaveProperty("waiting");
      expect(stats.email).toHaveProperty("active");
      expect(stats.email).toHaveProperty("completed");
      expect(stats.email).toHaveProperty("failed");
    });
  });

  describe("health check", () => {
    it("should return healthy status when all systems are working", async () => {
      const health = await queueService.healthCheck();

      expect(health).toHaveProperty("status", "healthy");
      expect(health).toHaveProperty("redis", "connected");
      expect(health).toHaveProperty("queues");
      expect(health).toHaveProperty("totalJobs");
      expect(health).toHaveProperty("timestamp");
    });

    it("should return unhealthy status when Redis is down", async () => {
      // Mock Redis ping to fail
      queueService.redis.ping = jest
        .fn()
        .mockRejectedValue(new Error("Redis connection failed"));

      const health = await queueService.healthCheck();

      expect(health).toHaveProperty("status", "unhealthy");
      expect(health).toHaveProperty("error");
    });
  });

  describe("cleanup", () => {
    it("should cleanup old jobs", async () => {
      await queueService.cleanupOldJobs(7);

      // Verify that cleanup was attempted for each queue
      const emailQueue = queueService.queues.get("email");
      const blockchainQueue = queueService.queues.get("blockchain");
      const maintenanceQueue = queueService.queues.get("maintenance");

      expect(emailQueue.getCompleted).toHaveBeenCalled();
      expect(emailQueue.getFailed).toHaveBeenCalled();
      expect(blockchainQueue.getCompleted).toHaveBeenCalled();
      expect(blockchainQueue.getFailed).toHaveBeenCalled();
      expect(maintenanceQueue.getCompleted).toHaveBeenCalled();
      expect(maintenanceQueue.getFailed).toHaveBeenCalled();
    });
  });

  describe("shutdown", () => {
    it("should shutdown gracefully", async () => {
      await queueService.shutdown();

      // Verify all queues were closed
      const emailQueue = queueService.queues.get("email");
      const blockchainQueue = queueService.queues.get("blockchain");
      const maintenanceQueue = queueService.queues.get("maintenance");

      expect(emailQueue.close).toHaveBeenCalled();
      expect(blockchainQueue.close).toHaveBeenCalled();
      expect(maintenanceQueue.close).toHaveBeenCalled();
      expect(queueService.redis.quit).toHaveBeenCalled();
    });
  });
});
