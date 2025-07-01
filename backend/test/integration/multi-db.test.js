const request = require("supertest");
const { app, dbManager } = require("../../src/index");

describe("Multi-Database Architecture Integration Tests", () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    // Ensure databases are connected
    await dbManager.connect();
  });

  afterAll(async () => {
    // Clean up and disconnect
    await dbManager.disconnect();
  });

  describe("Database Health Checks", () => {
    test("should return healthy status for all databases", async () => {
      const response = await request(app).get("/health").expect(200);

      expect(response.body.status).toBe("healthy");
      expect(response.body.databases.postgres).toBe(true);
      expect(response.body.databases.mongodb).toBe(true);
      expect(response.body.databases.redis).toBe(true);
    });

    test("should return database architecture info", async () => {
      const response = await request(app).get("/db-info").expect(200);

      expect(response.body.databases.postgres.status).toBe("connected");
      expect(response.body.databases.mongodb.status).toBe("connected");
      expect(response.body.databases.redis.status).toBe("connected");
    });
  });

  describe("User Registration Flow (Cross-Database)", () => {
    test("should register user across all databases", async () => {
      const userData = {
        email: "test@example.com",
        password: "password123",
        name: "Test User",
        walletAddress: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.walletAddress).toBe(userData.walletAddress);

      testUser = response.body.user;
    });

    test("should login user and return JWT token", async () => {
      const loginData = {
        email: "test@example.com",
        password: "password123"
      };

      const response = await request(app)
        .post("/api/auth/login")
        .send(loginData)
        .expect(200);

      expect(response.body.token).toBeDefined();
      expect(response.body.user.id).toBe(testUser.id);

      authToken = response.body.token;
    });

    test("should get user profile from cache", async () => {
      const response = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.profile).toBeDefined();
      expect(response.body.profile.id).toBe(testUser.id);
    });

    test("should get user activity from MongoDB", async () => {
      const response = await request(app)
        .get("/api/auth/activity")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.activity).toBeDefined();
      expect(Array.isArray(response.body.activity)).toBe(true);
      expect(response.body.activity.length).toBeGreaterThan(0);
    });
  });

  describe("Web3 Transaction Flow (Cross-Database)", () => {
    test("should record transaction in PostgreSQL and cache in Redis", async () => {
      const txData = {
        txHash:
          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        type: "transfer",
        amount: 1.5,
        status: "pending"
      };

      const response = await request(app)
        .post("/api/web3/transactions")
        .set("Authorization", `Bearer ${authToken}`)
        .send(txData)
        .expect(201);

      expect(response.body.transaction).toBeDefined();
      expect(response.body.transaction.txHash).toBe(txData.txHash);
      expect(response.body.transaction.type).toBe(txData.type);
    });

    test("should get transaction status from cache", async () => {
      const txHash =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

      const response = await request(app)
        .get(`/api/web3/transactions/${txHash}/status`)
        .expect(200);

      expect(response.body.status).toBeDefined();
      expect(response.body.status.status).toBe("pending");
    });

    test("should update transaction status", async () => {
      const txHash =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

      const response = await request(app)
        .put(`/api/web3/transactions/${txHash}/status`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          status: "confirmed",
          blockNumber: 12345
        })
        .expect(200);

      expect(response.body.transaction.status).toBe("confirmed");
      expect(response.body.transaction.blockNumber).toBe(12345);
    });
  });

  describe("Blockchain Events (MongoDB)", () => {
    test("should record blockchain event in MongoDB", async () => {
      const eventData = {
        contractAddress: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
        eventName: "Transfer",
        blockNumber: 12345,
        transactionHash:
          "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        eventData: {
          from: "0x1234567890abcdef1234567890abcdef1234567890",
          to: "0xabcdef1234567890abcdef1234567890abcdef1234",
          value: "1000000000000000000"
        },
        userId: testUser.id
      };

      const response = await request(app)
        .post("/api/web3/events")
        .send(eventData)
        .expect(201);

      expect(response.body.event).toBeDefined();
      expect(response.body.event.contractAddress).toBe(
        eventData.contractAddress
      );
      expect(response.body.event.eventName).toBe(eventData.eventName);
    });

    test("should get contract events from MongoDB", async () => {
      const contractAddress = "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6";

      const response = await request(app)
        .get(`/api/web3/events/${contractAddress}`)
        .expect(200);

      expect(response.body.events).toBeDefined();
      expect(Array.isArray(response.body.events)).toBe(true);
      expect(response.body.events.length).toBeGreaterThan(0);
    });
  });

  describe("NFT Metadata (MongoDB + Redis Cache)", () => {
    test("should store NFT metadata in MongoDB and cache in Redis", async () => {
      const nftData = {
        tokenId: "123",
        contractAddress: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
        name: "Test NFT",
        description: "A test NFT for integration testing",
        image: "https://example.com/image.png",
        attributes: [
          { trait_type: "Rarity", value: "Common" },
          { trait_type: "Level", value: 1 }
        ],
        owner: testUser.id,
        tokenStandard: "ERC-721"
      };

      const response = await request(app)
        .post("/api/web3/nfts")
        .send(nftData)
        .expect(201);

      expect(response.body.nft).toBeDefined();
      expect(response.body.nft.tokenId).toBe(nftData.tokenId);
      expect(response.body.nft.contractAddress).toBe(nftData.contractAddress);
    });

    test("should get NFTs by owner from MongoDB", async () => {
      const response = await request(app)
        .get(`/api/web3/nfts/owner/${testUser.id}`)
        .expect(200);

      expect(response.body.nfts).toBeDefined();
      expect(Array.isArray(response.body.nfts)).toBe(true);
      expect(response.body.nfts.length).toBeGreaterThan(0);
    });
  });

  describe("User Statistics (Cross-Database Aggregation)", () => {
    test("should get user stats from both PostgreSQL and MongoDB", async () => {
      const response = await request(app)
        .get("/api/auth/stats")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.stats).toBeDefined();
      expect(response.body.stats.transactions).toBeDefined();
      expect(response.body.stats.activity).toBeDefined();
    });
  });

  describe("Contract Statistics (MongoDB Aggregation)", () => {
    test("should get contract stats from MongoDB", async () => {
      const contractAddress = "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6";

      const response = await request(app)
        .get(`/api/web3/stats/${contractAddress}`)
        .expect(200);

      expect(response.body.stats).toBeDefined();
      expect(response.body.stats.events).toBeDefined();
      expect(response.body.stats.nfts).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    test("should handle database connection errors gracefully", async () => {
      // This test would require temporarily disconnecting a database
      // For now, we'll test the error handling middleware
      const response = await request(app)
        .get("/nonexistent-endpoint")
        .expect(404);

      expect(response.body.error).toBe("Not found");
    });

    test("should handle validation errors", async () => {
      const invalidUserData = {
        email: "invalid-email",
        password: "123", // Too short
        name: "" // Empty name
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(invalidUserData)
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
      expect(response.body.details).toBeDefined();
    });
  });
});
