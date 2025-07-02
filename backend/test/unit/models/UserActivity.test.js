const UserActivity = require("../../../src/models/nosql/UserActivity");

describe("UserActivity Model", () => {
  let userActivity;
  let mockConnection;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConnection = {
      model: jest.fn()
    };

    // Mock the schema and model
    const mockSchema = {
      pre: jest.fn().mockReturnThis(),
      index: jest.fn().mockReturnThis()
    };

    const mockModel = {
      create: jest.fn(),
      find: jest.fn().mockReturnThis(),
      findOne: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      aggregate: jest.fn().mockReturnThis(),
      deleteMany: jest.fn(),
      exec: jest.fn(),
      save: jest.fn()
    };

    mockConnection.model.mockReturnValue(mockModel);

    userActivity = new UserActivity(mockConnection);
  });

  describe("constructor", () => {
    it("should initialize with connection and create model", () => {
      expect(userActivity.connection).toBe(mockConnection);
      expect(mockConnection.model).toHaveBeenCalledWith(
        "UserActivity",
        expect.any(Object)
      );
    });
  });

  describe("create", () => {
    it("should create user activity successfully", async () => {
      const activityData = {
        userId: 1,
        action: "login",
        details: { ip: "127.0.0.1", userAgent: "test-agent" },
        ipAddress: "127.0.0.1",
        userAgent: "test-agent"
      };

      const mockActivity = {
        _id: "activity-id",
        userId: 1,
        action: "login",
        details: activityData.details,
        ipAddress: "127.0.0.1",
        userAgent: "test-agent",
        createdAt: new Date()
      };

      userActivity.model.create.mockResolvedValue(mockActivity);

      const result = await userActivity.create(activityData);

      expect(userActivity.model.create).toHaveBeenCalledWith(activityData);
      expect(result).toEqual(mockActivity);
    });

    it("should create activity with minimal data", async () => {
      const activityData = {
        userId: 1,
        action: "page_view"
      };

      const mockActivity = {
        _id: "activity-id",
        userId: 1,
        action: "page_view",
        createdAt: new Date()
      };

      userActivity.model.create.mockResolvedValue(mockActivity);

      const result = await userActivity.create(activityData);

      expect(userActivity.model.create).toHaveBeenCalledWith(activityData);
      expect(result).toEqual(mockActivity);
    });

    it("should handle creation errors", async () => {
      const activityData = {
        userId: 1,
        action: "login"
      };

      const error = new Error("Validation failed");
      userActivity.model.create.mockRejectedValue(error);

      await expect(userActivity.create(activityData)).rejects.toThrow(
        "Validation failed"
      );
    });
  });

  describe("findByUser", () => {
    it("should find activities by user with pagination", async () => {
      const userId = 1;
      const limit = 10;
      const offset = 20;

      const mockActivities = [
        { _id: "1", action: "login", createdAt: new Date() },
        { _id: "2", action: "logout", createdAt: new Date() }
      ];

      userActivity.model.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockActivities)
            })
          })
        })
      });

      const result = await userActivity.findByUser(userId, limit, offset);

      expect(userActivity.model.find).toHaveBeenCalledWith({ userId });
      expect(result).toEqual(mockActivities);
    });

    it("should use default pagination values", async () => {
      const userId = 1;
      userActivity.model.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([])
            })
          })
        })
      });

      await userActivity.findByUser(userId);

      expect(userActivity.model.find).toHaveBeenCalledWith({ userId });
    });
  });

  describe("findByAction", () => {
    it("should find activities by action type", async () => {
      const action = "login";
      const mockActivities = [
        { _id: "1", userId: 1, action: "login" },
        { _id: "2", userId: 2, action: "login" }
      ];

      userActivity.model.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockActivities)
        })
      });

      const result = await userActivity.findByAction(action);

      expect(userActivity.model.find).toHaveBeenCalledWith({ action });
      expect(result).toEqual(mockActivities);
    });
  });

  describe("getActivityStats", () => {
    it("should get activity statistics for user", async () => {
      const userId = 1;
      const mockStats = [
        { _id: "login", count: 5 },
        { _id: "logout", count: 3 },
        { _id: "page_view", count: 12 }
      ];

      userActivity.model.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockStats)
      });

      const result = await userActivity.getActivityStats(userId);

      expect(userActivity.model.aggregate).toHaveBeenCalledWith([
        { $match: { userId } },
        { $group: { _id: "$action", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      expect(result).toEqual(mockStats);
    });

    it("should handle user with no activities", async () => {
      const userId = 999;
      userActivity.model.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([])
      });

      const result = await userActivity.getActivityStats(userId);

      expect(result).toEqual([]);
    });
  });

  describe("getRecentActivity", () => {
    it("should get recent activities across all users", async () => {
      const limit = 5;
      const mockActivities = [
        { _id: "1", userId: 1, action: "login", createdAt: new Date() },
        { _id: "2", userId: 2, action: "logout", createdAt: new Date() }
      ];

      userActivity.model.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockActivities)
          })
        })
      });

      const result = await userActivity.getRecentActivity(limit);

      expect(userActivity.model.find).toHaveBeenCalledWith({});
      expect(result).toEqual(mockActivities);
    });

    it("should use default limit", async () => {
      userActivity.model.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([])
          })
        })
      });

      await userActivity.getRecentActivity();

      expect(userActivity.model.find).toHaveBeenCalledWith({});
    });
  });

  describe("cleanupOldActivities", () => {
    it("should delete activities older than specified days", async () => {
      const daysOld = 30;
      const mockResult = { deletedCount: 150 };

      userActivity.model.deleteMany.mockResolvedValue(mockResult);

      const result = await userActivity.cleanupOldActivities(daysOld);

      expect(userActivity.model.deleteMany).toHaveBeenCalledWith({
        timestamp: { $lt: expect.any(Date) }
      });
      expect(result).toEqual(mockResult);
    });

    it("should use default cleanup period", async () => {
      const mockResult = { deletedCount: 50 };
      userActivity.model.deleteMany.mockResolvedValue(mockResult);

      await userActivity.cleanupOldActivities();

      expect(userActivity.model.deleteMany).toHaveBeenCalledWith({
        timestamp: { $lt: expect.any(Date) }
      });
    });
  });

  describe("getUserSessionData", () => {
    it("should get session data for user", async () => {
      const userId = 1;
      const mockSessions = [
        { _id: "1", action: "login", createdAt: new Date() },
        { _id: "2", action: "logout", createdAt: new Date() }
      ];

      userActivity.model.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockSessions)
        })
      });

      const result = await userActivity.getUserSessionData(userId);

      expect(userActivity.model.find).toHaveBeenCalledWith({
        userId,
        sessionId: { $exists: true, $ne: null }
      });
      expect(result).toEqual(mockSessions);
    });
  });

  describe("error handling", () => {
    it("should handle database connection errors", async () => {
      const error = new Error("Connection lost");
      userActivity.model.create.mockRejectedValue(error);

      await expect(
        userActivity.create({
          userId: 1,
          action: "login"
        })
      ).rejects.toThrow("Connection lost");
    });

    it("should handle validation errors", async () => {
      const error = new Error("Validation failed: userId is required");
      error.name = "ValidationError";
      userActivity.model.create.mockRejectedValue(error);

      await expect(
        userActivity.create({
          action: "login"
        })
      ).rejects.toThrow("Validation failed: userId is required");
    });
  });
});
