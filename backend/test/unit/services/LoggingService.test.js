const LoggingService = require("../../../src/services/LoggingService");

// Mock dependencies
jest.mock("../../../src/models/nosql/UserActivity");
jest.mock("../../../src/db/DatabaseManager");

describe("LoggingService", () => {
  let loggingService;
  let mockUserActivity;

  beforeEach(() => {
    loggingService = new LoggingService();

    // Reset all mocks
    jest.clearAllMocks();

    // Mock UserActivity model
    mockUserActivity = {
      create: jest.fn().mockResolvedValue({ id: "activity-123" }),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([])
        })
      }),
      countDocuments: jest.fn().mockResolvedValue(0)
    };

    // Mock the UserActivity model
    const UserActivity = require("../../../src/models/nosql/UserActivity");
    UserActivity.mockImplementation(() => mockUserActivity);
  });

  describe("logUserActivity", () => {
    it("should log user activity with tenant context", async () => {
      const activityData = {
        userId: 123,
        tenantId: 1,
        action: "login",
        details: { method: "wallet", walletAddress: "0x123..." },
        ip: "192.168.1.100",
        userAgent: "Mozilla/5.0..."
      };

      const result = await loggingService.logUserActivity(activityData);

      expect(mockUserActivity.create).toHaveBeenCalledWith({
        ...activityData,
        timestamp: expect.any(Date),
        sessionId: expect.any(String)
      });
      expect(result).toHaveProperty("id", "activity-123");
    });

    it("should generate session ID if not provided", async () => {
      const activityData = {
        userId: 123,
        tenantId: 1,
        action: "login",
        details: { method: "email" }
      };

      await loggingService.logUserActivity(activityData);

      const callArgs = mockUserActivity.create.mock.calls[0][0];
      expect(callArgs).toHaveProperty("sessionId");
      expect(typeof callArgs.sessionId).toBe("string");
      expect(callArgs.sessionId.length).toBeGreaterThan(0);
    });

    it("should use provided session ID", async () => {
      const activityData = {
        userId: 123,
        tenantId: 1,
        action: "login",
        sessionId: "existing-session-123",
        details: { method: "email" }
      };

      await loggingService.logUserActivity(activityData);

      const callArgs = mockUserActivity.create.mock.calls[0][0];
      expect(callArgs.sessionId).toBe("existing-session-123");
    });

    it("should handle missing optional fields", async () => {
      const activityData = {
        userId: 123,
        tenantId: 1,
        action: "login"
      };

      await loggingService.logUserActivity(activityData);

      const callArgs = mockUserActivity.create.mock.calls[0][0];
      expect(callArgs).toHaveProperty("details", {});
      expect(callArgs).toHaveProperty("ip", null);
      expect(callArgs).toHaveProperty("userAgent", null);
    });

    it("should handle database errors gracefully", async () => {
      const activityData = {
        userId: 123,
        tenantId: 1,
        action: "login"
      };

      mockUserActivity.create.mockRejectedValue(new Error("Database error"));

      await expect(
        loggingService.logUserActivity(activityData)
      ).rejects.toThrow("Failed to log user activity");
    });
  });

  describe("logSecurityEvent", () => {
    it("should log security events with proper categorization", async () => {
      const securityData = {
        userId: 123,
        tenantId: 1,
        eventType: "failed_login",
        severity: "high",
        details: {
          reason: "Invalid password",
          attempts: 5,
          ip: "192.168.1.100"
        }
      };

      const result = await loggingService.logSecurityEvent(securityData);

      expect(mockUserActivity.create).toHaveBeenCalledWith({
        ...securityData,
        action: "security_event",
        timestamp: expect.any(Date),
        sessionId: expect.any(String)
      });
      expect(result).toHaveProperty("id", "activity-123");
    });

    it("should set default severity to medium", async () => {
      const securityData = {
        userId: 123,
        tenantId: 1,
        eventType: "suspicious_activity"
      };

      await loggingService.logSecurityEvent(securityData);

      const callArgs = mockUserActivity.create.mock.calls[0][0];
      expect(callArgs.severity).toBe("medium");
    });

    it("should validate severity levels", async () => {
      const securityData = {
        userId: 123,
        tenantId: 1,
        eventType: "test",
        severity: "invalid_severity"
      };

      await expect(
        loggingService.logSecurityEvent(securityData)
      ).rejects.toThrow("Invalid severity level");
    });
  });

  describe("logPerformanceEvent", () => {
    it("should log performance events with timing data", async () => {
      const performanceData = {
        userId: 123,
        tenantId: 1,
        operation: "database_query",
        duration: 150,
        details: {
          query: "SELECT * FROM users",
          rows: 1000
        }
      };

      const result = await loggingService.logPerformanceEvent(performanceData);

      expect(mockUserActivity.create).toHaveBeenCalledWith({
        ...performanceData,
        action: "performance_event",
        timestamp: expect.any(Date),
        sessionId: expect.any(String)
      });
      expect(result).toHaveProperty("id", "activity-123");
    });

    it("should categorize performance based on duration", async () => {
      const slowQuery = {
        userId: 123,
        tenantId: 1,
        operation: "slow_query",
        duration: 5000
      };

      await loggingService.logPerformanceEvent(slowQuery);

      const callArgs = mockUserActivity.create.mock.calls[0][0];
      expect(callArgs.severity).toBe("high");
    });

    it("should set appropriate severity for different durations", async () => {
      const testCases = [
        { duration: 50, expectedSeverity: "low" },
        { duration: 500, expectedSeverity: "medium" },
        { duration: 2000, expectedSeverity: "high" }
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();

        const performanceData = {
          userId: 123,
          tenantId: 1,
          operation: "test",
          duration: testCase.duration
        };

        await loggingService.logPerformanceEvent(performanceData);

        const callArgs = mockUserActivity.create.mock.calls[0][0];
        expect(callArgs.severity).toBe(testCase.expectedSeverity);
      }
    });
  });

  describe("logApiRequest", () => {
    it("should log API requests with request details", async () => {
      const requestData = {
        userId: 123,
        tenantId: 1,
        method: "POST",
        path: "/api/auth/login",
        statusCode: 200,
        duration: 150,
        ip: "192.168.1.100",
        userAgent: "Mozilla/5.0..."
      };

      const result = await loggingService.logApiRequest(requestData);

      expect(mockUserActivity.create).toHaveBeenCalledWith({
        ...requestData,
        action: "api_request",
        timestamp: expect.any(Date),
        sessionId: expect.any(String)
      });
      expect(result).toHaveProperty("id", "activity-123");
    });

    it("should categorize API errors appropriately", async () => {
      const errorRequest = {
        userId: 123,
        tenantId: 1,
        method: "GET",
        path: "/api/users",
        statusCode: 500,
        duration: 100
      };

      await loggingService.logApiRequest(errorRequest);

      const callArgs = mockUserActivity.create.mock.calls[0][0];
      expect(callArgs.severity).toBe("high");
      expect(callArgs.eventType).toBe("server_error");
    });

    it("should handle different status code categories", async () => {
      const testCases = [
        {
          statusCode: 200,
          expectedSeverity: "low",
          expectedEventType: "success"
        },
        {
          statusCode: 400,
          expectedSeverity: "medium",
          expectedEventType: "client_error"
        },
        {
          statusCode: 401,
          expectedSeverity: "medium",
          expectedEventType: "unauthorized"
        },
        {
          statusCode: 403,
          expectedSeverity: "high",
          expectedEventType: "forbidden"
        },
        {
          statusCode: 500,
          expectedSeverity: "high",
          expectedEventType: "server_error"
        }
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();

        const requestData = {
          userId: 123,
          tenantId: 1,
          method: "GET",
          path: "/api/test",
          statusCode: testCase.statusCode,
          duration: 100
        };

        await loggingService.logApiRequest(requestData);

        const callArgs = mockUserActivity.create.mock.calls[0][0];
        expect(callArgs.severity).toBe(testCase.expectedSeverity);
        expect(callArgs.eventType).toBe(testCase.expectedEventType);
      }
    });
  });

  describe("getUserActivity", () => {
    it("should retrieve user activity with filters", async () => {
      const filters = {
        userId: 123,
        tenantId: 1,
        action: "login",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
        limit: 50
      };

      const mockActivities = [
        { id: "1", action: "login", timestamp: new Date() },
        { id: "2", action: "login", timestamp: new Date() }
      ];

      mockUserActivity.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(mockActivities)
        })
      });

      const result = await loggingService.getUserActivity(filters);

      expect(mockUserActivity.find).toHaveBeenCalledWith({
        userId: 123,
        tenantId: 1,
        action: "login",
        timestamp: {
          $gte: filters.startDate,
          $lte: filters.endDate
        }
      });
      expect(result).toEqual(mockActivities);
    });

    it("should handle missing filters gracefully", async () => {
      const filters = {};

      await loggingService.getUserActivity(filters);

      expect(mockUserActivity.find).toHaveBeenCalledWith({});
    });

    it("should apply default limit", async () => {
      const filters = { userId: 123 };

      await loggingService.getUserActivity(filters);

      expect(mockUserActivity.find).toHaveBeenCalledWith({ userId: 123 });
    });
  });

  describe("getActivityStats", () => {
    it("should return activity statistics", async () => {
      const filters = {
        tenantId: 1,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31")
      };

      mockUserActivity.countDocuments.mockResolvedValue(100);

      const result = await loggingService.getActivityStats(filters);

      expect(mockUserActivity.countDocuments).toHaveBeenCalledWith({
        tenantId: 1,
        timestamp: {
          $gte: filters.startDate,
          $lte: filters.endDate
        }
      });
      expect(result).toHaveProperty("totalActivities", 100);
    });

    it("should handle empty filters", async () => {
      const filters = {};

      mockUserActivity.countDocuments.mockResolvedValue(0);

      const result = await loggingService.getActivityStats(filters);

      expect(mockUserActivity.countDocuments).toHaveBeenCalledWith({});
      expect(result).toHaveProperty("totalActivities", 0);
    });
  });

  describe("logWalletActivity", () => {
    it("should log wallet-specific activities", async () => {
      const walletData = {
        userId: 123,
        tenantId: 1,
        walletAddress: "0x1234567890abcdef",
        action: "wallet_connect",
        details: {
          network: "ethereum",
          chainId: 1
        }
      };

      const result = await loggingService.logWalletActivity(walletData);

      expect(mockUserActivity.create).toHaveBeenCalledWith({
        ...walletData,
        action: "wallet_activity",
        timestamp: expect.any(Date),
        sessionId: expect.any(String),
        severity: "low"
      });
      expect(result).toHaveProperty("id", "activity-123");
    });

    it("should handle wallet authentication events", async () => {
      const authData = {
        userId: 123,
        tenantId: 1,
        walletAddress: "0x1234567890abcdef",
        action: "wallet_auth",
        success: true,
        details: {
          challenge: "test-challenge",
          signature: "0x..."
        }
      };

      await loggingService.logWalletActivity(authData);

      const callArgs = mockUserActivity.create.mock.calls[0][0];
      expect(callArgs.eventType).toBe("wallet_authentication");
      expect(callArgs.severity).toBe("medium");
    });

    it("should handle failed wallet operations", async () => {
      const failedData = {
        userId: 123,
        tenantId: 1,
        walletAddress: "0x1234567890abcdef",
        action: "wallet_auth",
        success: false,
        details: {
          error: "Invalid signature"
        }
      };

      await loggingService.logWalletActivity(failedData);

      const callArgs = mockUserActivity.create.mock.calls[0][0];
      expect(callArgs.severity).toBe("high");
      expect(callArgs.eventType).toBe("wallet_authentication_failed");
    });
  });

  describe("logTenantActivity", () => {
    it("should log tenant-specific activities", async () => {
      const tenantData = {
        tenantId: 1,
        action: "tenant_created",
        details: {
          name: "New Tenant",
          adminEmail: "admin@tenant.com"
        }
      };

      const result = await loggingService.logTenantActivity(tenantData);

      expect(mockUserActivity.create).toHaveBeenCalledWith({
        ...tenantData,
        action: "tenant_activity",
        timestamp: expect.any(Date),
        sessionId: expect.any(String),
        severity: "medium"
      });
      expect(result).toHaveProperty("id", "activity-123");
    });

    it("should handle tenant configuration changes", async () => {
      const configData = {
        tenantId: 1,
        action: "config_updated",
        details: {
          setting: "max_users",
          oldValue: 100,
          newValue: 200
        }
      };

      await loggingService.logTenantActivity(configData);

      const callArgs = mockUserActivity.create.mock.calls[0][0];
      expect(callArgs.eventType).toBe("tenant_configuration");
      expect(callArgs.severity).toBe("medium");
    });
  });

  describe("Error handling", () => {
    it("should handle UserActivity model errors", async () => {
      mockUserActivity.create.mockRejectedValue(
        new Error("MongoDB connection failed")
      );

      const activityData = {
        userId: 123,
        tenantId: 1,
        action: "test"
      };

      await expect(
        loggingService.logUserActivity(activityData)
      ).rejects.toThrow("Failed to log user activity");
    });

    it("should handle invalid input data", async () => {
      const invalidData = {
        // Missing required fields
        action: "test"
      };

      await expect(loggingService.logUserActivity(invalidData)).rejects.toThrow(
        "Invalid activity data"
      );
    });
  });
});
