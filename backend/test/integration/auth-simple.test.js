const request = require("supertest");
const { faker } = require("@faker-js/faker");
const { createTestApp } = require("../setup/real");

describe("Auth Integration Tests (Simplified)", () => {
  let app;

  beforeAll(async () => {
    app = await createTestApp();
  });
  describe("POST /api/auth/register", () => {
    it("should register a new user successfully", async () => {
      const userData = {
        email: faker.internet.email(),
        password: "TestPass123!",
        name: faker.person.fullName()
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty(
        "message",
        "User registered successfully"
      );
      expect(response.body).toHaveProperty("user");
      expect(response.body).toHaveProperty("token");
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user).not.toHaveProperty("password_hash");
    });

    it("should reject registration with invalid email", async () => {
      const userData = {
        email: "invalid-email",
        password: "TestPass123!",
        name: "Test User"
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty("error", "Validation failed");
      expect(response.body).toHaveProperty("details");
    });

    it("should reject weak password", async () => {
      const userData = {
        email: faker.internet.email(),
        password: "weak",
        name: "Test User"
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty("error", "Validation failed");
      expect(response.body).toHaveProperty("details");
    });
  });

  describe("POST /api/auth/login", () => {
    let testUser;

    beforeEach(async () => {
      // Create a test user for login tests
      const userData = {
        email: "login@test.com",
        password: "TestPass123!",
        name: "Login User"
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData);

      testUser = { ...userData, id: response.body.user.id };
    });

    it("should login with valid credentials", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body).toHaveProperty("message", "Login successful");
      expect(response.body).toHaveProperty("user");
      expect(response.body).toHaveProperty("token");
      expect(response.body.user.email).toBe(testUser.email);
    });

    it("should reject login with invalid email", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "nonexistent@test.com",
          password: testUser.password
        })
        .expect(401);

      expect(response.body).toHaveProperty(
        "error",
        "Invalid email or password"
      );
    });

    it("should reject login with invalid password", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: testUser.email,
          password: "WrongPassword123!"
        })
        .expect(401);

      expect(response.body).toHaveProperty(
        "error",
        "Invalid email or password"
      );
    });

    it("should reject login with malformed email", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "invalid-email",
          password: testUser.password
        })
        .expect(400);

      expect(response.body).toHaveProperty("error", "Validation failed");
      expect(response.body).toHaveProperty("details");
    });
  });

  describe("GET /api/auth/profile", () => {
    let testUser;
    let authToken;

    beforeEach(async () => {
      // Register and login to get token
      const userData = {
        email: faker.internet.email(),
        password: "TestPass123!",
        name: faker.person.fullName()
      };

      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send(userData);

      testUser = registerResponse.body.user;
      authToken = registerResponse.body.token;
    });

    it("should return user profile with valid token", async () => {
      const response = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("profile");
      expect(response.body.profile).toHaveProperty("id");
      expect(response.body.profile).toHaveProperty("email");
      expect(response.body.profile).toHaveProperty("name");
    });

    it("should reject request without token", async () => {
      const response = await request(app).get("/api/auth/profile").expect(401);

      expect(response.body).toHaveProperty("error", "Access token required");
    });

    it("should reject request with invalid token", async () => {
      const response = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", "Bearer invalid.token.here")
        .expect(403);

      expect(response.body).toHaveProperty("error", "Invalid or expired token");
    });
  });

  describe("GET /api/auth/stats", () => {
    let testUser;
    let authToken;

    beforeEach(async () => {
      // Register and login to get token
      const userData = {
        email: faker.internet.email(),
        password: "TestPass123!",
        name: faker.person.fullName()
      };

      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send(userData);

      testUser = registerResponse.body.user;
      authToken = registerResponse.body.token;
    });

    it("should return user stats with valid token", async () => {
      const response = await request(app)
        .get("/api/auth/stats")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("stats");
      expect(response.body.stats).toBeDefined();
    });

    it("should reject request without token", async () => {
      const response = await request(app).get("/api/auth/stats").expect(401);

      expect(response.body).toHaveProperty("error", "Access token required");
    });

    it("should reject request with invalid token", async () => {
      const response = await request(app)
        .get("/api/auth/stats")
        .set("Authorization", "Bearer invalid.token.here")
        .expect(403);

      expect(response.body).toHaveProperty("error", "Invalid or expired token");
    });
  });

  describe("POST /api/auth/logout", () => {
    let testUser;
    let authToken;

    beforeEach(async () => {
      const userData = {
        email: faker.internet.email(),
        password: "TestPass123!",
        name: faker.person.fullName()
      };

      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send(userData);

      testUser = registerResponse.body.user;
      authToken = registerResponse.body.token;
    });

    it("should logout successfully with valid token", async () => {
      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("message", "Logout successful");
    });

    it("should reject logout without token", async () => {
      const response = await request(app).post("/api/auth/logout").expect(401);

      expect(response.body).toHaveProperty("error", "Access token required");
    });

    it("should reject logout with invalid token", async () => {
      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", "Bearer invalid.token.here")
        .expect(403);

      expect(response.body).toHaveProperty("error", "Invalid or expired token");
    });
  });

  describe("GET /api/auth/verify", () => {
    let testUser;
    let authToken;

    beforeEach(async () => {
      const userData = {
        email: faker.internet.email(),
        password: "TestPass123!",
        name: faker.person.fullName()
      };

      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send(userData);

      testUser = registerResponse.body.user;
      authToken = registerResponse.body.token;
    });

    it("should verify valid token", async () => {
      const response = await request(app)
        .get("/api/auth/verify")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("message", "Token is valid");
      expect(response.body).toHaveProperty("user");
      expect(response.body.user).toHaveProperty("id");
      expect(response.body.user).toHaveProperty("type");
    });

    it("should reject verification without token", async () => {
      const response = await request(app).get("/api/auth/verify").expect(401);

      expect(response.body).toHaveProperty("error", "Access token required");
    });

    it("should reject verification with invalid token", async () => {
      const response = await request(app)
        .get("/api/auth/verify")
        .set("Authorization", "Bearer invalid.token.here")
        .expect(403);

      expect(response.body).toHaveProperty("error", "Invalid or expired token");
    });
  });
});

