// Mock TenantService before requiring the middleware
const mockTenantService = {
  resolveTenantFromRequest: jest.fn(),
  validateTenantAccess: jest.fn(),
  isFeatureEnabled: jest.fn(),
  getTenantById: jest.fn()
};

jest.mock("../../../src/services/TenantService", () => {
  return jest.fn().mockImplementation(() => mockTenantService);
});

const tenantMiddleware = require("../../../src/middleware/tenant");

describe("Tenant Middleware", () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      headers: {},
      query: {},
      params: {},
      ip: "127.0.0.1",
      method: "GET",
      path: "/api/test"
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();

    // Initialize the middleware with mock databases
    const mockDatabases = {
      postgres: {},
      redis: {},
      mongodb: {}
    };
    tenantMiddleware.initializeTenant(mockDatabases);
  });

  describe("resolveTenant", () => {
    it("should resolve tenant from X-Tenant-ID header", async () => {
      mockReq.headers["x-tenant-id"] = "123";
      const mockTenant = { id: 123, name: "Test Tenant" };
      mockTenantService.resolveTenantFromRequest.mockResolvedValue(mockTenant);

      await tenantMiddleware.resolveTenant(mockReq, mockRes, mockNext);

      expect(mockReq.tenant).toEqual(mockTenant);
      expect(mockNext).toHaveBeenCalled();
    });

    it("should handle tenant resolution errors", async () => {
      mockReq.headers["x-tenant-id"] = "invalid";
      mockTenantService.resolveTenantFromRequest.mockRejectedValue(
        new Error("Invalid tenant")
      );

      await tenantMiddleware.resolveTenant(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Invalid tenant",
        message: "Invalid tenant"
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("requireTenant", () => {
    it("should allow access when tenant is provided", () => {
      mockReq.tenant = { id: 123, name: "Test Tenant" };

      tenantMiddleware.requireTenant(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should deny access when no tenant is provided", () => {
      mockReq.tenant = null;

      tenantMiddleware.requireTenant(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Tenant required",
        message: "No tenant found in request"
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("validateTenantAccess", () => {
    it("should allow access when user belongs to the same tenant", async () => {
      mockReq.tenant = { id: 123 };
      mockReq.user = { userId: 1, tenantId: 123 };
      mockTenantService.validateTenantAccess.mockResolvedValue(true);

      await tenantMiddleware.validateTenantAccess(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should deny access when user belongs to different tenant", async () => {
      mockReq.tenant = { id: 123 };
      mockReq.user = { userId: 1, tenantId: 456 };
      mockTenantService.validateTenantAccess.mockResolvedValue(false);

      await tenantMiddleware.validateTenantAccess(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Tenant access denied",
        message: "User does not have access to this tenant"
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should require both tenant and user", async () => {
      mockReq.tenant = null;
      mockReq.user = { userId: 1 };

      await tenantMiddleware.validateTenantAccess(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Tenant and user required",
        message: "Both tenant and user must be resolved"
      });
    });
  });

  describe("requireFeature", () => {
    it("should allow access when feature is enabled", async () => {
      mockReq.tenant = { id: 123 };
      mockTenantService.isFeatureEnabled.mockResolvedValue(true);

      const featureMiddleware = tenantMiddleware.requireFeature("wallet-auth");
      await featureMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should deny access when feature is disabled", async () => {
      mockReq.tenant = { id: 123 };
      mockTenantService.isFeatureEnabled.mockResolvedValue(false);

      const featureMiddleware = tenantMiddleware.requireFeature("wallet-auth");
      await featureMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Feature disabled",
        message: "Feature 'wallet-auth' is not enabled for this tenant"
      });
    });
  });

  describe("optionalTenant", () => {
    it("should continue without tenant when resolution fails", async () => {
      mockTenantService.resolveTenantFromRequest.mockRejectedValue(
        new Error("Tenant not found")
      );

      await tenantMiddleware.optionalTenant(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.tenant).toBeUndefined();
    });

    it("should set tenant when resolution succeeds", async () => {
      const mockTenant = { id: 123, name: "Test Tenant" };
      mockTenantService.resolveTenantFromRequest.mockResolvedValue(mockTenant);

      await tenantMiddleware.optionalTenant(mockReq, mockRes, mockNext);

      expect(mockReq.tenant).toEqual(mockTenant);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("extractTenantFromToken", () => {
    it("should extract tenant from user token", () => {
      mockReq.user = { userId: 1, tenantId: 123 };

      tenantMiddleware.extractTenantFromToken(mockReq, mockRes, mockNext);

      expect(mockReq.tenantId).toBe(123);
      expect(mockNext).toHaveBeenCalled();
    });

    it("should continue without tenant when user has no tenantId", () => {
      mockReq.user = { userId: 1 };

      tenantMiddleware.extractTenantFromToken(mockReq, mockRes, mockNext);

      expect(mockReq.tenantId).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("tenantContext", () => {
    it("should add tenant context to request", () => {
      mockReq.tenantId = 123;
      mockReq.user = { id: 1, tenantId: 123 };

      tenantMiddleware.tenantContext(mockReq, mockRes, mockNext);

      expect(mockReq.tenantContext).toEqual({
        tenantId: 123,
        userId: 1,
        userTenantId: 123,
        isCrossTenant: false
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it("should handle cross-tenant access", () => {
      mockReq.tenantId = 123;
      mockReq.user = { id: 1, tenantId: 456, role: "admin" };

      tenantMiddleware.tenantContext(mockReq, mockRes, mockNext);

      expect(mockReq.tenantContext).toEqual({
        tenantId: 123,
        userId: 1,
        userTenantId: 456,
        isCrossTenant: true
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it("should handle requests without user", () => {
      mockReq.tenantId = 123;
      mockReq.user = null;

      tenantMiddleware.tenantContext(mockReq, mockRes, mockNext);

      expect(mockReq.tenantContext).toEqual({
        tenantId: 123,
        userId: null,
        userTenantId: null,
        isCrossTenant: false
      });
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("tenantIsolation", () => {
    it("should add tenant isolation to query", () => {
      mockReq.tenantId = 123;
      mockReq.query = {};

      tenantMiddleware.tenantIsolation(mockReq, mockRes, mockNext);

      expect(mockReq.query.tenantId).toBe(123);
      expect(mockNext).toHaveBeenCalled();
    });

    it("should preserve existing query parameters", () => {
      mockReq.tenantId = 123;
      mockReq.query = { status: "active", limit: 10 };

      tenantMiddleware.tenantIsolation(mockReq, mockRes, mockNext);

      expect(mockReq.query).toEqual({
        status: "active",
        limit: 10,
        tenantId: 123
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it("should override existing tenantId in query", () => {
      mockReq.tenantId = 123;
      mockReq.query = { tenantId: 999, status: "active" };

      tenantMiddleware.tenantIsolation(mockReq, mockRes, mockNext);

      expect(mockReq.query.tenantId).toBe(123);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("tenantAudit", () => {
    it("should add audit information to request", () => {
      mockReq.tenantId = 123;
      mockReq.user = { id: 1, email: "test@example.com" };
      mockReq.method = "POST";
      mockReq.path = "/api/users";

      tenantMiddleware.tenantAudit(mockReq, mockRes, mockNext);

      expect(mockReq.auditInfo).toEqual({
        tenantId: 123,
        userId: 1,
        userEmail: "test@example.com",
        action: "POST /api/users",
        timestamp: expect.any(Date),
        ip: "127.0.0.1"
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it("should handle requests without user", () => {
      mockReq.tenantId = 123;
      mockReq.user = null;
      mockReq.method = "GET";
      mockReq.path = "/api/public";

      tenantMiddleware.tenantAudit(mockReq, mockRes, mockNext);

      expect(mockReq.auditInfo).toEqual({
        tenantId: 123,
        userId: null,
        userEmail: null,
        action: "GET /api/public",
        timestamp: expect.any(Date),
        ip: "127.0.0.1"
      });
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("Integration scenarios", () => {
    it("should handle complete tenant resolution flow", async () => {
      mockReq.headers["x-tenant-id"] = "123";
      mockReq.user = { id: 1, tenantId: 123 };
      const mockTenant = { id: 123, name: "Test Tenant" };

      mockTenantService.resolveTenantFromRequest.mockResolvedValue(mockTenant);
      mockTenantService.validateTenantAccess.mockResolvedValue(true);

      // Test resolveTenant
      await tenantMiddleware.resolveTenant(mockReq, mockRes, mockNext);
      expect(mockReq.tenant).toEqual(mockTenant);

      // Test validateTenantAccess
      await tenantMiddleware.validateTenantAccess(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();

      // Test tenantContext
      tenantMiddleware.tenantContext(mockReq, mockRes, mockNext);
      expect(mockReq.tenantContext).toBeDefined();

      // Test tenantIsolation
      tenantMiddleware.tenantIsolation(mockReq, mockRes, mockNext);
      expect(mockReq.query.tenantId).toBe(123);

      // Test tenantAudit
      tenantMiddleware.tenantAudit(mockReq, mockRes, mockNext);
      expect(mockReq.auditInfo).toBeDefined();
    });
  });
});
