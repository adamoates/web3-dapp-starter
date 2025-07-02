const request = require("supertest");
const { faker } = require("@faker-js/faker");
const { createTestApp } = require("../setup/real");

describe("Auth Integration Tests", () => {
  let app;
  let server;

  // Test fixtures and helpers
  const generateUser = (overrides = {}) => ({
    email: faker.internet.email(),
    password: "TestPass123!",
    name: faker.person.fullName(),
    ...overrides
  });

  const createAuthenticatedUser = async (userData = null) => {
    const testUser = userData || generateUser();
    const response = await request(app)
      .post("/api/auth/register")
      .send(testUser)
      .expect(201);

    return {
      user: response.body.user,
      token: response.body.token,
      userData: testUser
    };
  };

  const assertSecurityFields = (userObject) => {
    // Ensure sensitive fields are not exposed
    expect(userObject).not.toHaveProperty("password");
    expect(userObject).not.toHaveProperty("password_hash");
    expect(userObject).not.toHaveProperty("resetToken");
    expect(userObject).not.toHaveProperty("authProvider");
    expect(userObject).not.toHaveProperty("refreshToken");
  };

  beforeAll(async () => {
    app = await createTestApp();
  }, 30000); // 30 second timeout for app setup

  afterAll(async () => {
    // Clean up any resources
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user successfully", async () => {
      const userData = generateUser();

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      expect(response.body.message).toBe("User registered successfully");
      expect(response.body.user).toBeDefined();
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.name).toBe(userData.name);

      // Security check: ensure sensitive fields are not returned
      assertSecurityFields(response.body.user);
    }, 10000);

    it("should reject registration with invalid email", async () => {
      const userData = generateUser({ email: "invalid-email" });

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
      expect(response.body.details).toBeDefined();
    });

    it("should reject weak password", async () => {
      const userData = generateUser({ password: "weak" });

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
      expect(response.body.details).toBeDefined();
    });

    it("should reject duplicate email registration", async () => {
      const userData = generateUser({ email: "duplicate@test.com" });

      // First registration
      await request(app).post("/api/auth/register").send(userData).expect(201);

      // Second registration with same email
      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(409);

      expect(response.body.error).toBe(
        "User already exists with this email or wallet address"
      );
    });

    it("should reject registration with missing required fields", async () => {
      const testCases = [
        {
          data: { password: "TestPass123!", name: "Test User" },
          field: "email"
        },
        {
          data: { email: faker.internet.email(), name: "Test User" },
          field: "password"
        },
        {
          data: { email: faker.internet.email(), password: "TestPass123!" },
          field: "name"
        }
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post("/api/auth/register")
          .send(testCase.data)
          .expect(400);

        expect(response.body.error).toBe("Validation failed");
        expect(response.body.details).toBeDefined();
      }
    });
  });

  describe("POST /api/auth/login", () => {
    let testUser;

    beforeEach(async () => {
      // Create a test user for login tests
      const userData = generateUser({ email: "login@test.com" });
      const result = await createAuthenticatedUser(userData);
      testUser = result.userData;
    }, 15000);

    it("should login with valid credentials", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body.message).toBe("Login successful");
      expect(response.body.user).toBeDefined();
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe(testUser.email);

      // Security check
      assertSecurityFields(response.body.user);
    });

    it("should reject login with invalid email", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "nonexistent@test.com",
          password: testUser.password
        })
        .expect(401);

      expect(response.body.error).toBe("Invalid email or password");
    });

    it("should reject login with invalid password", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: testUser.email,
          password: "WrongPassword123!"
        })
        .expect(401);

      expect(response.body.error).toBe("Invalid email or password");
    });

    it("should reject login with malformed email", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "invalid-email",
          password: testUser.password
        })
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
      expect(response.body.details).toBeDefined();
    });

    it("should reject login with missing credentials", async () => {
      const testCases = [
        { data: { password: testUser.password }, field: "email" },
        { data: { email: testUser.email }, field: "password" }
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post("/api/auth/login")
          .send(testCase.data)
          .expect(400);

        expect(response.body.error).toBe("Validation failed");
      }
    });
  });

  describe("GET /api/auth/profile", () => {
    let authToken;
    let testUser;

    beforeEach(async () => {
      const result = await createAuthenticatedUser();
      testUser = result.user;
      authToken = result.token;
    }, 15000);

    it("should return user profile with valid token", async () => {
      const response = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.profile).toBeDefined();
      expect(response.body.profile.id).toBe(testUser.id);
      expect(response.body.profile.email).toBe(testUser.email);
      expect(response.body.profile.name).toBe(testUser.name);

      // Security check
      assertSecurityFields(response.body.profile);
    });

    it("should reject request without token", async () => {
      const response = await request(app).get("/api/auth/profile").expect(401);

      expect(response.body.error).toBe("Access token required");
    });

    it("should reject request with invalid token", async () => {
      const response = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", "Bearer invalid.token.here")
        .expect(403);

      expect(response.body.error).toBe("Invalid or expired token");
    });

    it("should reject request with malformed authorization header", async () => {
      const response = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", "InvalidFormat")
        .expect(401);

      expect(response.body.error).toBe("Access token required");
    });

    it("should reject request with expired token", async () => {
      // Create an expired token
      const expiredToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInR5cGUiOiJ1c2VyIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid_signature";

      const response = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${expiredToken}`)
        .expect(403);

      expect(response.body.error).toBe("Invalid or expired token");
    });
  });

  describe("GET /api/auth/stats", () => {
    let authToken;

    beforeEach(async () => {
      const result = await createAuthenticatedUser();
      authToken = result.token;
    }, 15000);

    it("should return user stats with valid token", async () => {
      const response = await request(app)
        .get("/api/auth/stats")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.stats).toBeDefined();
      expect(typeof response.body.stats).toBe("object");
    });

    it("should reject request without token", async () => {
      const response = await request(app).get("/api/auth/stats").expect(401);

      expect(response.body.error).toBe("Access token required");
    });

    it("should reject request with invalid token", async () => {
      const response = await request(app)
        .get("/api/auth/stats")
        .set("Authorization", "Bearer invalid.token.here")
        .expect(403);

      expect(response.body.error).toBe("Invalid or expired token");
    });
  });

  describe("POST /api/auth/logout", () => {
    let authToken;

    beforeEach(async () => {
      const result = await createAuthenticatedUser();
      authToken = result.token;
    }, 15000);

    it("should logout successfully with valid token", async () => {
      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe("Logout successful");
    });

    it("should reject logout without token", async () => {
      const response = await request(app).post("/api/auth/logout").expect(401);

      expect(response.body.error).toBe("Access token required");
    });

    it("should reject logout with invalid token", async () => {
      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", "Bearer invalid.token.here")
        .expect(403);

      expect(response.body.error).toBe("Invalid or expired token");
    });
  });

  describe("GET /api/auth/verify", () => {
    let authToken;

    beforeEach(async () => {
      const result = await createAuthenticatedUser();
      authToken = result.token;
    }, 15000);

    it("should verify valid token", async () => {
      const response = await request(app)
        .get("/api/auth/verify")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe("Token is valid");
      expect(response.body.user).toBeDefined();
      expect(response.body.user.id).toBeDefined();
      expect(response.body.user.type).toBeDefined();

      // Security check
      assertSecurityFields(response.body.user);
    });

    it("should reject verification without token", async () => {
      const response = await request(app).get("/api/auth/verify").expect(401);

      expect(response.body.error).toBe("Access token required");
    });

    it("should reject verification with invalid token", async () => {
      const response = await request(app)
        .get("/api/auth/verify")
        .set("Authorization", "Bearer invalid.token.here")
        .expect(403);

      expect(response.body.error).toBe("Invalid or expired token");
    });

    it("should reject verification with expired token", async () => {
      const expiredToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInR5cGUiOiJ1c2VyIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid_signature";

      const response = await request(app)
        .get("/api/auth/verify")
        .set("Authorization", `Bearer ${expiredToken}`)
        .expect(403);

      expect(response.body.error).toBe("Invalid or expired token");
    });
  });

  describe("Rate Limiting", () => {
    it("should enforce rate limits on auth endpoints", async () => {
      const userData = generateUser({
        email: "rate@test.com",
        password: "WrongPass123!"
      });

      // Make 6 failed login attempts (limit is 5)
      const requests = Array(6)
        .fill()
        .map(() => request(app).post("/api/auth/login").send(userData));

      const responses = await Promise.all(requests);

      // First 5 should return 401 (invalid credentials)
      responses.slice(0, 5).forEach((response) => {
        expect(response.status).toBe(401);
      });

      // 6th should be rate limited
      expect(responses[5].status).toBe(429);
      expect(responses[5].body.error).toBeDefined();
    }, 20000);

    it("should reset rate limit after time window", async () => {
      const userData = generateUser({
        email: "reset@test.com",
        password: "WrongPass123!"
      });

      // Make 5 failed attempts to trigger rate limit
      for (let i = 0; i < 5; i++) {
        await request(app).post("/api/auth/login").send(userData).expect(401);
      }

      // 6th attempt should be rate limited
      await request(app).post("/api/auth/login").send(userData).expect(429);

      // Wait for rate limit window to reset (if configured)
      // Note: This test may need adjustment based on actual rate limit configuration
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Should be able to make requests again
      await request(app).post("/api/auth/login").send(userData).expect(401);
    }, 30000);
  });

  describe("Security Tests", () => {
    it("should not expose sensitive user information", async () => {
      const userData = generateUser();
      const result = await createAuthenticatedUser(userData);

      // Check that sensitive fields are not returned in any response
      assertSecurityFields(result.user);

      // Verify token structure
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe("string");
      expect(result.token.split(".")).toHaveLength(3); // JWT has 3 parts
    });

    it("should handle concurrent registration attempts", async () => {
      const userData = generateUser({ email: "concurrent@test.com" });

      // Attempt concurrent registrations
      const requests = Array(3)
        .fill()
        .map(() => request(app).post("/api/auth/register").send(userData));

      const responses = await Promise.all(requests);

      // Only one should succeed
      const successfulResponses = responses.filter((r) => r.status === 201);
      const failedResponses = responses.filter((r) => r.status === 409);

      expect(successfulResponses).toHaveLength(1);
      expect(failedResponses).toHaveLength(2);
    }, 20000);
  });
});
