const BaseService = require("../../../src/services/BaseService");

// Create a concrete implementation for testing
class TestService extends BaseService {
  constructor() {
    super();
    this.testData = "test";
  }

  async healthCheck() {
    return this.createSuccessResponse(
      { status: "healthy" },
      "Test service healthy"
    );
  }

  async shutdown() {
    return this.createSuccessResponse(null, "Test service shutdown");
  }
}

describe("BaseService", () => {
  let testService;

  beforeEach(() => {
    testService = new TestService();
  });

  describe("Constructor", () => {
    test("should throw error when trying to instantiate BaseService directly", () => {
      expect(() => new BaseService()).toThrow(
        "BaseService is abstract and cannot be instantiated"
      );
    });

    test("should allow instantiation of concrete implementations", () => {
      expect(() => new TestService()).not.toThrow();
    });
  });

  describe("validateEnvironment", () => {
    test("should not throw when all required variables are present", () => {
      process.env.TEST_VAR = "test_value";
      expect(() => testService.validateEnvironment(["TEST_VAR"])).not.toThrow();
    });

    test("should throw when required variables are missing", () => {
      delete process.env.MISSING_VAR;
      expect(() => testService.validateEnvironment(["MISSING_VAR"])).toThrow(
        "Missing required environment variables: MISSING_VAR"
      );
    });

    test("should throw when multiple required variables are missing", () => {
      delete process.env.VAR1;
      delete process.env.VAR2;
      expect(() => testService.validateEnvironment(["VAR1", "VAR2"])).toThrow(
        "Missing required environment variables: VAR1, VAR2"
      );
    });
  });

  describe("log", () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, "log").mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    test("should log info messages correctly", () => {
      testService.log("info", "Test message", { data: "test" });
      expect(consoleSpy).toHaveBeenCalledWith("ℹ️ [TestService] Test message", {
        data: "test"
      });
    });

    test("should log error messages correctly", () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation();
      testService.log("error", "Test error", { error: "test" });
      expect(errorSpy).toHaveBeenCalledWith("❌ [TestService] Test error", {
        error: "test"
      });
      errorSpy.mockRestore();
    });

    test("should log warning messages correctly", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      testService.log("warn", "Test warning", { warning: "test" });
      expect(warnSpy).toHaveBeenCalledWith("⚠️ [TestService] Test warning", {
        warning: "test"
      });
      warnSpy.mockRestore();
    });

    test("should log debug messages correctly", () => {
      const debugSpy = jest.spyOn(console, "debug").mockImplementation();
      testService.log("debug", "Test debug", { debug: "test" });
      expect(debugSpy).toHaveBeenCalledWith("🔍 [TestService] Test debug", {
        debug: "test"
      });
      debugSpy.mockRestore();
    });
  });

  describe("handleError", () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, "error").mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    test("should handle errors correctly", () => {
      const error = new Error("Test error");
      const result = testService.handleError(error, "testContext", {
        additional: "data"
      });

      expect(result).toEqual({
        success: false,
        error: {
          message: "Test error",
          context: "testContext",
          service: "TestService",
          timestamp: expect.any(String),
          additional: "data"
        }
      });

      expect(consoleSpy).toHaveBeenCalled();
    });

    test("should handle errors without context", () => {
      const error = new Error("Test error");
      const result = testService.handleError(error);

      expect(result.success).toBe(false);
      expect(result.error.message).toBe("Test error");
      expect(result.error.context).toBe("");
    });
  });

  describe("createSuccessResponse", () => {
    test("should create success response with data", () => {
      const data = { test: "data" };
      const result = testService.createSuccessResponse(data, "Test success");

      expect(result).toEqual({
        success: true,
        data: { test: "data" },
        message: "Test success",
        timestamp: expect.any(String)
      });
    });

    test("should create success response with default message", () => {
      const data = { test: "data" };
      const result = testService.createSuccessResponse(data);

      expect(result).toEqual({
        success: true,
        data: { test: "data" },
        message: "Operation completed successfully",
        timestamp: expect.any(String)
      });
    });

    test("should create success response without data", () => {
      const result = testService.createSuccessResponse(null, "No data");

      expect(result).toEqual({
        success: true,
        data: null,
        message: "No data",
        timestamp: expect.any(String)
      });
    });
  });

  describe("Abstract methods", () => {
    test("should throw error when healthCheck is not implemented", () => {
      const baseService = new (class extends BaseService {})();
      expect(baseService.healthCheck()).rejects.toThrow(
        "healthCheck method must be implemented"
      );
    });

    test("should throw error when shutdown is not implemented", () => {
      const baseService = new (class extends BaseService {})();
      expect(baseService.shutdown()).rejects.toThrow(
        "shutdown method must be implemented"
      );
    });
  });
});
