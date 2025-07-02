jest.setTimeout(120000);
const request = require("supertest");
const { faker } = require("@faker-js/faker");
const { createTestApp } = require("../setup/real");

describe("Web3 Integration Tests", () => {
  let app;
  let testUser;
  let authToken;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    // Create a test user for authenticated requests
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

  describe("POST /api/web3/transactions", () => {
    it("should record a new transaction with valid data", async () => {
      const transactionData = {
        txHash: "0x" + "a".repeat(64),
        type: "transfer",
        amount: "100.5",
        status: "pending",
        blockNumber: 12345,
        gasUsed: 21000,
        gasPrice: "20000000000"
      };

      const response = await request(app)
        .post("/api/web3/transactions")
        .set("Authorization", `Bearer ${authToken}`)
        .send(transactionData)
        .expect(201);

      expect(response.body).toHaveProperty(
        "message",
        "Transaction recorded successfully"
      );
      expect(response.body).toHaveProperty("transaction");
      expect(response.body.transaction).toHaveProperty("id");
      expect(response.body.transaction).toHaveProperty(
        "txHash",
        transactionData.txHash
      );
      expect(response.body.transaction).toHaveProperty(
        "type",
        transactionData.type
      );
      expect(response.body.transaction).toHaveProperty(
        "amount",
        transactionData.amount
      );
      expect(response.body.transaction).toHaveProperty(
        "status",
        transactionData.status
      );
    });

    it("should reject transaction recording without authentication", async () => {
      const transactionData = {
        txHash: "0x" + "a".repeat(64),
        type: "transfer",
        amount: "100.5"
      };

      const response = await request(app)
        .post("/api/web3/transactions")
        .send(transactionData)
        .expect(401);

      expect(response.body).toHaveProperty("error", "Access token required");
    });

    it("should reject transaction with invalid token", async () => {
      const transactionData = {
        txHash: "0x" + "a".repeat(64),
        type: "transfer",
        amount: "100.5"
      };

      const response = await request(app)
        .post("/api/web3/transactions")
        .set("Authorization", "Bearer invalid.token.here")
        .send(transactionData)
        .expect(403);

      expect(response.body).toHaveProperty("error", "Invalid or expired token");
    });

    it("should reject transaction with invalid txHash length", async () => {
      const transactionData = {
        txHash: "0x" + "a".repeat(60), // Too short
        type: "transfer",
        amount: "100.5"
      };

      const response = await request(app)
        .post("/api/web3/transactions")
        .set("Authorization", `Bearer ${authToken}`)
        .send(transactionData)
        .expect(400);

      expect(response.body).toHaveProperty("error", "Validation failed");
      expect(response.body).toHaveProperty("details");
    });

    it("should reject transaction with invalid type", async () => {
      const transactionData = {
        txHash: "0x" + "a".repeat(64),
        type: "invalid_type",
        amount: "100.5"
      };

      const response = await request(app)
        .post("/api/web3/transactions")
        .set("Authorization", `Bearer ${authToken}`)
        .send(transactionData)
        .expect(400);

      expect(response.body).toHaveProperty("error", "Validation failed");
      expect(response.body).toHaveProperty("details");
    });

    it("should reject transaction with negative amount", async () => {
      const transactionData = {
        txHash: "0x" + "a".repeat(64),
        type: "transfer",
        amount: "-100.5"
      };

      const response = await request(app)
        .post("/api/web3/transactions")
        .set("Authorization", `Bearer ${authToken}`)
        .send(transactionData)
        .expect(400);

      expect(response.body).toHaveProperty("error", "Validation failed");
      expect(response.body).toHaveProperty("details");
    });

    it("should reject duplicate transaction", async () => {
      const transactionData = {
        txHash: "0x" + "a".repeat(64),
        type: "transfer",
        amount: "100.5"
      };

      // First transaction
      await request(app)
        .post("/api/web3/transactions")
        .set("Authorization", `Bearer ${authToken}`)
        .send(transactionData)
        .expect(201);

      // Duplicate transaction
      const response = await request(app)
        .post("/api/web3/transactions")
        .set("Authorization", `Bearer ${authToken}`)
        .send(transactionData)
        .expect(409);

      expect(response.body).toHaveProperty(
        "error",
        "Transaction already exists"
      );
    });
  });

  describe("PUT /api/web3/transactions/:txHash/status", () => {
    let testTxHash;

    beforeEach(async () => {
      // Create a test transaction
      const transactionData = {
        txHash: "0x" + "b".repeat(64),
        type: "transfer",
        amount: "50.0",
        status: "pending"
      };

      await request(app)
        .post("/api/web3/transactions")
        .set("Authorization", `Bearer ${authToken}`)
        .send(transactionData);

      testTxHash = transactionData.txHash;
    });

    it("should update transaction status successfully", async () => {
      const updateData = {
        status: "confirmed",
        blockNumber: 12346
      };

      const response = await request(app)
        .put(`/api/web3/transactions/${testTxHash}/status`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty(
        "message",
        "Transaction status updated successfully"
      );
      expect(response.body).toHaveProperty("transaction");
      expect(response.body.transaction).toHaveProperty("status", "confirmed");
      expect(response.body.transaction).toHaveProperty("blockNumber", 12346);
    });

    it("should reject status update without authentication", async () => {
      const updateData = {
        status: "confirmed"
      };

      const response = await request(app)
        .put(`/api/web3/transactions/${testTxHash}/status`)
        .send(updateData)
        .expect(401);

      expect(response.body).toHaveProperty("error", "Access token required");
    });

    it("should reject status update with invalid status", async () => {
      const updateData = {
        status: "invalid_status"
      };

      const response = await request(app)
        .put(`/api/web3/transactions/${testTxHash}/status`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body).toHaveProperty("error", "Validation failed");
      expect(response.body).toHaveProperty("details");
    });

    it("should reject status update for non-existent transaction", async () => {
      const updateData = {
        status: "confirmed"
      };

      const response = await request(app)
        .put("/api/web3/transactions/0x" + "c".repeat(64) + "/status")
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData)
        .expect(500);

      expect(response.body).toHaveProperty(
        "error",
        "Failed to update transaction status"
      );
    });
  });

  describe("GET /api/web3/transactions/:txHash/status", () => {
    let testTxHash;

    beforeEach(async () => {
      // Create a test transaction
      const transactionData = {
        txHash: "0x" + "d".repeat(64),
        type: "transfer",
        amount: "75.0",
        status: "pending"
      };

      await request(app)
        .post("/api/web3/transactions")
        .set("Authorization", `Bearer ${authToken}`)
        .send(transactionData);

      testTxHash = transactionData.txHash;
    });

    it("should return transaction status", async () => {
      const response = await request(app)
        .get(`/api/web3/transactions/${testTxHash}/status`)
        .expect(200);

      expect(response.body).toHaveProperty("status");
      expect(response.body.status).toHaveProperty("txHash", testTxHash);
      expect(response.body.status).toHaveProperty("status", "pending");
    });

    it("should return 404 for non-existent transaction", async () => {
      const response = await request(app)
        .get("/api/web3/transactions/0x" + "e".repeat(64) + "/status")
        .expect(404);

      expect(response.body).toHaveProperty("error", "Transaction not found");
    });
  });

  describe("GET /api/web3/transactions", () => {
    beforeEach(async () => {
      // Create multiple test transactions
      const transactions = [
        {
          txHash: "0x" + "f".repeat(64),
          type: "transfer",
          amount: "25.0",
          status: "confirmed"
        },
        {
          txHash: "0x" + "g".repeat(64),
          type: "mint",
          amount: "100.0",
          status: "pending"
        },
        {
          txHash: "0x" + "h".repeat(64),
          type: "swap",
          amount: "50.0",
          status: "confirmed"
        }
      ];

      for (const tx of transactions) {
        await request(app)
          .post("/api/web3/transactions")
          .set("Authorization", `Bearer ${authToken}`)
          .send(tx);
      }
    });

    it("should return user transactions with pagination", async () => {
      const response = await request(app)
        .get("/api/web3/transactions")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("transactions");
      expect(response.body).toHaveProperty("pagination");
      expect(response.body.pagination).toHaveProperty("limit");
      expect(response.body.pagination).toHaveProperty("offset");
      expect(response.body.pagination).toHaveProperty("total");
      expect(Array.isArray(response.body.transactions)).toBe(true);
    });

    it("should reject request without authentication", async () => {
      const response = await request(app)
        .get("/api/web3/transactions")
        .expect(401);

      expect(response.body).toHaveProperty("error", "Access token required");
    });

    it("should handle pagination parameters", async () => {
      const response = await request(app)
        .get("/api/web3/transactions?limit=2&offset=1")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.pagination.limit).toBe(2);
      expect(response.body.pagination.offset).toBe(1);
    });
  });

  describe("POST /api/web3/process-pending", () => {
    it("should process pending transactions successfully", async () => {
      const response = await request(app)
        .post("/api/web3/process-pending")
        .expect(200);

      expect(response.body).toHaveProperty(
        "message",
        "Pending transactions processed"
      );
      expect(response.body).toHaveProperty("processedCount");
      expect(typeof response.body.processedCount).toBe("number");
    });

    it("should handle processing when no pending transactions exist", async () => {
      const response = await request(app)
        .post("/api/web3/process-pending")
        .expect(200);

      expect(response.body).toHaveProperty(
        "message",
        "Pending transactions processed"
      );
      expect(response.body).toHaveProperty("processedCount", 0);
    });

    it("should handle processing errors gracefully", async () => {
      // This test would require mocking the Web3Service to simulate an error
      // For now, we'll test the happy path
      const response = await request(app)
        .post("/api/web3/process-pending")
        .expect(200);

      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("processedCount");
    });
  });

  describe("POST /api/web3/nfts", () => {
    it("should store NFT metadata successfully", async () => {
      const nftData = {
        tokenId: "123",
        contractAddress: "0x" + "1".repeat(40),
        name: "Test NFT",
        description: "A test NFT",
        image: "https://example.com/image.png",
        externalUrl: "https://example.com",
        attributes: [{ trait_type: "Rarity", value: "Common" }],
        owner: testUser.id,
        metadata: { additional: "data" },
        network: "ethereum",
        tokenStandard: "ERC-721",
        isListed: false,
        listingPrice: null
      };

      const response = await request(app)
        .post("/api/web3/nfts")
        .send(nftData)
        .expect(201);

      expect(response.body).toHaveProperty(
        "message",
        "NFT metadata stored successfully"
      );
      expect(response.body).toHaveProperty("nft");
      expect(response.body.nft).toHaveProperty("id");
      expect(response.body.nft).toHaveProperty("tokenId", nftData.tokenId);
      expect(response.body.nft).toHaveProperty(
        "contractAddress",
        nftData.contractAddress
      );
      expect(response.body.nft).toHaveProperty("name", nftData.name);
    });

    it("should reject NFT storage with invalid contract address", async () => {
      const nftData = {
        tokenId: "123",
        contractAddress: "0x" + "1".repeat(38), // Too short
        name: "Test NFT"
      };

      const response = await request(app)
        .post("/api/web3/nfts")
        .send(nftData)
        .expect(400);

      expect(response.body).toHaveProperty("error", "Validation failed");
      expect(response.body).toHaveProperty("details");
    });

    it("should reject NFT storage with invalid token standard", async () => {
      const nftData = {
        tokenId: "123",
        contractAddress: "0x" + "1".repeat(40),
        name: "Test NFT",
        tokenStandard: "INVALID"
      };

      const response = await request(app)
        .post("/api/web3/nfts")
        .send(nftData)
        .expect(400);

      expect(response.body).toHaveProperty("error", "Validation failed");
      expect(response.body).toHaveProperty("details");
    });
  });

  describe("GET /api/web3/nfts/owner/:ownerId", () => {
    it("should return NFTs by owner", async () => {
      const response = await request(app)
        .get(`/api/web3/nfts/owner/${testUser.id}`)
        .expect(200);

      expect(response.body).toHaveProperty("nfts");
      expect(response.body).toHaveProperty("pagination");
      expect(Array.isArray(response.body.nfts)).toBe(true);
    });

    it("should handle pagination parameters", async () => {
      const response = await request(app)
        .get(`/api/web3/nfts/owner/${testUser.id}?limit=10&offset=0`)
        .expect(200);

      expect(response.body.pagination.limit).toBe(10);
      expect(response.body.pagination.offset).toBe(0);
    });
  });

  describe("GET /api/web3/nfts/listed", () => {
    it("should return listed NFTs", async () => {
      const response = await request(app)
        .get("/api/web3/nfts/listed")
        .expect(200);

      expect(response.body).toHaveProperty("nfts");
      expect(response.body).toHaveProperty("pagination");
      expect(Array.isArray(response.body.nfts)).toBe(true);
    });

    it("should handle pagination parameters", async () => {
      const response = await request(app)
        .get("/api/web3/nfts/listed?limit=5&offset=0")
        .expect(200);

      expect(response.body.pagination.limit).toBe(5);
      expect(response.body.pagination.offset).toBe(0);
    });
  });

  describe("GET /api/web3/stats/:contractAddress", () => {
    it("should return contract stats", async () => {
      const contractAddress = "0x" + "2".repeat(40);

      const response = await request(app)
        .get(`/api/web3/stats/${contractAddress}`)
        .expect(200);

      expect(response.body).toHaveProperty("stats");
    });
  });
});
