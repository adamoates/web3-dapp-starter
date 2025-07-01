// Shared test utilities
const { faker } = require("@faker-js/faker");
const request = require("supertest");
const jwt = require("jsonwebtoken");

/**
 * Generate valid user data for testing
 */
const generateUserData = (overrides = {}) => ({
  email: faker.internet.email(),
  password: "TestPass123!",
  name: faker.person.fullName(),
  walletAddress: "0x" + faker.string.alphanumeric(40),
  ...overrides
});

/**
 * Generate invalid user data for testing validation
 */
const generateInvalidUserData = (type = "email") => {
  const baseData = {
    password: "TestPass123!",
    name: faker.person.fullName()
  };

  switch (type) {
    case "email":
      return { ...baseData, email: "invalid-email" };
    case "password":
      return { ...baseData, email: faker.internet.email(), password: "weak" };
    case "name":
      return { ...baseData, email: faker.internet.email(), name: "A" };
    case "wallet":
      return {
        ...baseData,
        email: faker.internet.email(),
        walletAddress: "invalid-wallet"
      };
    default:
      return baseData;
  }
};

/**
 * Create a test user and return user data with token
 */
const createTestUser = async (app, userData = null) => {
  const testData = userData || generateUserData();

  const response = await request(app).post("/api/auth/register").send(testData);

  return {
    userData: testData,
    user: response.body.user,
    token: response.body.token,
    response
  };
};

/**
 * Login and get token for existing user
 */
const loginTestUser = async (app, email, password) => {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ email, password });

  return {
    user: response.body.user,
    token: response.body.token,
    response
  };
};

/**
 * Make authenticated request
 */
const authenticatedRequest = (app, method, url, token, data = null) => {
  const req = request(app)[method](url).set("Authorization", `Bearer ${token}`);
  if (data) {
    return req.send(data);
  }
  return req;
};

/**
 * Generate a valid JWT token for testing
 */
const generateTestToken = (userId = 1, expiresIn = "24h") => {
  return jwt.sign(
    { userId, type: "access" },
    process.env.JWT_SECRET || "test-secret-key",
    { expiresIn }
  );
};

/**
 * Generate an expired JWT token for testing
 */
const generateExpiredToken = (userId = 1) => {
  return jwt.sign(
    { userId, type: "access" },
    process.env.JWT_SECRET || "test-secret-key",
    { expiresIn: "-1h" }
  );
};

/**
 * Generate an invalid JWT token for testing
 */
const generateInvalidToken = () => {
  return "invalid.jwt.token";
};

/**
 * Wait for a specified amount of time (for testing rate limits)
 */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generate test transaction data
 */
const generateTransactionData = (overrides = {}) => ({
  txHash: "0x" + faker.string.alphanumeric(64),
  type: faker.helpers.arrayElement([
    "transfer",
    "mint",
    "burn",
    "swap",
    "stake",
    "unstake"
  ]),
  amount: faker.number
    .float({ min: 0.1, max: 1000, precision: 0.01 })
    .toString(),
  status: faker.helpers.arrayElement(["pending", "confirmed", "failed"]),
  blockNumber: faker.number.int({ min: 1000, max: 999999 }),
  gasUsed: faker.number.int({ min: 21000, max: 1000000 }),
  gasPrice: faker.number.int({ min: 1000000000, max: 100000000000 }).toString(),
  ...overrides
});

/**
 * Generate test NFT data
 */
const generateNFTData = (overrides = {}) => ({
  tokenId: faker.number.int({ min: 1, max: 999999 }).toString(),
  contractAddress: "0x" + faker.string.alphanumeric(40),
  name: faker.commerce.productName(),
  description: faker.lorem.sentence(),
  image: faker.image.url(),
  externalUrl: faker.internet.url(),
  attributes: [
    {
      trait_type: "Rarity",
      value: faker.helpers.arrayElement(["Common", "Rare", "Epic", "Legendary"])
    },
    { trait_type: "Level", value: faker.number.int({ min: 1, max: 100 }) }
  ],
  owner: faker.number.int({ min: 1, max: 1000 }),
  metadata: { additional: "test data" },
  network: "ethereum",
  tokenStandard: faker.helpers.arrayElement(["ERC-721", "ERC-1155"]),
  isListed: faker.datatype.boolean(),
  listingPrice: faker.number
    .float({ min: 0.01, max: 100, precision: 0.01 })
    .toString(),
  ...overrides
});

