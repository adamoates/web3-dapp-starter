# 🧪 Testing Guide

This document explains the comprehensive testing strategy for the Node.js/Express Web3 dapp backend.

## 📊 Test Overview

We have **4 layers of testing** to ensure maximum reliability:

| Test Type              | Count    | Speed           | Purpose                 | Database          |
| ---------------------- | -------- | --------------- | ----------------------- | ----------------- |
| **Unit Tests**         | 55       | ⚡ Fast (2-3s)   | Component isolation     | Mocked            |
| **Mock Integration**   | 28       | ⚡ Fast (5-10s)  | API contract validation | Mocked            |
| **Docker Integration** | New      | 🐌 Slow (30-60s) | Real database testing   | Docker containers |
| **Real Integration**   | Existing | 🐌 Slow (30-60s) | Production-like testing | Local databases   |

## 🚀 Quick Start

### Fast Development Testing (Recommended for daily work)
```bash
# Run all fast tests (83 tests in ~10 seconds)
npm run test:all

# Run only unit tests (55 tests in ~3 seconds)
npm run test:unit

# Run only mock integration tests (28 tests in ~5 seconds)
npm run test:mock
```

### Full Testing with Docker (For CI/CD and thorough testing)
```bash
# Run everything including Docker tests
npm run test:all-with-docker

# Run only Docker integration tests
npm run test:docker:full
```

## 🐳 Docker Testing Setup

### Prerequisites
- Docker and Docker Compose installed
- Ports 5433, 27018, 6380, 9002-9003, 1026, 8026 available

### Docker Services
The Docker test environment includes:
- **PostgreSQL** (port 5433) - Optimized for speed with tmpfs
- **MongoDB** (port 27018) - Optimized for speed with tmpfs  
- **Redis** (port 6380) - Optimized for speed with tmpfs
- **MinIO** (ports 9002-9003) - Object storage for file testing
- **Mailpit** (ports 1026, 8026) - Email testing

### Docker Commands
```bash
# Start Docker test environment
npm run test:docker:setup

# Check Docker services status
npm run test:docker:status

# View Docker logs
npm run test:docker:logs

# Stop Docker test environment
npm run test:docker:teardown

# Run full Docker test cycle
npm run test:docker:full
```

## 📁 Test Structure

```
backend/test/
├── unit/                    # 55 tests - Component isolation
│   ├── models/User.test.js
│   ├── services/UserService.test.js
│   └── middleware/auth.test.js
├── mock-integration/        # 28 tests - API contract testing
│   ├── auth-routes.test.js
│   └── web3-routes.test.js
├── integration/            # Real database tests
│   ├── docker-auth.test.js  # NEW: Docker integration tests
│   ├── auth.test.js
│   ├── web3.test.js
│   └── ...
└── setup/
    ├── mock.js             # Unit test setup
    ├── mock-integration.js # Mock integration setup
    ├── docker.js           # NEW: Docker test setup
    └── real.js             # Real integration setup
```

## 🎯 Test Categories

### 1. Unit Tests (`test:unit`)
- **Purpose**: Test individual components in isolation
- **Database**: Fully mocked
- **Speed**: ⚡ Very fast (2-3 seconds)
- **Coverage**: 55 tests covering models, services, middleware
- **Use case**: Development, quick feedback, CI/CD

**Example**:
```javascript
// Tests User model methods with mocked database
describe('User Model', () => {
  it('should create a new user successfully', async () => {
    const user = await User.create(mockUserData);
    expect(user.email).toBe(mockUserData.email);
  });
});
```

### 2. Mock Integration Tests (`test:mock`)
- **Purpose**: Test API contracts and route structure
- **Database**: Mocked services
- **Speed**: ⚡ Fast (5-10 seconds)
- **Coverage**: 28 tests covering API endpoints
- **Use case**: API validation, route testing

**Example**:
```javascript
// Tests API endpoints without real database
describe('Auth Routes', () => {
  it('should validate required fields', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({})
      .expect(400);
  });
});
```

### 3. Docker Integration Tests (`test:docker`) - NEW
- **Purpose**: Test with real database connections in Docker
- **Database**: Real PostgreSQL, MongoDB, Redis, MinIO in containers
- **Speed**: 🐌 Slow (30-60 seconds for setup + tests)
- **Coverage**: Real database persistence and interactions
- **Use case**: Integration testing, CI/CD, production-like testing

**Example**:
```javascript
// Tests with real Docker databases
describe('Docker Integration Tests', () => {
  beforeAll(async () => {
    await waitForDockerServices();
    await initializeDockerConnections();
    await resetTestDatabases();
    await runTestMigrations();
  });

  it('should persist user data across requests', async () => {
    // Real database operations
  });
});
```

