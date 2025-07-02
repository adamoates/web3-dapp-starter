const request = require("supertest");
const { createTestApp } = require("../setup/real");
const { createTestUser, generateUserData } = require("../helpers/testHelpers");

describe("Auth Performance Tests", () => {
  let app;

  beforeAll(async () => {
    app = await createTestApp();
  });
  describe("Password Hashing Performance", () => {
    it("should hash passwords within reasonable time", async () => {
      const userData = generateUserData();

      const startTime = Date.now();
      const response = await request(app)
        .post("/api/auth/register")
        .send(userData);
      const endTime = Date.now();

      expect(response.status).toBe(201);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });

  describe("Login Performance", () => {
    let testUser;

    beforeEach(async () => {
      const result = await createTestUser(app);
      testUser = result;
    });

    it("should login within reasonable time", async () => {
      const startTime = Date.now();
      const response = await request(app).post("/api/auth/login").send({
        email: testUser.userData.email,
        password: testUser.userData.password
      });
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe("Concurrent User Registration", () => {
    it("should handle multiple simultaneous registrations", async () => {
      const userCount = 10;
      const registrationPromises = [];

      for (let i = 0; i < userCount; i++) {
        const userData = generateUserData();
        registrationPromises.push(
          request(app).post("/api/auth/register").send(userData)
        );
      }

      const responses = await Promise.all(registrationPromises);

      responses.forEach((response) => {
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty("token");
      });
    });
  });
});
