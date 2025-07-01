const { faker } = require("@faker-js/faker");
const request = require("supertest");

/**
 * Generate valid user data for testing
 */
const generateUserData = () => ({
  email: faker.internet.email(),
  password: "TestPass123!",
  name: faker.person.fullName()
});

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
const authenticatedRequest = (app, method, url, token) => {
  return request(app)[method](url).set("Authorization", `Bearer ${token}`);
};

/**
 * Wait for a specified amount of time (for testing rate limits)
 */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
  generateUserData,
  createTestUser,
  loginTestUser,
  authenticatedRequest,
  wait
};
