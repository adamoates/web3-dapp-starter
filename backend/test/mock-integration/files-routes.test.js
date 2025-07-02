const request = require("supertest");
const createApp = require("../../src/app");

describe("Files Routes Mock Integration", () => {
  let app;

  beforeAll(async () => {
    app = await createApp();
  });

  describe("Health Check Endpoints", () => {
    it("should have health check endpoint", async () => {
      const response = await request(app).get("/health").expect(200);

      expect(response.body).toHaveProperty("status");
      expect(response.body).toHaveProperty("databases");
      expect(response.body).toHaveProperty("storage");
    });

    it("should have MinIO status endpoint", async () => {
      const response = await request(app).get("/minio-status").expect(200);

      expect(response.body).toHaveProperty("bucket");
      expect(response.body).toHaveProperty("exists");
      expect(response.body).toHaveProperty("status");
    });
  });

  describe("Database Status Endpoints", () => {
    it("should have PostgreSQL status endpoint", async () => {
      const response = await request(app).get("/postgres-status").expect(200);

      expect(response.body).toHaveProperty("now");
    });

    it("should have MongoDB status endpoint", async () => {
      const response = await request(app).get("/mongo-status").expect(200);

      expect(response.body).toBeDefined();
    });

    it("should have cache test endpoint", async () => {
      const response = await request(app).get("/cache-test").expect(200);

      expect(response.body).toContain("Redis says:");
    });
  });

  describe("Route Structure", () => {
    it("should have basic app structure", async () => {
      // Test that the app is working
      const response = await request(app).get("/ping").expect(200);

      expect(response.text).toBe("pong");
    });

    it("should handle unknown routes", async () => {
      const response = await request(app).get("/api/nonexistent").expect(404);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("Protected Routes", () => {
    it("should require authentication for protected endpoints", async () => {
      // Test that protected routes return 401 without auth
      const response = await request(app).get("/api/auth/profile").expect(401);

      expect(response.body).toHaveProperty("error");
    });
  });
});