describe("Auth Integration Tests (Real Databases)", () => {
  let app;

  beforeAll(async () => {
    app = await createTestApp();
  });

  describe("POST /api/auth/register", () => {
    it("should register user with real database", async () => {
      const userData = {
        email: faker.internet.email(),
        password: "TestPass123!",
        name: faker.person.fullName()
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty(
        "message",
        "User created successfully"
      );
      expect(response.body).toHaveProperty("user");
      expect(response.body).toHaveProperty("token");
      expect(response.body.user).toHaveProperty("id");
      expect(response.body.user.email).toBe(userData.email);

      // Verify user exists in real database
      const userResult = await global.testPool.query(
        "SELECT * FROM users WHERE email = $1",
        [userData.email]
      );
      expect(userResult.rows).toHaveLength(1);
    });

    it("should enforce unique email constraint", async () => {
      const userData = {
        email: "duplicate@test.com",
        password: "TestPass123!",
        name: "Test User"
      };

      // First registration
      await request(app).post("/api/auth/register").send(userData).expect(201);

      // Second registration with same email
      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(409);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("Complete Auth Flow", () => {
    let testUser;
    let authToken;

    beforeEach(async () => {
      // Register a real user for each test
      const userData = {
        email: faker.internet.email(),
        password: "TestPass123!",
        name: faker.person.fullName()
      };

      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      testUser = { ...userData, ...registerResponse.body.user };
      authToken = registerResponse.body.token;
    });

    it("should login with valid credentials", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body).toHaveProperty("message", "Login successful");
      expect(response.body).toHaveProperty("token");
      expect(response.body.user.email).toBe(testUser.email);
    });

    it("should access protected profile endpoint", async () => {
      const response = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("profile");
      expect(response.body.profile.id).toBe(testUser.id);
      expect(response.body.profile.email).toBe(testUser.email);
    });

    it("should access user stats endpoint", async () => {
      const response = await request(app)
        .get("/api/auth/stats")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("stats");
    });

    it("should logout successfully", async () => {
      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("message", "Logout successful");
    });
  });
});