### 4. Real Integration Tests (`test:integration`)
- **Purpose**: Test with local databases
- **Database**: Local PostgreSQL, MongoDB, Redis, MinIO
- **Speed**: 🐌 Slow (30-60 seconds)
- **Coverage**: Full integration testing
- **Use case**: Local development, thorough testing

## 🔧 Test Configuration

### Jest Configuration
```javascript
// jest.config.js
projects: [
  {
    displayName: "unit",
    testMatch: ["<rootDir>/test/unit/**/*.test.js"],
    setupFilesAfterEnv: ["<rootDir>/test/setup/mock.js"],
    testTimeout: 10000
  },
  {
    displayName: "mock-integration", 
    testMatch: ["<rootDir>/test/mock-integration/**/*.test.js"],
    setupFilesAfterEnv: ["<rootDir>/test/setup/mock-integration.js"],
    testTimeout: 10000
  },
  {
    displayName: "docker-integration",
    testMatch: ["<rootDir>/test/integration/docker-*.test.js"],
    setupFilesAfterEnv: ["<rootDir>/test/setup/docker.js"],
    testTimeout: 120000 // 2 minutes for Docker setup
  }
]
```

### Environment Configuration
- **Unit/Mock tests**: Use `.env.test` with mocked services
- **Docker tests**: Use `test.env.docker` with Docker service ports
- **Real integration**: Use local database configurations

## 🚀 Available Commands

### Fast Testing (Recommended for development)
```bash
npm run test:unit        # 55 unit tests (2-3s)
npm run test:mock        # 28 mock integration tests (5-10s)
npm run test:all         # 83 fast tests (10s)
npm run test:fast        # Alias for test:all
```

### Docker Testing (For thorough testing)
```bash
npm run test:docker      # Docker integration tests only
npm run test:all-with-docker  # All tests including Docker
npm run test:docker:full # Full Docker test cycle
```

### Docker Management
```bash
npm run test:docker:setup    # Start Docker services
npm run test:docker:teardown # Stop Docker services
npm run test:docker:status   # Check service status
npm run test:docker:logs     # View service logs
```

### Other Testing
```bash
npm run test:integration     # Real integration tests
npm run test:coverage        # Coverage report
npm run test:watch           # Watch mode for unit tests
npm run test:security        # Security tests
npm run test:performance     # Performance tests
```

## 🎯 Best Practices

### For Daily Development
1. **Use fast tests**: `npm run test:all` (83 tests in 10s)
2. **Run unit tests frequently**: `npm run test:unit` (55 tests in 3s)
3. **Use watch mode**: `npm run test:watch` for continuous testing

### For CI/CD
1. **Run all tests**: `npm run test:all-with-docker`
2. **Include Docker tests**: Ensures production-like testing
3. **Use coverage**: `npm run test:coverage`

### For Debugging
1. **Check Docker status**: `npm run test:docker:status`
2. **View Docker logs**: `npm run test:docker:logs`
3. **Reset Docker environment**: `npm run test:docker:teardown && npm run test:docker:setup`

## 🔍 Troubleshooting

### Docker Issues
```bash
# Check if ports are available
lsof -i :5433 -i :27018 -i :6380 -i :9002

# Reset Docker environment
npm run test:docker:teardown
npm run test:docker:setup

# Check Docker logs
npm run test:docker:logs
```

### Test Failures
1. **Unit tests failing**: Check mocks and test data
2. **Mock integration failing**: Check API contract expectations
3. **Docker tests failing**: Check Docker services and connections
4. **Real integration failing**: Check local database setup

### Performance Issues
1. **Docker tests slow**: Ensure tmpfs is working (check Docker logs)
2. **Database connections**: Check connection pooling settings
3. **Memory usage**: Monitor Docker container resource usage

## 📈 Test Metrics

### Current Status
- ✅ **Unit Tests**: 55/55 passing (2-3 seconds)
- ✅ **Mock Integration**: 28/28 passing (5-10 seconds)
- 🆕 **Docker Integration**: New layer (30-60 seconds)
- ✅ **Real Integration**: Existing tests (30-60 seconds)

### Coverage Goals
- **Unit Tests**: >90% code coverage
- **Integration Tests**: >80% API endpoint coverage
- **Docker Tests**: 100% critical path coverage

## 🎉 Benefits

### Development Speed
- **Fast feedback**: 83 tests in 10 seconds
- **Isolated testing**: No database dependencies for unit tests
- **Parallel execution**: Tests can run in parallel

### Reliability
- **Multiple layers**: 4 different testing approaches
- **Real database testing**: Docker containers for integration
- **Production-like**: Docker tests mirror production environment

### Maintainability
- **Clear separation**: Each test type has a specific purpose
- **Easy debugging**: Isolated test environments
- **Comprehensive coverage**: From unit to integration testing 