const request = require("supertest");
const { ethers } = require("ethers");
const createApp = require("../../src/app");
const jwt = require("jsonwebtoken");

describe("Wallet Authentication Challenge-Response Flow", () => {
  let app;
  let wallet;
  let tenantId;

  beforeAll(async () => {
    app = createApp();
    // Create a tenant
    const resTenant = await request(app)
      .post("/api/tenants")
      .send({ name: "WalletTenant" });
    tenantId = resTenant.body.tenant.id;
    // Generate wallet
    wallet = ethers.Wallet.createRandom();
  });

  it("should complete the challenge-response flow and return a JWT with correct tenantId", async () => {
    // Request challenge
    const resChallenge = await request(app)
      .post("/api/auth/challenge")
      .set("X-Tenant-ID", tenantId)
      .send({ walletAddress: wallet.address });
    expect(resChallenge.status).toBe(200);
    const challenge = resChallenge.body.challenge;
    // Sign challenge
    const signature = await wallet.signMessage(challenge.message);
    // Verify
    const resVerify = await request(app)
      .post("/api/auth/verify")
      .set("X-Tenant-ID", tenantId)
      .send({ walletAddress: wallet.address, signature });
    expect(resVerify.status).toBe(200);
    expect(resVerify.body.token).toBeDefined();
    const decoded = jwt.decode(resVerify.body.token);
    expect(decoded.tenantId).toBe(tenantId);
  });

  it("should reject invalid signature", async () => {
    const resChallenge = await request(app)
      .post("/api/auth/challenge")
      .set("X-Tenant-ID", tenantId)
      .send({ walletAddress: wallet.address });
    const challenge = resChallenge.body.challenge;
    const invalidSignature = "0x" + "1".repeat(130);
    const resVerify = await request(app)
      .post("/api/auth/verify")
      .set("X-Tenant-ID", tenantId)
      .send({ walletAddress: wallet.address, signature: invalidSignature });
    expect([400, 401]).toContain(resVerify.status);
  });

  it("should reject reused/expired nonce", async () => {
    const resChallenge = await request(app)
      .post("/api/auth/challenge")
      .set("X-Tenant-ID", tenantId)
      .send({ walletAddress: wallet.address });
    const challenge = resChallenge.body.challenge;
    const signature = await wallet.signMessage(challenge.message);
    // First use (should succeed)
    await request(app)
      .post("/api/auth/verify")
      .set("X-Tenant-ID", tenantId)
      .send({ walletAddress: wallet.address, signature });
    // Second use (should fail)
    const resVerify2 = await request(app)
      .post("/api/auth/verify")
      .set("X-Tenant-ID", tenantId)
      .send({ walletAddress: wallet.address, signature });
    expect([400, 401]).toContain(resVerify2.status);
  });

  it("should reject authentication against wrong tenant", async () => {
    // Create another tenant
    const resTenant2 = await request(app)
      .post("/api/tenants")
      .send({ name: "OtherTenant" });
    const tenantId2 = resTenant2.body.tenant.id;
    // Request challenge for tenant 1
    const resChallenge = await request(app)
      .post("/api/auth/challenge")
      .set("X-Tenant-ID", tenantId)
      .send({ walletAddress: wallet.address });
    const challenge = resChallenge.body.challenge;
    const signature = await wallet.signMessage(challenge.message);
    // Try to verify with wrong tenant
    const resVerify = await request(app)
      .post("/api/auth/verify")
      .set("X-Tenant-ID", tenantId2)
      .send({ walletAddress: wallet.address, signature });
    expect([400, 401, 403]).toContain(resVerify.status);
  });
});