/**
 * Generate test file data
 */
const generateFileData = (overrides = {}) => ({
  originalName: faker.system.fileName(),
  mimetype: faker.helpers.arrayElement([
    "image/jpeg",
    "image/png",
    "application/pdf",
    "text/plain"
  ]),
  size: faker.number.int({ min: 1024, max: 10485760 }), // 1KB to 10MB
  description: faker.lorem.sentence(),
  ...overrides
});

/**
 * Create a test file buffer
 */
const createTestFileBuffer = (size = 1024, mimetype = "image/jpeg") => {
  const buffer = Buffer.alloc(size);
  // Fill with some test data
  for (let i = 0; i < size; i++) {
    buffer[i] = i % 256;
  }
  return buffer;
};

/**
 * Assert common error response structure
 */
const assertErrorResponse = (response, expectedStatus, expectedError) => {
  expect(response.status).toBe(expectedStatus);
  expect(response.body).toHaveProperty("error");
  if (expectedError) {
    expect(response.body.error).toBe(expectedError);
  }
};

/**
 * Assert common success response structure
 */
const assertSuccessResponse = (response, expectedStatus = 200) => {
  expect(response.status).toBe(expectedStatus);
  expect(response.body).toBeDefined();
};

/**
 * Assert JWT token structure
 */
const assertJWTToken = (token) => {
  expect(token).toBeDefined();
  expect(typeof token).toBe("string");
  expect(token.split(".")).toHaveLength(3); // header.payload.signature
};

/**
 * Assert user object structure
 */
const assertUserObject = (user, includePassword = false) => {
  expect(user).toHaveProperty("id");
  expect(user).toHaveProperty("email");
  expect(user).toHaveProperty("name");
  expect(user).toHaveProperty("walletAddress");
  expect(user).toHaveProperty("isVerified");

  if (!includePassword) {
    expect(user).not.toHaveProperty("password");
    expect(user).not.toHaveProperty("password_hash");
  }
};

/**
 * Assert transaction object structure
 */
const assertTransactionObject = (transaction) => {
  expect(transaction).toHaveProperty("id");
  expect(transaction).toHaveProperty("txHash");
  expect(transaction).toHaveProperty("type");
  expect(transaction).toHaveProperty("amount");
  expect(transaction).toHaveProperty("status");
  expect(transaction).toHaveProperty("createdAt");
};

/**
 * Assert NFT object structure
 */
const assertNFTObject = (nft) => {
  expect(nft).toHaveProperty("id");
  expect(nft).toHaveProperty("tokenId");
  expect(nft).toHaveProperty("contractAddress");
  expect(nft).toHaveProperty("name");
  expect(nft).toHaveProperty("owner");
  expect(nft).toHaveProperty("isListed");
};

/**
 * Assert file object structure
 */
const assertFileObject = (file) => {
  expect(file).toHaveProperty("id");
  expect(file).toHaveProperty("originalName");
  expect(file).toHaveProperty("mimetype");
  expect(file).toHaveProperty("size");
  expect(file).toHaveProperty("url");
  expect(file).toHaveProperty("createdAt");
};

/**
 * Test rate limiting by making multiple requests
 */
const testRateLimiting = async (
  app,
  endpoint,
  method = "post",
  data = null,
  expectedLimit = 5
) => {
  const requests = Array(expectedLimit + 1)
    .fill()
    .map(() => {
      const req = request(app)[method](endpoint);
      if (data) {
        return req.send(data);
      }
      return req;
    });

  const responses = await Promise.all(requests);

  // First requests should succeed
  responses.slice(0, expectedLimit).forEach((response, index) => {
    expect(response.status).not.toBe(429);
  });

  // Last request should be rate limited
  expect(responses[expectedLimit].status).toBe(429);
  expect(responses[expectedLimit].body).toHaveProperty("error");
};

module.exports = {
  // Data generators
  generateUserData,
  generateInvalidUserData,
  generateTransactionData,
  generateNFTData,
  generateFileData,
  createTestFileBuffer,

  // User helpers
  createTestUser,
  loginTestUser,
  authenticatedRequest,

  // Token helpers
  generateTestToken,
  generateExpiredToken,
  generateInvalidToken,

  // Utility functions
  wait,
  testRateLimiting,

  // Assertion helpers
  assertErrorResponse,
  assertSuccessResponse,
  assertJWTToken,
  assertUserObject,
  assertTransactionObject,
  assertNFTObject,
  assertFileObject
};
