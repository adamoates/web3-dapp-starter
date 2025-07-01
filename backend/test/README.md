# 🧪 Test Architecture & Strategy

This document outlines the comprehensive test architecture for the Web3 dapp backend, designed to provide complete coverage with isolated test environments.

## 📁 Directory Structure

```plaintext
test/
├── unit/                     # Pure unit tests (no DB, no services)
│   ├── models/
│   │   └── User.test.js
│   ├── services/
│   │   └── UserService.test.js
│   └── middleware/
│       └── auth.test.js
├── integration/              # Real DB/service integration tests
│   ├── auth-real.test.js
│   ├── files-real.test.js
│   └── web3-real.test.js
├── mock-integration/         # Full route tests with mocked dependencies
│   ├── auth-mocked.test.js
│   ├── files-mocked.test.js
│   └── web3-mocked.test.js
├── security/                 # Security-focused tests
│   └── auth-security.test.js
├── performance/              # Performance and load tests
│   └── auth-performance.test.js
└── setup/
    ├── mock.js              # Mock all services, DB, MinIO
    ├── real.js              # Real DB connections, cleanup helpers
    └── helpers.js           # Shared test utilities
```

## 🎯 Test Types & Purposes

### 1. Unit Tests (`test/unit/`)
**Purpose**: Test individual functions/methods in isolation
- **No external dependencies** (databases, services, APIs)
- **Fast execution** (< 100ms per test)
- **High reliability** (no flaky tests)
- **Perfect for**: Business logic, validation, utility functions

**Example**: Testing User model methods with mocked database pool

### 2. Mock Integration Tests (`test/mock-integration/`)
**Purpose**: Test complete request/response cycles with mocked dependencies
- **Full Express app** with real middleware
- **Mocked services** and databases
- **Fast execution** (no real DB connections)
- **Perfect for**: Route logic, middleware integration, error handling

**Example**: Testing auth routes with mocked UserService

### 3. Real Integration Tests (`test/integration/`)
**Purpose**: Test complete flows with real database connections
- **Real databases** (PostgreSQL, MongoDB, Redis)
- **Real MinIO** file storage
- **Slow execution** (requires DB setup/teardown)
- **Perfect for**: Database operations, data persistence, complex workflows

**Example**: Testing user registration → login → profile access flow

### 4. Security Tests (`test/security/`)
**Purpose**: Test security vulnerabilities and edge cases
- **Authentication bypass** attempts
- **Authorization** testing
- **Input validation** and sanitization
- **Rate limiting** and brute force protection

### 5. Performance Tests (`test/performance/`)
**Purpose**: Test system performance under load
- **Concurrent requests** testing
- **Database query** optimization
- **Memory usage** monitoring
- **Response time** benchmarking

## 🚀 Running Tests

### Jest Projects Configuration
The test suite uses Jest projects to run different test types in isolation:

```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit              # Unit tests only
npm run test:mock-integration  # Mock integration tests only
npm run test:integration       # Real integration tests only
npm run test:security          # Security tests only
npm run test:performance       # Performance tests only

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Environment Setup

#### For Unit & Mock Integration Tests
No setup required - everything is mocked:
```bash
npm run test:unit
npm run test:mock-integration
```

#### For Real Integration Tests
Requires running databases via Docker:
```bash
# Start test databases
docker-compose -f docker-compose.test.yml up -d

# Run migrations for test database
node scripts/migrate.js up test

# Run integration tests
npm run test:integration

