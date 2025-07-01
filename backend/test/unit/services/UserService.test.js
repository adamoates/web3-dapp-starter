const UserService = require("../../../src/services/UserService");
const User = require("../../../src/models/sql/User");
const UserActivity = require("../../../src/models/nosql/UserActivity");
const Transaction = require("../../../src/models/sql/Transaction");
const {
  generateUserData,
  generateTransactionData
} = require("../../setup/helpers");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Mock dependencies
jest.mock("../../../src/models/sql/User");
jest.mock("../../../src/models/nosql/UserActivity");
jest.mock("../../../src/models/sql/Transaction");
jest.mock("bcryptjs");
jest.mock("jsonwebtoken");

describe("UserService (Unit Tests)", () => {
  let userService;
  let mockDatabases;
  let mockRedisClient;
  let mockUser;
  let mockUserActivity;
  let mockTransaction;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";

    mockRedisClient = {
      setex: jest.fn(),
      get: jest.fn(),
      del: jest.fn()
    };

    mockDatabases = {
      postgresPool: {},
      redisClient: mockRedisClient
    };

    // Create mock instances
    mockUser = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findByWallet: jest.fn(),
      linkWallet: jest.fn(),
      updateProfile: jest.fn(),
      validatePassword: jest.fn(),
      generateToken: jest.fn(),
      verifyToken: jest.fn()
    };

    mockUserActivity = {
      save: jest.fn()
    };

    mockTransaction = {
      getTransactionStats: jest.fn()
    };

    // Mock the constructors
    User.mockImplementation(() => mockUser);
    UserActivity.mockImplementation(() => mockUserActivity);
    Transaction.mockImplementation(() => mockTransaction);

    userService = new UserService(mockDatabases);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("registerUser", () => {
    it("should register a new user successfully", async () => {
      const userData = {
        email: "test@example.com",
        password: "password123",
        name: "Test User"
      };

      const mockUserResult = {
        id: 1,
        email: userData.email,
        name: userData.name,
        wallet_address: null
      };

      mockUser.create.mockResolvedValue(mockUserResult);
      mockUserActivity.save.mockResolvedValue();
      mockRedisClient.setex.mockResolvedValue("OK");

      const result = await userService.registerUser(userData);

      expect(mockUser.create).toHaveBeenCalledWith(userData);
      expect(mockUserActivity.save).toHaveBeenCalled();
      expect(mockRedisClient.setex).toHaveBeenCalledTimes(2); // session and profile
      expect(result).toEqual(mockUserResult);
    });

    it("should throw error if user creation fails", async () => {
      const userData = {
        email: "test@example.com",
        password: "password123",
        name: "Test User"
      };

      mockUser.create.mockRejectedValue(new Error("User creation failed"));

      await expect(userService.registerUser(userData)).rejects.toThrow(
        "User creation failed"
      );
    });
  });

  describe("loginUser", () => {
    it("should login user successfully with valid credentials", async () => {
      const email = "test@example.com";
      const password = "password123";

      const mockUserResult = {
        id: 1,
        email,
        name: "Test User",
        password_hash: "hashedPassword123"
      };

      const mockToken = "mock.jwt.token";

      mockUser.findByEmail.mockResolvedValue(mockUserResult);
      mockUser.validatePassword.mockResolvedValue(true);
      mockUser.generateToken.mockReturnValue(mockToken);
      mockUserActivity.save.mockResolvedValue();
      mockRedisClient.setex.mockResolvedValue("OK");

      const result = await userService.loginUser(email, password);

      expect(mockUser.findByEmail).toHaveBeenCalledWith(email);
      expect(mockUser.validatePassword).toHaveBeenCalledWith(
        password,
        mockUserResult.password_hash
      );
      expect(mockUser.generateToken).toHaveBeenCalledWith(mockUserResult.id);
      expect(mockUserActivity.save).toHaveBeenCalled();
      expect(mockRedisClient.setex).toHaveBeenCalledTimes(2); // session and token
      expect(result).toEqual({
        user: mockUserResult,
        token: mockToken
      });
    });

    it("should throw error if user not found", async () => {
      const email = "nonexistent@example.com";
      const password = "password123";

      mockUser.findByEmail.mockResolvedValue(null);

      await expect(userService.loginUser(email, password)).rejects.toThrow(
        "User not found"
      );
    });

    it("should throw error if password is invalid", async () => {
      const email = "test@example.com";
      const password = "wrongpassword";

      const mockUserResult = {
        id: 1,
        email,
        password_hash: "hashedPassword123"
      };

      mockUser.findByEmail.mockResolvedValue(mockUserResult);
      mockUser.validatePassword.mockResolvedValue(false);

      await expect(userService.loginUser(email, password)).rejects.toThrow(
        "Invalid password"
      );
    });
  });

  describe("logoutUser", () => {
    it("should logout user successfully", async () => {
      const userId = 1;
      const token = "mock.jwt.token";

      mockRedisClient.setex.mockResolvedValue("OK");
      mockRedisClient.del.mockResolvedValue(1);
      mockUserActivity.save.mockResolvedValue();

      const result = await userService.logoutUser(userId, token);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        `jwt:${userId}:${token.split(".")[2]}`,
        86400,
        "blacklisted"
      );
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        `user_session:${userId}`
      );
      expect(mockUserActivity.save).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });
  });

  describe("verifyToken", () => {
    it("should verify valid token successfully", async () => {
      const token = "mock.jwt.token";
      const mockDecoded = { userId: 1, type: "access" };

      mockUser.verifyToken.mockReturnValue(mockDecoded);
      mockRedisClient.get.mockResolvedValue("valid");

      const result = await userService.verifyToken(token);

      expect(mockUser.verifyToken).toHaveBeenCalledWith(token);
      expect(mockRedisClient.get).toHaveBeenCalledWith(
        `jwt:${mockDecoded.userId}:${token.split(".")[2]}`
      );
      expect(result).toEqual(mockDecoded);
    });

    it("should return null for invalid token", async () => {
      const token = "invalid.token";

      mockUser.verifyToken.mockReturnValue(null);

      const result = await userService.verifyToken(token);

      expect(result).toBeNull();
    });

    it("should return null for blacklisted token", async () => {
      const token = "valid.token";
      const mockDecoded = { userId: 1, type: "access" };

      mockUser.verifyToken.mockReturnValue(mockDecoded);
      mockRedisClient.get.mockResolvedValue("blacklisted");

      const result = await userService.verifyToken(token);

      expect(result).toBeNull();
    });
  });

  describe("getUserProfile", () => {
    it("should get user profile from cache successfully", async () => {
      const userId = 1;
      const mockProfile = {
        id: userId,
        email: "test@example.com",
        name: "Test User"
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockProfile));

      const result = await userService.getUserProfile(userId);

      expect(mockRedisClient.get).toHaveBeenCalledWith(
        `user_profile:${userId}`
      );
      expect(result).toEqual(mockProfile);
    });

    it("should get user profile from database if not cached", async () => {
      const userId = 1;
      const mockUserResult = {
        id: userId,
        email: "test@example.com",
        name: "Test User",
        wallet_address: null,
        is_verified: false,
        created_at: new Date()
      };

      mockRedisClient.get.mockResolvedValue(null);
      mockUser.findById.mockResolvedValue(mockUserResult);
      mockRedisClient.setex.mockResolvedValue("OK");

      const result = await userService.getUserProfile(userId);

      expect(mockUser.findById).toHaveBeenCalledWith(userId);
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        `user_profile:${userId}`,
        1800,
        expect.any(String)
      );
      expect(result).toHaveProperty("id", userId);
    });

    it("should throw error if user not found", async () => {
      const userId = 999;

      mockRedisClient.get.mockResolvedValue(null);
      mockUser.findById.mockResolvedValue(null);

      await expect(userService.getUserProfile(userId)).rejects.toThrow(
        "User not found"
      );
    });
  });

  describe("linkWalletToUser", () => {
    it("should link wallet address successfully", async () => {
      const userId = 1;
      const walletAddress = "0x1234567890123456789012345678901234567890";
      const signature = "mock.signature";

      const mockUpdatedUser = {
        id: userId,
        email: "test@example.com",
        name: "Test User",
        wallet_address: walletAddress
      };

      mockUser.linkWallet.mockResolvedValue(mockUpdatedUser);
      mockUserActivity.save.mockResolvedValue();
      mockRedisClient.setex.mockResolvedValue("OK");

      const result = await userService.linkWalletToUser(
        userId,
        walletAddress,
        signature
      );

      expect(mockUser.linkWallet).toHaveBeenCalledWith(userId, walletAddress);
      expect(mockUserActivity.save).toHaveBeenCalled();
      expect(mockRedisClient.setex).toHaveBeenCalledTimes(2); // session and profile
      expect(result).toEqual(mockUpdatedUser);
    });

    it("should throw error if wallet linking fails", async () => {
      const userId = 1;
      const walletAddress = "0x1234567890123456789012345678901234567890";
      const signature = "mock.signature";

      mockUser.linkWallet.mockRejectedValue(new Error("Wallet linking failed"));

      await expect(
        userService.linkWalletToUser(userId, walletAddress, signature)
      ).rejects.toThrow("Wallet linking failed");
    });
  });

  describe("updateUserProfile", () => {
    it("should update user profile successfully", async () => {
      const userId = 1;
      const updates = {
        name: "Updated Name",
        email: "updated@example.com"
      };

      const mockUpdatedUser = {
        id: userId,
        email: updates.email,
        name: updates.name,
        wallet_address: null
      };

      mockUser.updateProfile.mockResolvedValue(mockUpdatedUser);
      mockUserActivity.save.mockResolvedValue();
      mockRedisClient.setex.mockResolvedValue("OK");

      const result = await userService.updateUserProfile(userId, updates);

      expect(mockUser.updateProfile).toHaveBeenCalledWith(userId, updates);
      expect(mockUserActivity.save).toHaveBeenCalled();
      expect(mockRedisClient.setex).toHaveBeenCalledTimes(2); // session and profile
      expect(result).toEqual(mockUpdatedUser);
    });
  });
});
