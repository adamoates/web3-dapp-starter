const request = require("supertest");
const jwt = require("jsonwebtoken");
const { faker } = require("@faker-js/faker");
const bcrypt = require("bcryptjs");

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
const loginAndGetToken = async (app, email, password) => {
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
  expect(response.body).toHaveProperty("timestamp");
};

/**
 * Assert common success response structure
 */
const assertSuccessResponse = (response, expectedStatus = 200) => {
  expect(response.status).toBe(expectedStatus);
  expect(response.body).toHaveProperty("message");
  expect(response.body).toHaveProperty("timestamp");
};

/**
 * Assert JWT token structure
 */
const assertJWTToken = (token) => {
  expect(token).toBeDefined();
  expect(typeof token).toBe("string");
  expect(token.split(".")).toHaveLength(3);
};

/**
 * Assert user object structure
 */
const assertUserObject = (user, includePassword = false) => {
  expect(user).toHaveProperty("id");
  expect(user).toHaveProperty("email");
  expect(user).toHaveProperty("name");
  expect(user).toHaveProperty("created_at");

  if (includePassword) {
    expect(user).toHaveProperty("password_hash");
  } else {
    expect(user).not.toHaveProperty("password_hash");
  }
};

/**
 * Assert transaction object structure
 */
const assertTransactionObject = (transaction) => {
  expect(transaction).toHaveProperty("id");
  expect(transaction).toHaveProperty("tx_hash");
  expect(transaction).toHaveProperty("type");
  expect(transaction).toHaveProperty("status");
  expect(transaction).toHaveProperty("created_at");
};

/**
 * Assert NFT object structure
 */
const assertNFTObject = (nft) => {
  expect(nft).toHaveProperty("tokenId");
  expect(nft).toHaveProperty("contractAddress");
  expect(nft).toHaveProperty("name");
  expect(nft).toHaveProperty("owner");
};

/**
 * Assert file object structure
 */
const assertFileObject = (file) => {
  expect(file).toHaveProperty("id");
  expect(file).toHaveProperty("fileName");
  expect(file).toHaveProperty("url");
  expect(file).toHaveProperty("size");
  expect(file).toHaveProperty("mimetype");
};

/**
 * Test rate limiting on an endpoint
 */
const testRateLimiting = async (
  app,
  endpoint,
  method = "post",
  data = null,
  expectedLimit = 5
) => {
  const requests = [];

  // Send requests up to the limit
  for (let i = 0; i < expectedLimit; i++) {
    const req = request(app)[method](endpoint);
    if (data) {
      req.send(data);
    }
    requests.push(req);
  }

  // Send one more request that should be rate limited
  const rateLimitReq = request(app)[method](endpoint);
  if (data) {
    rateLimitReq.send(data);
  }
  requests.push(rateLimitReq);

  const responses = await Promise.all(requests);

  // All requests up to the limit should succeed
  for (let i = 0; i < expectedLimit; i++) {
    expect(responses[i].status).not.toBe(429);
  }

  // The last request should be rate limited
  expect(responses[expectedLimit].status).toBe(429);
  expect(responses[expectedLimit].body).toHaveProperty("error");
};

/**
 * Clean up test data
 */
const cleanupTestData = async (app, token) => {
  if (token) {
    try {
      await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${token}`);
    } catch (error) {
      // Ignore cleanup errors
    }
  }
};

/**
 * Setup test environment
 */
const setupTestEnvironment = () => {
  // Ensure test environment variables are set
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-key";

  // Set default test database URLs if not provided
  if (!process.env.TEST_POSTGRES_URI) {
    process.env.TEST_POSTGRES_URI =
      "postgresql://testuser:testpass@localhost:5433/test_dapp";
  }
  if (!process.env.TEST_MONGO_URI) {
    process.env.TEST_MONGO_URI = "mongodb://localhost:27018/test_dapp";
  }
  if (!process.env.TEST_REDIS_URI) {
    process.env.TEST_REDIS_URI = "redis://localhost:6380/1";
  }
};

/**
 * Teardown test environment
 */
const teardownTestEnvironment = async () => {
  // Wait for any pending operations to complete
  await new Promise((resolve) => setTimeout(resolve, 100));
};

module.exports = {
  generateUserData,
  generateInvalidUserData,
  createTestUser,
  loginAndGetToken,
  authenticatedRequest,
  generateTestToken,
  generateExpiredToken,
  generateInvalidToken,
  wait,
  generateTransactionData,
  generateNFTData,
  generateFileData,
  createTestFileBuffer,
  assertErrorResponse,
  assertSuccessResponse,
  assertJWTToken,
  assertUserObject,
  assertTransactionObject,
  assertNFTObject,
  assertFileObject,
  testRateLimiting,
  cleanupTestData,
  setupTestEnvironment,
  teardownTestEnvironment
};
