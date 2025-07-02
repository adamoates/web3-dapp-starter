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
const { ethers } = require("ethers");

// Mock dependencies
jest.mock("../../../src/models/sql/User");
jest.mock("../../../src/models/nosql/UserActivity");
jest.mock("../../../src/models/sql/Transaction");
jest.mock("bcryptjs");
jest.mock("jsonwebtoken");
jest.mock("../../../src/db/DatabaseManager");

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
      postgres: {},
      redis: mockRedisClient
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

describe("UserService - Wallet Authentication", () => {
  let userService;
  let mockUser;
  let testWallet;

  beforeEach(() => {
    userService = new UserService();
    testWallet = ethers.Wallet.createRandom();

    // Reset all mocks
    jest.clearAllMocks();

    // Mock User model methods
    mockUser = {
      id: 1,
      email: "test@example.com",
      name: "Test User",
      walletAddress: testWallet.address,
      tenantId: 1,
      save: jest.fn().mockResolvedValue(true),
      update: jest.fn().mockResolvedValue(true)
    };
  });

  describe("generateWalletChallenge", () => {
    it("should generate a valid challenge for wallet authentication", async () => {
      const walletAddress = testWallet.address;
      const tenantId = 1;

      const result = await userService.generateWalletChallenge(
        walletAddress,
        tenantId
      );

      expect(result).toHaveProperty("message");
      expect(result).toHaveProperty("nonce");
      expect(result).toHaveProperty("expiresAt");
      expect(result).toHaveProperty("walletAddress", walletAddress);
      expect(result).toHaveProperty("tenantId", tenantId);

      // Verify message format
      expect(result.message).toContain("Sign this message to authenticate");
      expect(result.message).toContain(`Wallet: ${walletAddress}`);
      expect(result.message).toContain(`Nonce: ${result.nonce}`);
      expect(result.message).toContain(`Tenant: ${tenantId}`);

      // Verify nonce is a valid UUID
      expect(result.nonce).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );

      // Verify expiration time (should be 5 minutes from now)
      const expiresAt = new Date(result.expiresAt);
      const now = new Date();
      const timeDiff = expiresAt.getTime() - now.getTime();
      expect(timeDiff).toBeGreaterThan(4 * 60 * 1000); // At least 4 minutes
      expect(timeDiff).toBeLessThan(6 * 60 * 1000); // Less than 6 minutes
    });

    it("should store challenge in Redis", async () => {
      const walletAddress = testWallet.address;
      const tenantId = 1;

      await userService.generateWalletChallenge(walletAddress, tenantId);

      // Verify Redis set was called
      expect(userService.redis.set).toHaveBeenCalledWith(
        `wallet_challenge:${walletAddress}`,
        expect.any(String),
        "EX",
        300
      );
    });

    it("should handle Redis errors gracefully", async () => {
      const walletAddress = testWallet.address;
      const tenantId = 1;

      // Mock Redis error
      userService.redis.set.mockRejectedValue(new Error("Redis error"));

      await expect(
        userService.generateWalletChallenge(walletAddress, tenantId)
      ).rejects.toThrow("Failed to generate wallet challenge");
    });
  });

  describe("verifyWalletSignature", () => {
    it("should verify valid signature and return user", async () => {
      const walletAddress = testWallet.address;
      const tenantId = 1;
      const message =
        "Sign this message to authenticate\nWallet: " +
        walletAddress +
        "\nNonce: test-nonce\nTenant: " +
        tenantId;
      const signature = await testWallet.signMessage(message);

      // Mock challenge retrieval
      const challenge = {
        message,
        nonce: "test-nonce",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        walletAddress,
        tenantId
      };
      userService.redis.get.mockResolvedValue(JSON.stringify(challenge));

      // Mock user retrieval
      User.findOne.mockResolvedValue(mockUser);

      // Mock JWT generation
      jwt.sign.mockReturnValue("mock-jwt-token");

      // Mock session creation
      userService.redis.set.mockResolvedValue("OK");

      const result = await userService.verifyWalletSignature(
        walletAddress,
        signature,
        tenantId
      );

      expect(result).toHaveProperty("user");
      expect(result).toHaveProperty("token");
      expect(result).toHaveProperty("sessionId");
      expect(result.user).toEqual(mockUser);
      expect(result.token).toBe("mock-jwt-token");
    });

    it("should create new user if wallet not found", async () => {
      const walletAddress = testWallet.address;
      const tenantId = 1;
      const message =
        "Sign this message to authenticate\nWallet: " +
        walletAddress +
        "\nNonce: test-nonce\nTenant: " +
        tenantId;
      const signature = await testWallet.signMessage(message);

      // Mock challenge retrieval
      const challenge = {
        message,
        nonce: "test-nonce",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        walletAddress,
        tenantId
      };
      userService.redis.get.mockResolvedValue(JSON.stringify(challenge));

      // Mock user not found
      User.findOne.mockResolvedValue(null);

      // Mock user creation
      User.create.mockResolvedValue(mockUser);

      // Mock JWT generation
      jwt.sign.mockReturnValue("mock-jwt-token");

      // Mock session creation
      userService.redis.set.mockResolvedValue("OK");

      const result = await userService.verifyWalletSignature(
        walletAddress,
        signature,
        tenantId
      );

      expect(User.create).toHaveBeenCalledWith({
        walletAddress,
        name: expect.stringContaining("Wallet User"),
        tenantId,
        isWalletOnly: true
      });
      expect(result).toHaveProperty("user", mockUser);
    });

    it("should reject invalid signature", async () => {
      const walletAddress = testWallet.address;
      const tenantId = 1;
      const message =
        "Sign this message to authenticate\nWallet: " +
        walletAddress +
        "\nNonce: test-nonce\nTenant: " +
        tenantId;
      const invalidSignature = "0x" + "1".repeat(130);

      // Mock challenge retrieval
      const challenge = {
        message,
        nonce: "test-nonce",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        walletAddress,
        tenantId
      };
      userService.redis.get.mockResolvedValue(JSON.stringify(challenge));

      await expect(
        userService.verifyWalletSignature(
          walletAddress,
          invalidSignature,
          tenantId
        )
      ).rejects.toThrow("Invalid signature");
    });

    it("should reject signature from different wallet", async () => {
      const walletAddress = testWallet.address;
      const differentWallet = ethers.Wallet.createRandom();
      const tenantId = 1;
      const message =
        "Sign this message to authenticate\nWallet: " +
        walletAddress +
        "\nNonce: test-nonce\nTenant: " +
        tenantId;
      const signature = await differentWallet.signMessage(message);

      // Mock challenge retrieval
      const challenge = {
        message,
        nonce: "test-nonce",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        walletAddress,
        tenantId
      };
      userService.redis.get.mockResolvedValue(JSON.stringify(challenge));

      await expect(
        userService.verifyWalletSignature(walletAddress, signature, tenantId)
      ).rejects.toThrow("Invalid signature");
    });

    it("should reject expired challenge", async () => {
      const walletAddress = testWallet.address;
      const tenantId = 1;
      const message =
        "Sign this message to authenticate\nWallet: " +
        walletAddress +
        "\nNonce: test-nonce\nTenant: " +
        tenantId;
      const signature = await testWallet.signMessage(message);

      // Mock expired challenge
      const challenge = {
        message,
        nonce: "test-nonce",
        expiresAt: new Date(Date.now() - 60000).toISOString(), // Expired
        walletAddress,
        tenantId
      };
      userService.redis.get.mockResolvedValue(JSON.stringify(challenge));

      await expect(
        userService.verifyWalletSignature(walletAddress, signature, tenantId)
      ).rejects.toThrow("Challenge expired");
    });

    it("should reject missing challenge", async () => {
      const walletAddress = testWallet.address;
      const tenantId = 1;
      const signature = "0x" + "1".repeat(130);

      // Mock no challenge found
      userService.redis.get.mockResolvedValue(null);

      await expect(
        userService.verifyWalletSignature(walletAddress, signature, tenantId)
      ).rejects.toThrow("Invalid or expired challenge");
    });

    it("should reject challenge for different wallet", async () => {
      const walletAddress = testWallet.address;
      const differentWallet = ethers.Wallet.createRandom();
      const tenantId = 1;
      const message =
        "Sign this message to authenticate\nWallet: " +
        differentWallet.address +
        "\nNonce: test-nonce\nTenant: " +
        tenantId;
      const signature = await testWallet.signMessage(message);

      // Mock challenge for different wallet
      const challenge = {
        message,
        nonce: "test-nonce",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        walletAddress: differentWallet.address,
        tenantId
      };
      userService.redis.get.mockResolvedValue(JSON.stringify(challenge));

      await expect(
        userService.verifyWalletSignature(walletAddress, signature, tenantId)
      ).rejects.toThrow("Invalid or expired challenge");
    });
  });

  describe("linkWalletToUser", () => {
    it("should link wallet to existing user", async () => {
      const userId = 1;
      const walletAddress = testWallet.address;
      const message = `Link wallet ${walletAddress} to your account.\n\nUser ID: ${userId}\nTimestamp: ${Date.now()}`;
      const signature = await testWallet.signMessage(message);

      // Mock user retrieval
      User.findByPk.mockResolvedValue(mockUser);

      // Mock user update
      mockUser.update.mockResolvedValue(mockUser);

      const result = await userService.linkWalletToUser(
        userId,
        walletAddress,
        signature
      );

      expect(mockUser.update).toHaveBeenCalledWith({
        walletAddress,
        isWalletOnly: false
      });
      expect(result).toEqual(mockUser);
    });

    it("should reject if user not found", async () => {
      const userId = 999;
      const walletAddress = testWallet.address;
      const message = `Link wallet ${walletAddress} to your account.\n\nUser ID: ${userId}\nTimestamp: ${Date.now()}`;
      const signature = await testWallet.signMessage(message);

      // Mock user not found
      User.findByPk.mockResolvedValue(null);

      await expect(
        userService.linkWalletToUser(userId, walletAddress, signature)
      ).rejects.toThrow("User not found");
    });

    it("should reject invalid signature", async () => {
      const userId = 1;
      const walletAddress = testWallet.address;
      const invalidSignature = "0x" + "1".repeat(130);

      // Mock user retrieval
      User.findByPk.mockResolvedValue(mockUser);

      await expect(
        userService.linkWalletToUser(userId, walletAddress, invalidSignature)
      ).rejects.toThrow("Invalid signature");
    });

    it("should reject signature from different wallet", async () => {
      const userId = 1;
      const walletAddress = testWallet.address;
      const differentWallet = ethers.Wallet.createRandom();
      const message = `Link wallet ${walletAddress} to your account.\n\nUser ID: ${userId}\nTimestamp: ${Date.now()}`;
      const signature = await differentWallet.signMessage(message);

      // Mock user retrieval
      User.findByPk.mockResolvedValue(mockUser);

      await expect(
        userService.linkWalletToUser(userId, walletAddress, signature)
      ).rejects.toThrow("Invalid signature");
    });
  });

  describe("walletAuthentication", () => {
    it("should handle complete wallet authentication flow", async () => {
      const walletAddress = testWallet.address;
      const tenantId = 1;
      const message =
        "Sign this message to authenticate\nWallet: " +
        walletAddress +
        "\nNonce: test-nonce\nTenant: " +
        tenantId;
      const signature = await testWallet.signMessage(message);

      // Mock challenge retrieval
      const challenge = {
        message,
        nonce: "test-nonce",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        walletAddress,
        tenantId
      };
      userService.redis.get.mockResolvedValue(JSON.stringify(challenge));

      // Mock user retrieval
      User.findOne.mockResolvedValue(mockUser);

      // Mock JWT generation
      jwt.sign.mockReturnValue("mock-jwt-token");

      // Mock session creation
      userService.redis.set.mockResolvedValue("OK");

      const result = await userService.walletAuthentication(
        walletAddress,
        signature,
        tenantId
      );

      expect(result).toHaveProperty("user", mockUser);
      expect(result).toHaveProperty("token", "mock-jwt-token");
      expect(result).toHaveProperty("sessionId");
    });

    it("should handle signature verification errors", async () => {
      const walletAddress = testWallet.address;
      const tenantId = 1;
      const invalidSignature = "0x" + "1".repeat(130);

      // Mock challenge retrieval
      const challenge = {
        message: "test message",
        nonce: "test-nonce",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        walletAddress,
        tenantId
      };
      userService.redis.get.mockResolvedValue(JSON.stringify(challenge));

      await expect(
        userService.walletAuthentication(
          walletAddress,
          invalidSignature,
          tenantId
        )
      ).rejects.toThrow("Invalid signature");
    });
  });

  describe("Session management with wallet auth", () => {
    it("should create session for wallet authentication", async () => {
      const walletAddress = testWallet.address;
      const tenantId = 1;
      const message =
        "Sign this message to authenticate\nWallet: " +
        walletAddress +
        "\nNonce: test-nonce\nTenant: " +
        tenantId;
      const signature = await testWallet.signMessage(message);

      // Mock challenge retrieval
      const challenge = {
        message,
        nonce: "test-nonce",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        walletAddress,
        tenantId
      };
      userService.redis.get.mockResolvedValue(JSON.stringify(challenge));

      // Mock user retrieval
      User.findOne.mockResolvedValue(mockUser);

      // Mock JWT generation
      jwt.sign.mockReturnValue("mock-jwt-token");

      // Mock session creation
      userService.redis.set.mockResolvedValue("OK");

      const result = await userService.verifyWalletSignature(
        walletAddress,
        signature,
        tenantId
      );

      // Verify session was created
      expect(userService.redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^session:/),
        expect.any(String),
        "EX",
        3600
      );

      expect(result).toHaveProperty("sessionId");
      expect(typeof result.sessionId).toBe("string");
    });

    it("should include tenant context in JWT token", async () => {
      const walletAddress = testWallet.address;
      const tenantId = 1;
      const message =
        "Sign this message to authenticate\nWallet: " +
        walletAddress +
        "\nNonce: test-nonce\nTenant: " +
        tenantId;
      const signature = await testWallet.signMessage(message);

      // Mock challenge retrieval
      const challenge = {
        message,
        nonce: "test-nonce",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        walletAddress,
        tenantId
      };
      userService.redis.get.mockResolvedValue(JSON.stringify(challenge));

      // Mock user retrieval
      User.findOne.mockResolvedValue(mockUser);

      // Mock JWT generation
      jwt.sign.mockReturnValue("mock-jwt-token");

      // Mock session creation
      userService.redis.set.mockResolvedValue("OK");

      await userService.verifyWalletSignature(
        walletAddress,
        signature,
        tenantId
      );

      // Verify JWT was called with tenant context
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          tenantId: tenantId,
          walletAddress: walletAddress
        }),
        expect.any(String),
        expect.any(Object)
      );
    });
  });
});
