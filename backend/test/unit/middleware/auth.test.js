jest.useFakeTimers();
const auth = require("../../../src/middleware/auth");
const UserService = require("../../../src/services/UserService");

// Mock UserService
jest.mock("../../../src/services/UserService");

describe("Auth Middleware", () => {
  let mockReq;
  let mockRes;
  let mockNext;
  let mockUserService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";

    // Setup mock request, response, and next function
    mockReq = {
      headers: {},
      ip: "127.0.0.1",
      app: {
        locals: {}
      },
      get: jest.fn()
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    mockNext = jest.fn();

    // Setup mock UserService
    mockUserService = {
      verifyToken: jest.fn(),
      validateSession: jest.fn(),
      getUserById: jest.fn()
    };

    UserService.mockImplementation(() => mockUserService);

    // Initialize auth middleware with mock databases
    const mockDatabases = {
      postgresPool: { query: jest.fn() },
      redisClient: { get: jest.fn(), setex: jest.fn() },
      mongooseConnection: { db: { stats: jest.fn() } }
    };

    auth.initializeAuth(mockDatabases);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("authenticateToken", () => {
    it("should authenticate user with valid token", async () => {
      const mockUser = {
        id: 1,
        email: "test@example.com",
        name: "Test User"
      };

      const token = "valid.token.here";
      mockReq.headers.authorization = `Bearer ${token}`;
      mockUserService.verifyToken.mockResolvedValue(mockUser);

      await auth.authenticateToken(mockReq, mockRes, mockNext);

      expect(mockUserService.verifyToken).toHaveBeenCalledWith(token);
      expect(mockReq.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalled();
    });

    it("should return 401 if no authorization header", async () => {
      mockReq.headers.authorization = undefined;

      await auth.authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Access token required"
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 if token format is invalid", async () => {
      mockReq.headers.authorization = "InvalidFormat token";

      await auth.authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Invalid authorization format"
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 if token is missing", async () => {
      mockReq.headers.authorization = "Bearer ";

      await auth.authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Invalid authorization format"
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 if token is invalid", async () => {
      const token = "invalid.token.here";

      mockReq.headers.authorization = `Bearer ${token}`;
      mockUserService.verifyToken.mockResolvedValue(null);

      await auth.authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Invalid or expired token"
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle service errors", async () => {
      const token = "valid.token.here";

      mockReq.headers.authorization = `Bearer ${token}`;
      mockUserService.verifyToken.mockRejectedValue(new Error("Service error"));

      await auth.authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Authentication service error"
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("requireAuth", () => {
    it("should allow request with authenticated user", () => {
      mockReq.user = {
        id: 1,
        email: "test@example.com"
      };

      auth.requireAuth(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should return 401 if user not authenticated", () => {
      mockReq.user = null;

      auth.requireAuth(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Authentication required"
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("optionalAuth", () => {
    it("should continue with authenticated user", () => {
      mockReq.user = {
        id: 1,
        email: "test@example.com"
      };

      auth.optionalAuth(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should continue without authenticated user", () => {
      mockReq.user = null;

      auth.optionalAuth(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("requireRole", () => {
    it("should allow access for user with required role", () => {
      const requiredRole = "admin";
      mockReq.user = {
        id: 1,
        email: "admin@example.com",
        name: "Admin User",
        role: "admin"
      };

      const middleware = auth.requireRole(requiredRole);
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should return 403 for user without required role", () => {
      const requiredRole = "admin";
      mockReq.user = {
        id: 1,
        email: "user@example.com",
        name: "Regular User",
        role: "user"
      };

      const middleware = auth.requireRole(requiredRole);
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Insufficient permissions"
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 for unauthenticated user", () => {
      const requiredRole = "admin";

      const middleware = auth.requireRole(requiredRole);
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Authentication required"
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("rateLimit", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should allow request within rate limit", () => {
      const ip = "192.168.1.1";
      mockReq.ip = ip;
      mockReq.app = { locals: {} };

      const rateLimiter = auth.rateLimit({ max: 5, windowMs: 60000 });
      rateLimiter(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should block request exceeding rate limit", () => {
      const ip = "192.168.1.1";
      mockReq.ip = ip;
      mockReq.app = { locals: {} };

      const rateLimiter = auth.rateLimit({ max: 2, windowMs: 60000 });

      // Make multiple requests to exceed rate limit
      for (let i = 0; i < 3; i++) {
        rateLimiter(mockReq, mockRes, mockNext);
      }

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Too many requests, please try again later"
      });
    });

    it("should reset rate limit after time window", () => {
      const ip = "192.168.1.1";
      mockReq.ip = ip;
      mockReq.app = { locals: {} };

      const rateLimiter = auth.rateLimit({ max: 2, windowMs: 60000 });

      // Make requests up to limit
      for (let i = 0; i < 2; i++) {
        rateLimiter(mockReq, mockRes, mockNext);
      }

      // Advance time by 1 minute
      jest.advanceTimersByTime(60000);

      // Should allow new request
      rateLimiter(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("validateWalletOwnership", () => {
    it("should allow access for wallet owner", () => {
      const walletAddress = "0x1234567890abcdef";
      mockReq.user = {
        id: 1,
        email: "test@example.com",
        name: "Test User",
        walletAddress
      };
      mockReq.params = { walletAddress };

      const middleware = auth.validateWalletOwnership();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should return 403 for non-wallet owner", () => {
      const walletAddress = "0x1234567890abcdef";
      mockReq.user = {
        id: 1,
        email: "test@example.com",
        name: "Test User",
        walletAddress: "0xdifferentwallet"
      };
      mockReq.params = { walletAddress };

      const middleware = auth.validateWalletOwnership();
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Access denied: wallet ownership required"
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 for unauthenticated user", () => {
      const walletAddress = "0x1234567890abcdef";
      mockReq.params = { walletAddress };

      const middleware = auth.validateWalletOwnership();
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Authentication required"
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 400 for missing wallet address", () => {
      mockReq.user = { id: 1, walletAddress: "0x1234567890abcdef" };
      mockReq.params = {};

      const middleware = auth.validateWalletOwnership();
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Wallet address required"
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
