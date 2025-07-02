jest.mock("nodemailer", () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({
      messageId: "test-message-id",
      response: "OK"
    })
  })
}));

const request = require("supertest");

let createApp;

describe("Email Routes Mock Integration", () => {
  let app;

  beforeAll(async () => {
    jest.resetModules();
    createApp = require("../../src/app");
    app = await createApp();
  });

  describe("Email Test Endpoints", () => {
    it("should have email test endpoint", async () => {
      const response = await request(app)
        .get("/api/email/test-email")
        .expect(200);

      expect(response.text).toContain("Email sent");
    });
  });

  describe("Database Info Endpoints", () => {
    it("should have database info endpoint", async () => {
      const response = await request(app).get("/db-info").expect(200);

      expect(response.body).toHaveProperty("databases");
      expect(response.body).toHaveProperty("architecture");
      expect(response.body.databases).toHaveProperty("postgres");
      expect(response.body.databases).toHaveProperty("mongodb");
      expect(response.body.databases).toHaveProperty("redis");
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
