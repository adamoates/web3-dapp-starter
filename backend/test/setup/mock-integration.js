require("dotenv").config({ path: ".env.test" });

// Mock all services to return realistic API responses
jest.mock("../../src/services/UserService", () => {
  const mockUserService = {
    registerUser: jest.fn().mockImplementation(async (userData) => {
      // Simulate successful registration
      return {
        id: 1,
        email: userData.email,
        name: userData.name,
        is_verified: false,
        created_at: new Date().toISOString()
      };
    }),

    loginUser: jest.fn().mockImplementation(async (email, password) => {
      // Simulate successful login
      if (email === "test@example.com" && password === "TestPass123!") {
        return {
          user: {
            id: 1,
            email: "test@example.com",
            name: "Test User",
            is_verified: false
          },
          token: "mock.jwt.token.string"
        };
      }
      throw new Error("Invalid credentials");
    }),

    getUserProfile: jest.fn().mockResolvedValue({
      id: 1,
      email: "test@example.com",
      name: "Test User",
      is_verified: false,
      created_at: new Date().toISOString()
    }),

    getUserStats: jest.fn().mockResolvedValue({
      totalLogins: 5,
      lastLogin: new Date().toISOString(),
      accountAge: "30 days"
    }),

    logout: jest.fn().mockResolvedValue(true),
    verifyToken: jest.fn().mockImplementation(async (token) => {
      if (token === "mock.jwt.token.string") {
        return {
          userId: 1,
          email: "test@example.com",
          name: "Test User"
        };
      }
      return null;
    })
  };

  return jest.fn().mockImplementation(() => mockUserService);
});

jest.mock("../../src/services/Web3Service", () => {
  const mockWeb3Service = {
    getContractStats: jest.fn().mockImplementation(async (contractAddress) => {
      // Simulate contract stats based on address
      return {
        contractAddress,
        txCount: 150,
        volume: 1234.56,
        uniqueUsers: 45,
        lastActivity: new Date().toISOString()
      };
    }),

    recordTransaction: jest.fn().mockResolvedValue({
      id: "mock-tx-id",
      hash: "0x" + "1".repeat(64),
      status: "confirmed",
      timestamp: new Date().toISOString()
    }),

    getTransactionHistory: jest.fn().mockResolvedValue([
      {
        hash: "0x" + "1".repeat(64),
        value: "1000000000000000000",
        timestamp: new Date().toISOString(),
        status: "confirmed"
      }
    ])
  };

  return jest.fn().mockImplementation(() => mockWeb3Service);
});

// Mock auth middleware to simulate token validation
jest.mock("../../src/middleware/auth", () => ({
  authenticateToken: jest.fn().mockImplementation(() => (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (token === "mock.jwt.token.string") {
      req.user = {
        id: 1,
        email: "test@example.com",
        name: "Test User"
      };
      next();
    } else if (!token) {
      res.status(401).json({ error: "Access token required" });
    } else {
      res.status(403).json({ error: "Invalid or expired token" });
    }
  }),
  requireAuth: jest.fn().mockImplementation(() => (req, res, next) => {
    if (req.user) {
      next();
    } else {
      res.status(401).json({ error: "Authentication required" });
    }
  }),
  optionalAuth: jest.fn().mockImplementation(() => (req, res, next) => {
    next();
  })
}));

// Mock database connections (but don't actually connect)
jest.mock("pg", () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue(),
    end: jest.fn().mockResolvedValue()
  }))
}));

jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => ({
    setex: jest.fn().mockResolvedValue("OK"),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue("OK")
  }));
});

jest.mock("minio", () => ({
  Client: jest.fn().mockImplementation(() => ({
    bucketExists: jest.fn().mockResolvedValue(true),
    putObject: jest.fn().mockResolvedValue({}),
    getObject: jest.fn().mockResolvedValue({}),
    removeObject: jest.fn().mockResolvedValue({}),
    listObjects: jest.fn().mockResolvedValue([])
  }))
}));

jest.mock("mongoose", () => {
  const Schema = jest.fn().mockImplementation(() => ({
    index: jest.fn().mockReturnThis(),
    pre: jest.fn().mockReturnThis(),
    statics: {}
  }));

  Schema.Types = {
    Mixed: "Mixed"
  };

  return {
    connect: jest.fn().mockResolvedValue({}),
    connection: {
      close: jest.fn().mockResolvedValue()
    },
    Schema,
    model: jest.fn(() => ({
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue([])
            })
          })
        })
      }),
      aggregate: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      save: jest.fn().mockResolvedValue({})
    }))
  };
});

// Suppress console output
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: console.error
};
