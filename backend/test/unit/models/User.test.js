const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { generateUserData } = require("../../setup/helpers");

// Mock dependencies
jest.mock("bcryptjs");
jest.mock("jsonwebtoken");
jest.mock("../../../src/db/postgres", () => ({
  query: jest.fn()
}));

// Explicitly unmock the User class
jest.unmock("../../../src/models/sql/User");
const User = require("../../../src/models/sql/User");
const mockPool = require("../../../src/db/postgres");

describe("User Model", () => {
  let user;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    user = new User(mockPool);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("create", () => {
    it("should create a new user successfully", async () => {
      const userData = {
        email: "test@example.com",
        password: "password123",
        name: "Test User"
      };

      const hashedPassword = "hashedPassword123";
      bcrypt.hash.mockResolvedValue(hashedPassword);

      const mockUser = {
        id: 1,
        email: userData.email,
        name: userData.name,
        wallet_address: null,
        is_verified: false,
        created_at: new Date()
      };

      mockPool.query.mockResolvedValue({ rows: [mockUser] });

      const result = await user.create(userData);

      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, 12);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO users"),
        [userData.email, hashedPassword, userData.name, null]
      );
      expect(result).toEqual(mockUser);
    });

    it("should create user with wallet address", async () => {
      const userData = {
        email: "test@example.com",
        password: "password123",
        name: "Test User",
        walletAddress: "0x1234567890123456789012345678901234567890"
      };

      const hashedPassword = "hashedPassword123";
      bcrypt.hash.mockResolvedValue(hashedPassword);

      const mockUser = {
        id: 1,
        email: userData.email,
        name: userData.name,
        wallet_address: userData.walletAddress,
        is_verified: false,
        created_at: new Date()
      };

      mockPool.query.mockResolvedValue({ rows: [mockUser] });

      const result = await user.create(userData);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO users"),
        [userData.email, hashedPassword, userData.name, userData.walletAddress]
      );
      expect(result).toEqual(mockUser);
    });

    it("should throw error if user creation fails", async () => {
      const userData = {
        email: "test@example.com",
        password: "password123",
        name: "Test User"
      };

      bcrypt.hash.mockResolvedValue("hashedPassword123");
      mockPool.query.mockRejectedValue(new Error("Database error"));

      await expect(user.create(userData)).rejects.toThrow("Database error");
    });
  });

  describe("findByEmail", () => {
    it("should find user by email successfully", async () => {
      const email = "test@example.com";
      const mockUser = {
        id: 1,
        email,
        name: "Test User",
        password_hash: "hashedPassword123"
      };

      mockPool.query.mockResolvedValue({ rows: [mockUser] });

      const result = await user.findByEmail(email);

      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE email = $1",
        [email]
      );
      expect(result).toEqual(mockUser);
    });

    it("should return undefined if user not found", async () => {
      const email = "nonexistent@example.com";

      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await user.findByEmail(email);

      expect(result).toBeUndefined();
    });
  });

  describe("findById", () => {
    it("should find user by id successfully", async () => {
      const userId = 1;
      const mockUser = {
        id: userId,
        email: "test@example.com",
        name: "Test User"
      };

      mockPool.query.mockResolvedValue({ rows: [mockUser] });

      const result = await user.findById(userId);

      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE id = $1",
        [userId]
      );
      expect(result).toEqual(mockUser);
    });

    it("should return undefined if user not found", async () => {
      const userId = 999;

      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await user.findById(userId);

      expect(result).toBeUndefined();
    });
  });

  describe("findByWallet", () => {
    it("should find user by wallet address successfully", async () => {
      const walletAddress = "0x1234567890123456789012345678901234567890";
      const mockUser = {
        id: 1,
        email: "test@example.com",
        wallet_address: walletAddress
      };

      mockPool.query.mockResolvedValue({ rows: [mockUser] });

      const result = await user.findByWallet(walletAddress);

      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE wallet_address = $1",
        [walletAddress]
      );
      expect(result).toEqual(mockUser);
    });

    it("should return undefined if user not found", async () => {
      const walletAddress = "0x9999999999999999999999999999999999999999";

      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await user.findByWallet(walletAddress);

      expect(result).toBeUndefined();
    });
  });

  describe("linkWallet", () => {
    it("should link wallet address successfully", async () => {
      const userId = 1;
      const walletAddress = "0x1234567890123456789012345678901234567890";

      const mockUpdatedUser = {
        id: userId,
        email: "test@example.com",
        name: "Test User",
        wallet_address: walletAddress
      };

      mockPool.query.mockResolvedValue({ rows: [mockUpdatedUser] });

      const result = await user.linkWallet(userId, walletAddress);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE users"),
        [walletAddress, userId]
      );
      expect(result).toEqual(mockUpdatedUser);
    });

    it("should throw error if wallet linking fails", async () => {
      const userId = 1;
      const walletAddress = "0x1234567890123456789012345678901234567890";

      mockPool.query.mockRejectedValue(new Error("Update failed"));

      await expect(user.linkWallet(userId, walletAddress)).rejects.toThrow(
        "Update failed"
      );
    });
  });

  describe("updateProfile", () => {
    it("should update user profile with valid fields", async () => {
      const userId = 1;
      const updates = {
        name: "Updated Name",
        email: "updated@example.com",
        is_verified: true
      };

      const mockUpdatedUser = {
        id: userId,
        email: updates.email,
        name: updates.name,
        wallet_address: null,
        is_verified: updates.is_verified,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockPool.query.mockResolvedValue({ rows: [mockUpdatedUser] });

      const result = await user.updateProfile(userId, updates);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE users"),
        expect.arrayContaining([
          updates.name,
          updates.email,
          updates.is_verified,
          userId
        ])
      );
      expect(result).toEqual(mockUpdatedUser);
    });

    it("should update only allowed fields", async () => {
      const userId = 1;
      const updates = {
        name: "Updated Name",
        email: "updated@example.com",
        invalid_field: "should be ignored"
      };

      const mockUpdatedUser = {
        id: userId,
        email: updates.email,
        name: updates.name,
        wallet_address: null
      };

      mockPool.query.mockResolvedValue({ rows: [mockUpdatedUser] });

      const result = await user.updateProfile(userId, updates);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE users"),
        expect.arrayContaining([updates.name, updates.email, userId])
      );
      expect(result).toEqual(mockUpdatedUser);
    });

    it("should throw error when no valid fields to update", async () => {
      const userId = 1;
      const updates = {
        invalid_field: "should be ignored"
      };

      await expect(user.updateProfile(userId, updates)).rejects.toThrow(
        "No valid fields to update"
      );
    });

    it("should throw error on database failure", async () => {
      const userId = 1;
      const updates = {
        name: "Updated Name"
      };

      mockPool.query.mockRejectedValue(new Error("Update failed"));

      await expect(user.updateProfile(userId, updates)).rejects.toThrow(
        "Update failed"
      );
    });
  });

  describe("validatePassword", () => {
    it("should validate password successfully", async () => {
      const password = "password123";
      const hashedPassword = "hashedPassword123";

      bcrypt.compare.mockResolvedValue(true);

      const result = await user.validatePassword(password, hashedPassword);

      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(result).toBe(true);
    });

    it("should return false for invalid password", async () => {
      const password = "wrongpassword";
      const hashedPassword = "hashedPassword123";

      bcrypt.compare.mockResolvedValue(false);

      const result = await user.validatePassword(password, hashedPassword);

      expect(result).toBe(false);
    });
  });

  describe("generateToken", () => {
    it("should generate JWT token successfully", () => {
      const userId = 123;

      const mockToken = "mock.jwt.token";
      jwt.sign.mockReturnValue(mockToken);

      const result = user.generateToken(userId);

      expect(jwt.sign).toHaveBeenCalledWith(
        { userId, type: "access" },
        "test-secret",
        { expiresIn: "24h" }
      );
      expect(result).toBe(mockToken);
    });
  });

  describe("verifyToken", () => {
    it("should verify valid JWT token", async () => {
      const token = "valid.token.here";
      const mockDecoded = { userId: 123, type: "access" };

      jwt.verify.mockReturnValue(mockDecoded);

      const result = await user.verifyToken(token);

      expect(jwt.verify).toHaveBeenCalledWith(token, "test-secret");
      expect(result).toEqual(mockDecoded);
    });

    it("should return null for invalid token", async () => {
      const token = "invalid.token.here";

      jwt.verify.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      const result = await user.verifyToken(token);

      expect(result).toBeNull();
    });
  });
});
