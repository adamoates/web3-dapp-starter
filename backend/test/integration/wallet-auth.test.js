const request = require("supertest");
const { ethers } = require("ethers");
const createApp = require("../../src/app");

describe("Wallet Authentication Integration Tests", () => {
  let app;
  let testWallet;
  let testPrivateKey;

  beforeAll(async () => {
    // Generate a test wallet
    testWallet = ethers.Wallet.createRandom();
    testPrivateKey = testWallet.privateKey;

    app = createApp();
  });

  describe("POST /api/auth/challenge", () => {
    it("should generate a challenge for wallet authentication", async () => {
      const walletAddress = testWallet.address;

      const response = await request(app)
        .post("/api/auth/challenge")
        .send({ walletAddress })
        .expect(200);

      expect(response.body).toHaveProperty(
        "message",
        "Challenge generated successfully"
      );
      expect(response.body).toHaveProperty("challenge");
      expect(response.body.challenge).toHaveProperty("message");
      expect(response.body.challenge).toHaveProperty("nonce");
      expect(response.body.challenge).toHaveProperty("expiresAt");
      expect(response.body.challenge).toHaveProperty(
        "walletAddress",
        walletAddress
      );

      // Verify challenge message format
      const message = response.body.challenge.message;
      expect(message).toContain("Sign this message to authenticate");
      expect(message).toContain(`Wallet: ${walletAddress}`);
      expect(message).toContain(`Nonce: ${response.body.challenge.nonce}`);
    });

    it("should reject invalid wallet address", async () => {
      const response = await request(app)
        .post("/api/auth/challenge")
        .send({ walletAddress: "invalid-address" })
        .expect(400);

      expect(response.body).toHaveProperty("error", "Validation failed");
      expect(response.body).toHaveProperty("details");
    });

    it("should reject missing wallet address", async () => {
      const response = await request(app)
        .post("/api/auth/challenge")
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty("error", "Validation failed");
    });
  });

  describe("POST /api/auth/verify", () => {
    it("should verify valid signature and create new user", async () => {
      const walletAddress = testWallet.address;

      // First, get a challenge
      const challengeResponse = await request(app)
        .post("/api/auth/challenge")
        .send({ walletAddress })
        .expect(200);

      const challenge = challengeResponse.body.challenge;

      // Sign the challenge message
      const signature = await testWallet.signMessage(challenge.message);

      // Verify the signature
      const response = await request(app)
        .post("/api/auth/verify")
        .send({ walletAddress, signature })
        .expect(200);

      expect(response.body).toHaveProperty(
        "message",
        "Wallet authentication successful"
      );
      expect(response.body).toHaveProperty("user");
      expect(response.body).toHaveProperty("token");
      expect(response.body).toHaveProperty("sessionId");

      // Verify user data
      expect(response.body.user).toHaveProperty("id");
      expect(response.body.user).toHaveProperty("walletAddress", walletAddress);
      expect(response.body.user).toHaveProperty("name");
      expect(response.body.user).toHaveProperty("tenantId");

      // Verify JWT token structure
      expect(response.body.token).toBeDefined();
      expect(typeof response.body.token).toBe("string");
      expect(response.body.token.split(".")).toHaveLength(3);
    });

    it("should verify valid signature for existing user", async () => {
      const walletAddress = testWallet.address;

      // Get a challenge
      const challengeResponse = await request(app)
        .post("/api/auth/challenge")
        .send({ walletAddress })
        .expect(200);

      const challenge = challengeResponse.body.challenge;

      // Sign the challenge message
      const signature = await testWallet.signMessage(challenge.message);

      // Verify the signature (should return existing user)
      const response = await request(app)
        .post("/api/auth/verify")
        .send({ walletAddress, signature })
        .expect(200);

      expect(response.body).toHaveProperty(
        "message",
        "Wallet authentication successful"
      );
      expect(response.body.user).toHaveProperty("walletAddress", walletAddress);
    });

    it("should reject invalid signature", async () => {
      const walletAddress = testWallet.address;

      // Get a challenge
      const challengeResponse = await request(app)
        .post("/api/auth/challenge")
        .send({ walletAddress })
        .expect(200);

      const challenge = challengeResponse.body.challenge;

      // Use invalid signature
      const invalidSignature = "0x" + "1".repeat(130);

      const response = await request(app)
        .post("/api/auth/verify")
        .send({ walletAddress, signature: invalidSignature })
        .expect(401);

      expect(response.body).toHaveProperty("error", "Invalid signature");
    });

    it("should reject signature from different wallet", async () => {
      const walletAddress = testWallet.address;
      const differentWallet = ethers.Wallet.createRandom();

      // Get a challenge
      const challengeResponse = await request(app)
        .post("/api/auth/challenge")
        .send({ walletAddress })
        .expect(200);

      const challenge = challengeResponse.body.challenge;

      // Sign with different wallet
      const signature = await differentWallet.signMessage(challenge.message);

      const response = await request(app)
        .post("/api/auth/verify")
        .send({ walletAddress, signature })
        .expect(401);

      expect(response.body).toHaveProperty("error", "Invalid signature");
    });

    it("should reject expired challenge", async () => {
      const walletAddress = testWallet.address;

      // Get a challenge
      const challengeResponse = await request(app)
        .post("/api/auth/challenge")
        .send({ walletAddress })
        .expect(200);

      const challenge = challengeResponse.body.challenge;

      // Wait for challenge to expire (in real scenario, this would be 5 minutes)
      // For testing, we'll simulate by using a different challenge
      const differentWallet = ethers.Wallet.createRandom();
      const differentChallengeResponse = await request(app)
        .post("/api/auth/challenge")
        .send({ walletAddress: differentWallet.address })
        .expect(200);

      const differentChallenge = differentChallengeResponse.body.challenge;
      const signature = await testWallet.signMessage(
        differentChallenge.message
      );

      // Try to use signature from different challenge
      const response = await request(app)
        .post("/api/auth/verify")
        .send({ walletAddress, signature })
        .expect(400);

      expect(response.body).toHaveProperty(
        "error",
        "Invalid or expired challenge"
      );
    });

    it("should reject missing signature", async () => {
      const walletAddress = testWallet.address;

      const response = await request(app)
        .post("/api/auth/verify")
        .send({ walletAddress })
        .expect(400);

      expect(response.body).toHaveProperty("error", "Validation failed");
    });

    it("should reject invalid wallet address", async () => {
      const response = await request(app)
        .post("/api/auth/verify")
        .send({
          walletAddress: "invalid-address",
          signature: "0x" + "1".repeat(130)
        })
        .expect(400);

      expect(response.body).toHaveProperty("error", "Validation failed");
    });
  });

  describe("POST /api/auth/wallet-auth", () => {
    it("should handle complete wallet authentication flow", async () => {
      const walletAddress = testWallet.address;

      // Get a challenge
      const challengeResponse = await request(app)
        .post("/api/auth/challenge")
        .send({ walletAddress })
        .expect(200);

      const challenge = challengeResponse.body.challenge;

      // Sign the challenge message
      const signature = await testWallet.signMessage(challenge.message);

      // Complete authentication
      const response = await request(app)
        .post("/api/auth/wallet-auth")
        .send({ walletAddress, signature })
        .expect(200);

      expect(response.body).toHaveProperty(
        "message",
        "Wallet authentication successful"
      );
      expect(response.body).toHaveProperty("user");
      expect(response.body).toHaveProperty("token");
      expect(response.body).toHaveProperty("sessionId");
    });
  });

  describe("POST /api/auth/link-wallet", () => {
    it("should link wallet to existing user account", async () => {
      // First create a user with email
      const userData = {
        email: "test@example.com",
        password: "password123",
        name: "Test User"
      };

      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      const loginResponse = await request(app)
        .post("/api/auth/login")
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);

      const authToken = loginResponse.body.token;

      // Create a message for wallet linking
      const walletAddress = testWallet.address;
      const message = `Link wallet ${walletAddress} to your account.\n\nUser ID: ${
        registerResponse.body.user.id
      }\nTimestamp: ${Date.now()}`;

      // Sign the message
      const signature = await testWallet.signMessage(message);

      // Link wallet
      const linkResponse = await request(app)
        .post("/api/auth/link-wallet")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ walletAddress, signature })
        .expect(200);

      expect(linkResponse.body).toHaveProperty(
        "message",
        "Wallet linked successfully"
      );
      expect(linkResponse.body).toHaveProperty("user");
      expect(linkResponse.body.user).toHaveProperty(
        "walletAddress",
        walletAddress
      );
    });

    it("should reject invalid signature for wallet linking", async () => {
      // Create a user
      const userData = {
        email: "test2@example.com",
        password: "password123",
        name: "Test User 2"
      };

      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      const loginResponse = await request(app)
        .post("/api/auth/login")
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);

      const authToken = loginResponse.body.token;

      // Try to link with invalid signature
      const walletAddress = testWallet.address;
      const invalidSignature = "0x" + "1".repeat(130);

      const response = await request(app)
        .post("/api/auth/link-wallet")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ walletAddress, signature: invalidSignature })
        .expect(500);

      expect(response.body).toHaveProperty("error", "Wallet linking failed");
    });
  });

  describe("Multi-tenant wallet authentication", () => {
    it("should handle tenant-specific wallet authentication", async () => {
      const walletAddress = testWallet.address;
      const tenantId = 1; // Assuming tenant 1 exists

      // Get challenge with tenant context
      const challengeResponse = await request(app)
        .post("/api/auth/challenge")
        .set("X-Tenant-ID", tenantId.toString())
        .send({ walletAddress })
        .expect(200);

      const challenge = challengeResponse.body.challenge;

      // Sign the challenge message
      const signature = await testWallet.signMessage(challenge.message);

      // Verify with tenant context
      const response = await request(app)
        .post("/api/auth/verify")
        .set("X-Tenant-ID", tenantId.toString())
        .send({ walletAddress, signature })
        .expect(200);

      expect(response.body).toHaveProperty("user");
      expect(response.body.user).toHaveProperty("tenantId", tenantId);
    });
  });

  describe("Session management", () => {
    it("should create session with wallet authentication", async () => {
      const walletAddress = testWallet.address;

      // Get challenge and authenticate
      const challengeResponse = await request(app)
        .post("/api/auth/challenge")
        .send({ walletAddress })
        .expect(200);

      const challenge = challengeResponse.body.challenge;
      const signature = await testWallet.signMessage(challenge.message);

      const authResponse = await request(app)
        .post("/api/auth/verify")
        .send({ walletAddress, signature })
        .expect(200);

      const token = authResponse.body.token;
      const sessionId = authResponse.body.sessionId;

      // Verify session is active by accessing protected endpoint
      const profileResponse = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(profileResponse.body).toHaveProperty("profile");
    });

    it("should handle session revocation", async () => {
      const walletAddress = testWallet.address;

      // Authenticate
      const challengeResponse = await request(app)
        .post("/api/auth/challenge")
        .send({ walletAddress })
        .expect(200);

      const challenge = challengeResponse.body.challenge;
      const signature = await testWallet.signMessage(challenge.message);

      const authResponse = await request(app)
        .post("/api/auth/verify")
        .send({ walletAddress, signature })
        .expect(200);

      const token = authResponse.body.token;

      // Logout
      const logoutResponse = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(logoutResponse.body).toHaveProperty(
        "message",
        "Logged out successfully"
      );

      // Try to access protected endpoint with revoked token
      const profileResponse = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${token}`)
        .expect(401);

      expect(profileResponse.body).toHaveProperty(
        "error",
        "Invalid or expired token"
      );
    });
  });
});
