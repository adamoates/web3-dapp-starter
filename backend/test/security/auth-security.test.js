const request = require("supertest");
const { app } = require("../../src/index");
const { faker } = require("@faker-js/faker");

describe("Auth Security Tests", () => {
  describe("Password Security", () => {
    it("should hash passwords before storage", async () => {
      const password = "TestPass123!";
      const userData = {
        email: faker.internet.email(),
        password,
        name: faker.person.fullName()
      };

      await request(app).post("/api/auth/register").send(userData).expect(201);

      // Check database directly to ensure password is hashed
      const result = await global.testPool.query(
        "SELECT password_hash FROM users WHERE email = $1",
        [userData.email]
      );

      expect(result.rows[0].password_hash).toBeDefined();
      expect(result.rows[0].password_hash).not.toBe(password);
      expect(result.rows[0].password_hash.length).toBeGreaterThan(50);
    });

    it("should enforce strong password requirements", async () => {
      const weakPasswords = [
        "weak", // too short
        "password", // no uppercase, no numbers
        "PASSWORD", // no lowercase, no numbers
        "Password", // no numbers
        "12345678", // no letters
        "Pass123" // too short
      ];

      for (const password of weakPasswords) {
        const response = await request(app).post("/api/auth/register").send({
          email: faker.internet.email(),
          password,
          name: "Test User"
        });

        expect(response.status).toBe(400);
      }
    });
  });

  describe("JWT Security", () => {
    it("should include proper JWT claims", async () => {
      const userData = {
        email: faker.internet.email(),
        password: "TestPass123!",
        name: faker.person.fullName()
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      const token = response.body.token;
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1], "base64").toString()
      );

      expect(payload).toHaveProperty("userId");
      expect(payload).toHaveProperty("type", "access");
      expect(payload).toHaveProperty("exp");
      expect(payload).toHaveProperty("iat");
    });

    it("should expire tokens after 24 hours", async () => {
      const userData = {
        email: faker.internet.email(),
        password: "TestPass123!",
        name: faker.person.fullName()
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      const token = response.body.token;
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1], "base64").toString()
      );

      const tokenLifetime = payload.exp - payload.iat;
      expect(tokenLifetime).toBe(86400); // 24 hours in seconds
    });
  });

  describe("Input Sanitization", () => {
    it("should sanitize email input", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email: "  TEST@EXAMPLE.COM  ",
          password: "TestPass123!",
          name: "Test User"
        })
        .expect(201);

      expect(response.body.user.email).toBe("test@example.com");
    });

    it("should trim and validate name input", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email: faker.internet.email(),
          password: "TestPass123!",
          name: "  John Doe  "
        })
        .expect(201);

      expect(response.body.user.name).toBe("John Doe");
    });

    it("should reject XSS attempts in name field", async () => {
      const response = await request(app).post("/api/auth/register").send({
        email: faker.internet.email(),
        password: "TestPass123!",
        name: '<script>alert("xss")</script>'
      });

      // Should either sanitize or reject
      expect(response.status).toBeOneOf([400, 201]);
      if (response.status === 201) {
        expect(response.body.user.name).not.toContain("<script>");
      }
    });
  });
});