# Clean up
docker-compose -f docker-compose.test.yml down
```

## 🛠️ Test Setup Files

### `test/setup/mock.js`
Comprehensive mocking setup for isolated testing:
- **Database connections** (PostgreSQL, MongoDB, Redis)
- **External services** (MinIO, email, Web3)
- **Models and services** (User, UserService, etc.)
- **Environment variables** for testing

### `test/setup/real.js`
Real database setup for integration testing:
- **Database connections** with test credentials
- **Cleanup functions** for test isolation
- **Health checks** for database connectivity
- **Migration helpers** for schema setup

### `test/setup/helpers.js`
Shared utilities across all test types:
- **Data generators** (users, transactions, NFTs)
- **Authentication helpers** (tokens, login)
- **Assertion helpers** (response validation)
- **Test utilities** (wait, rate limiting tests)

## 📊 Test Coverage Strategy

### Authentication System Coverage
- ✅ User registration with validation
- ✅ User login with password hashing
- ✅ JWT token generation and verification
- ✅ Token blacklisting on logout
- ✅ Password reset functionality
- ✅ Email verification
- ✅ Rate limiting on auth endpoints
- ✅ Input sanitization and validation
- ✅ SQL injection prevention
- ✅ XSS protection

### Database Operations Coverage
- ✅ CRUD operations on all models
- ✅ Transaction handling
- ✅ Connection pooling
- ✅ Query optimization
- ✅ Data integrity constraints
- ✅ Concurrent access handling

### File Management Coverage
- ✅ File upload with validation
- ✅ File storage in MinIO
- ✅ File metadata management
- ✅ File sharing and permissions
- ✅ File deletion and cleanup

### Web3 Integration Coverage
- ✅ Transaction recording
- ✅ NFT metadata storage
- ✅ Wallet linking and verification
- ✅ Blockchain event processing
- ✅ Smart contract interaction

## 🔧 Test Utilities

### Data Generators
```javascript
const { generateUserData, generateTransactionData } = require('../setup/helpers');

// Generate test data
const userData = generateUserData();
const transactionData = generateTransactionData();
```

### Authentication Helpers
```javascript
const { createTestUser, loginTestUser, generateTestToken } = require('../setup/helpers');

// Create authenticated user
const { user, token } = await createTestUser(app);

// Generate test token
const token = generateTestToken(userId);
```

### Assertion Helpers
```javascript
const { assertUserObject, assertJWTToken, assertErrorResponse } = require('../setup/helpers');

// Validate user object structure
assertUserObject(response.body.user);

// Validate JWT token
assertJWTToken(response.body.token);

// Validate error response
assertErrorResponse(response, 400, 'Invalid email format');
```

## 🐛 Debugging Tests

### Running Individual Tests
```bash
# Run specific test file
npm test -- test/unit/models/User.test.js

# Run specific test case
npm test -- --testNamePattern="should create a new user"

# Run tests with verbose output
npm test -- --verbose
```

### Database Debugging
```bash
# Check database status
node scripts/migrate.js status

# Reset test database
node scripts/migrate.js down test
node scripts/migrate.js up test

# View database logs
docker-compose -f docker-compose.test.yml logs postgres
```

### Test Environment Variables
```bash
# Set test environment
NODE_ENV=test npm test

# Override database URLs
POSTGRES_URL=postgresql://test:test@localhost:5432/test npm run test:integration
```

## 📈 Continuous Integration

### GitHub Actions Workflow
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: password
          POSTGRES_DB: dapp_test
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:mock-integration
      - run: npm run test:integration
      - run: npm run test:security
```

## 🎯 Best Practices

### Writing Unit Tests
1. **Test one thing at a time**
2. **Use descriptive test names**
3. **Arrange-Act-Assert pattern**
4. **Mock external dependencies**
5. **Test edge cases and error conditions**

### Writing Integration Tests
1. **Test complete user workflows**
2. **Clean up after each test**
3. **Use real database connections**
4. **Test data persistence**
5. **Verify side effects**

### Test Data Management
1. **Use factories for test data**
2. **Avoid hardcoded values**
3. **Clean up test data**
4. **Use unique identifiers**
5. **Isolate test data between tests**

## 🔍 Monitoring & Reporting

### Coverage Reports
```bash
# Generate coverage report
npm run test:coverage

# View coverage in browser
open coverage/lcov-report/index.html
```

### Test Performance
```bash
# Run tests with timing
npm test -- --verbose --detectOpenHandles

# Profile slow tests
npm test -- --runInBand --detectOpenHandles
```

### Continuous Monitoring
- **Test execution time** tracking
- **Coverage trends** over time
- **Flaky test** detection
- **Performance regression** alerts

## 🚨 Troubleshooting

### Common Issues

#### Database Connection Errors
```bash
# Check if databases are running
docker-compose -f docker-compose.test.yml ps

# Restart databases
docker-compose -f docker-compose.test.yml restart
```

#### Test Timeout Issues
```bash
# Increase timeout for slow tests
jest --testTimeout=30000

# Run tests sequentially
jest --runInBand
```

#### Memory Issues
```bash
# Increase Node.js memory
node --max-old-space-size=4096 node_modules/.bin/jest

# Clean up after tests
jest --forceExit --detectOpenHandles
```

This test architecture ensures comprehensive coverage while maintaining fast, reliable, and maintainable tests across all aspects of the Web3 dapp backend. 