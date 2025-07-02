const request = require("supertest");
const createApp = require("../../src/app");
const {
  setupRealDatabases,
  cleanupRealDatabases,
  cleanAllDatabases,
  getDbManager
} = require("../setup/real");
const {
  generateUserData,
  generateInvalidUserData,
  createTestUser,
  loginTestUser,
  authenticatedRequest,
  assertErrorResponse,
  assertSuccessResponse,
  assertJWTToken,
  assertUserObject,
  wait
} = require("../setup/helpers");

describe("Auth Routes (Real Integration Tests)", () => {
  let app;
  let dbManager;

  beforeAll(async () => {
    // Setup real database connections
    const setup = await setupRealDatabases();
    dbManager = setup.dbManager;

    // Create Express app with real database connections
    app = createApp({ dbManager });
  });

  afterAll(async () => {
    await cleanupRealDatabases();
  });

  beforeEach(async () => {
    // Clean all databases before each test
    await cleanAllDatabases();
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user successfully", async () => {
      const userData = generateUserData();

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("user");
      expect(response.body).toHaveProperty("token");
      expect(response.body.message).toBe("User registered successfully");

      assertUserObject(response.body.user);
      assertJWTToken(response.body.token);
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.name).toBe(userData.name);
      expect(response.body.user.walletAddress).toBe(userData.walletAddress);
    });

    it("should register user without wallet address", async () => {
      const { walletAddress, ...userDataWithoutWallet } = generateUserData();

      const response = await request(app)
        .post("/api/auth/register")
        .send(userDataWithoutWallet);

      expect(response.status).toBe(201);
      expect(response.body.user.walletAddress).toBeNull();
    });

    it("should return 400 for invalid email", async () => {
      const invalidData = generateInvalidUserData("email");

      const response = await request(app)
        .post("/api/auth/register")
        .send(invalidData);

      assertErrorResponse(response, 400, "Invalid email format");
    });

    it("should return 400 for weak password", async () => {
      const invalidData = generateInvalidUserData("password");

      const response = await request(app)
        .post("/api/auth/register")
        .send(invalidData);

      assertErrorResponse(
        response,
        400,
        "Password must be at least 8 characters long"
      );
    });

    it("should return 400 for short name", async () => {
      const invalidData = generateInvalidUserData("name");

      const response = await request(app)
        .post("/api/auth/register")
        .send(invalidData);

      assertErrorResponse(
        response,
        400,
        "Name must be at least 2 characters long"
      );
    });

    it("should return 400 for invalid wallet address", async () => {
      const invalidData = generateInvalidUserData("wallet");

      const response = await request(app)
        .post("/api/auth/register")
        .send(invalidData);

      assertErrorResponse(response, 400, "Invalid wallet address format");
    });

    it("should return 409 for existing email", async () => {
      const userData = generateUserData();

      // Register first user
      await request(app).post("/api/auth/register").send(userData);

      // Try to register with same email
      const response = await request(app)
        .post("/api/auth/register")
        .send(userData);

      assertErrorResponse(response, 409, "Email already registered");
    });

    it("should return 409 for existing wallet address", async () => {
      const userData1 = generateUserData();
      const userData2 = generateUserData();

      // Set same wallet address
      userData2.walletAddress = userData1.walletAddress;

      // Register first user
      await request(app).post("/api/auth/register").send(userData1);

      // Try to register with same wallet address
      const response = await request(app)
        .post("/api/auth/register")
        .send(userData2);

      assertErrorResponse(response, 409, "Wallet address already registered");
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login user successfully", async () => {
      const userData = generateUserData();

      // Register user first
      await request(app).post("/api/auth/register").send(userData);

      // Login with same credentials
      const response = await request(app).post("/api/auth/login").send({
        email: userData.email,
        password: userData.password
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("user");
      expect(response.body).toHaveProperty("token");
      expect(response.body.message).toBe("Login successful");

      assertUserObject(response.body.user);
      assertJWTToken(response.body.token);
      expect(response.body.user.email).toBe(userData.email);
    });

    it("should return 400 for missing email", async () => {
      const loginData = { password: "TestPass123!" };

      const response = await request(app)
        .post("/api/auth/login")
        .send(loginData);

      assertErrorResponse(response, 400, "Email is required");
    });

    it("should return 400 for missing password", async () => {
      const loginData = { email: "test@example.com" };

      const response = await request(app)
        .post("/api/auth/login")
        .send(loginData);

      assertErrorResponse(response, 400, "Password is required");
    });

    it("should return 401 for non-existent user", async () => {
      const loginData = {
        email: "nonexistent@example.com",
        password: "TestPass123!"
      };

      const response = await request(app)
        .post("/api/auth/login")
        .send(loginData);

      assertErrorResponse(response, 401, "Invalid credentials");
    });

    it("should return 401 for wrong password", async () => {
      const userData = generateUserData();

      // Register user first
      await request(app).post("/api/auth/register").send(userData);

      // Login with wrong password
      const response = await request(app).post("/api/auth/login").send({
        email: userData.email,
        password: "WrongPass123!"
      });

      assertErrorResponse(response, 401, "Invalid credentials");
    });
  });

  describe("GET /api/auth/profile", () => {
    it("should return user profile with valid token", async () => {
      const { user, token } = await createTestUser(app);

      const response = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("user");
      assertUserObject(response.body.user);
      expect(response.body.user.id).toBe(user.id);
    });

    it("should return 401 for missing token", async () => {
      const response = await request(app).get("/api/auth/profile");

      assertErrorResponse(response, 401, "Access token required");
    });

    it("should return 401 for invalid token", async () => {
      const response = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", "Bearer invalid.token.here");

      assertErrorResponse(response, 401, "Invalid or expired token");
    });

    it("should return 401 for expired token", async () => {
      // Create a token that expires in 1 second
      const userData = generateUserData();
      const jwt = require("jsonwebtoken");
      const expiredToken = jwt.sign(
        { userId: 1, type: "access" },
        process.env.JWT_SECRET || "test-secret-key",
        { expiresIn: "1s" }
      );

      // Wait for token to expire
      await wait(2000);

      const response = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${expiredToken}`);

      assertErrorResponse(response, 401, "Invalid or expired token");
    });
  });

  describe("GET /api/auth/stats", () => {
    it("should return user stats with valid token", async () => {
      const { user, token } = await createTestUser(app);

      const response = await request(app)
        .get("/api/auth/stats")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("stats");
      expect(response.body.stats).toHaveProperty("totalTransactions");
      expect(response.body.stats).toHaveProperty("totalVolume");
      expect(response.body.stats).toHaveProperty("nftCount");
    });

    it("should return 401 for missing token", async () => {
      const response = await request(app).get("/api/auth/stats");

      assertErrorResponse(response, 401, "Access token required");
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should logout user successfully", async () => {
      const { token } = await createTestUser(app);

      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Logout successful");
    });

    it("should return 401 for missing token", async () => {
      const response = await request(app).post("/api/auth/logout");

      assertErrorResponse(response, 401, "Access token required");
    });

    it("should blacklist token after logout", async () => {
      const { token } = await createTestUser(app);

      // Logout
      await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${token}`);

      // Try to use the same token
      const response = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${token}`);

      assertErrorResponse(response, 401, "Invalid or expired token");
    });
  });

  describe("GET /api/auth/verify", () => {
    it("should verify valid token", async () => {
      const { user, token } = await createTestUser(app);

      const response = await request(app)
        .get("/api/auth/verify")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("valid", true);
      expect(response.body).toHaveProperty("user");
      assertUserObject(response.body.user);
      expect(response.body.user.id).toBe(user.id);
    });

    it("should return 401 for invalid token", async () => {
      const response = await request(app)
        .get("/api/auth/verify")
        .set("Authorization", "Bearer invalid.token.here");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("valid", false);
      expect(response.body).toHaveProperty("error", "Invalid or expired token");
    });

    it("should return 401 for missing token", async () => {
      const response = await request(app).get("/api/auth/verify");

      assertErrorResponse(response, 401, "Access token required");
    });
  });

  describe("PUT /api/auth/profile", () => {
    it("should update user profile successfully", async () => {
      const { token } = await createTestUser(app);
      const updates = {
        name: "Updated Name",
        email: "updated@example.com"
      };

      const response = await request(app)
        .put("/api/auth/profile")
        .set("Authorization", `Bearer ${token}`)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("user");
      expect(response.body.message).toBe("Profile updated successfully");
      assertUserObject(response.body.user);
      expect(response.body.user.name).toBe(updates.name);
      expect(response.body.user.email).toBe(updates.email);
    });

    it("should return 400 for invalid email", async () => {
      const { token } = await createTestUser(app);
      const invalidUpdates = {
        email: "invalid-email"
      };

      const response = await request(app)
        .put("/api/auth/profile")
        .set("Authorization", `Bearer ${token}`)
        .send(invalidUpdates);

      assertErrorResponse(response, 400, "Invalid email format");
    });

    it("should return 401 for missing token", async () => {
      const updates = { name: "Updated Name" };

      const response = await request(app)
        .put("/api/auth/profile")
        .send(updates);

      assertErrorResponse(response, 401, "Access token required");
    });

    it("should return 409 for email already in use", async () => {
      const user1 = await createTestUser(app);
      const user2 = await createTestUser(app);

      const response = await request(app)
        .put("/api/auth/profile")
        .set("Authorization", `Bearer ${user2.token}`)
        .send({ email: user1.userData.email });

      assertErrorResponse(response, 409, "Email already in use");
    });
  });

  describe("POST /api/auth/link-wallet", () => {
    it("should link wallet successfully", async () => {
      const { token } = await createTestUser(app);
      const walletData = {
        walletAddress: "0x1234567890abcdef",
        signature: "0xsignature"
      };

      const response = await request(app)
        .post("/api/auth/link-wallet")
        .set("Authorization", `Bearer ${token}`)
        .send(walletData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("user");
      expect(response.body.message).toBe("Wallet linked successfully");
      assertUserObject(response.body.user);
      expect(response.body.user.walletAddress).toBe(walletData.walletAddress);
    });

    it("should return 400 for invalid wallet address", async () => {
      const { token } = await createTestUser(app);
      const invalidWalletData = {
        walletAddress: "invalid-wallet",
        signature: "0xsignature"
      };

      const response = await request(app)
        .post("/api/auth/link-wallet")
        .set("Authorization", `Bearer ${token}`)
        .send(invalidWalletData);

      assertErrorResponse(response, 400, "Invalid wallet address format");
    });

    it("should return 401 for missing token", async () => {
      const walletData = {
        walletAddress: "0x1234567890abcdef",
        signature: "0xsignature"
      };

      const response = await request(app)
        .post("/api/auth/link-wallet")
        .send(walletData);

      assertErrorResponse(response, 401, "Access token required");
    });

    it("should return 409 for wallet already linked to another user", async () => {
      const user1 = await createTestUser(app);
      const user2 = await createTestUser(app);

      // Link wallet to first user
      await request(app)
        .post("/api/auth/link-wallet")
        .set("Authorization", `Bearer ${user1.token}`)
        .send({
          walletAddress: "0x1234567890abcdef",
          signature: "0xsignature1"
        });

      // Try to link same wallet to second user
      const response = await request(app)
        .post("/api/auth/link-wallet")
        .set("Authorization", `Bearer ${user2.token}`)
        .send({
          walletAddress: "0x1234567890abcdef",
          signature: "0xsignature2"
        });

      assertErrorResponse(
        response,
        409,
        "Wallet address already linked to another user"
      );
    });
  });

  describe("Database Integration", () => {
    it("should persist user data across requests", async () => {
      const userData = generateUserData();

      // Register user
      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send(userData);

      expect(registerResponse.status).toBe(201);
      const userId = registerResponse.body.user.id;

      // Login user
      const loginResponse = await request(app).post("/api/auth/login").send({
        email: userData.email,
        password: userData.password
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.user.id).toBe(userId);

      // Get profile
      const profileResponse = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${loginResponse.body.token}`);

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.user.id).toBe(userId);
    });

    it("should handle concurrent user registrations", async () => {
      const userData1 = generateUserData();
      const userData2 = generateUserData();

      // Register two users concurrently
      const [response1, response2] = await Promise.all([
        request(app).post("/api/auth/register").send(userData1),
        request(app).post("/api/auth/register").send(userData2)
      ]);

      expect(response1.status).toBe(201);
      expect(response2.status).toBe(201);
      expect(response1.body.user.id).not.toBe(response2.body.user.id);
    });
  });
});
