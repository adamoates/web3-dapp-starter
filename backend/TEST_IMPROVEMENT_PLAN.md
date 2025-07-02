# Test Improvement Plan - 80% Coverage Target

## Current Status Analysis

### Critical Issues Blocking Tests
1. **Mongoose Schema Types Mock** - `mongoose.Schema.Types.Mixed` undefined
2. **MinIO Client Mock** - Missing methods: `bucketExists`, `presignedGetObject`, `removeObject`, `listObjects`, `statObject`, `listBuckets`
3. **Bull Queue Mock** - Missing methods: `on`, `add`, `process`, `close`
4. **Crypto Module Mock** - `crypto.randomBytes` undefined
5. **Path Module Mock** - `path.extname` undefined
6. **App Initialization** - Async setup not properly awaited in tests

### Missing Coverage Areas

#### 1. Routes (Priority: HIGH)
- **Auth Routes**: Registration, login, password reset, email verification
- **Web3 Routes**: Contract interactions, transaction handling
- **File Routes**: Upload, download, management
- **Email Routes**: Template rendering, sending
- **Tenant Routes**: CRUD operations, configuration
- **Queue Routes**: Job management, monitoring

#### 2. Services (Priority: HIGH)
- **UserService**: User CRUD, authentication, profile management
- **EmailService**: Template rendering, SMTP configuration
- **Web3Service**: Contract interactions, transaction signing
- **TenantService**: Multi-tenant operations
- **LoggingService**: Audit trails, activity logging
- **MinIOService**: File operations (after mock fixes)
- **QueueService**: Job management (after mock fixes)

#### 3. Middleware (Priority: MEDIUM)
- **Auth Middleware**: Token validation, role checking
- **Tenant Middleware**: Tenant resolution, access control
- **Logging Middleware**: Request/response logging
- **Upload Middleware**: File validation, processing
- **Rate Limiting**: Request throttling

#### 4. Models (Priority: MEDIUM)
- **User Model**: Database operations, validation
- **Transaction Model**: Blockchain transaction tracking
- **UserActivity Model**: Activity logging (after mongoose fix)
- **Tenant Model**: Multi-tenant data management

#### 5. Workers (Priority: LOW)
- **EmailWorker**: Background email processing
- **BlockchainWorker**: Transaction monitoring
- **MaintenanceWorker**: System cleanup tasks

## Implementation Plan

### Phase 1: Fix Critical Mock Issues (Week 1)

#### 1.1 Fix Mongoose Schema Types Mock
```javascript
// test/setup/mock.js
jest.mock('mongoose', () => ({
  Schema: {
    Types: {
      Mixed: 'Mixed',
      String: 'String',
      Number: 'Number',
      Date: 'Date',
      Boolean: 'Boolean',
      ObjectId: 'ObjectId'
    }
  },
  model: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn()
}));
```

#### 1.2 Fix MinIO Client Mock
```javascript
// test/setup/mock.js
jest.mock('minio', () => ({
  Client: jest.fn().mockImplementation(() => ({
    bucketExists: jest.fn().mockResolvedValue(true),
    makeBucket: jest.fn().mockResolvedValue(true),
    presignedGetObject: jest.fn().mockResolvedValue('https://example.com/file'),
    removeObject: jest.fn().mockResolvedValue(true),
    listObjects: jest.fn().mockReturnValue([{ name: 'test.jpg', size: 1024 }]),
    statObject: jest.fn().mockResolvedValue({ size: 1024, lastModified: new Date() }),
    listBuckets: jest.fn().mockResolvedValue([{ name: 'test-bucket' }]),
    putObject: jest.fn().mockResolvedValue(true)
  }))
}));
```

#### 1.3 Fix Bull Queue Mock
```javascript
// test/setup/mock.js
jest.mock('bull', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    process: jest.fn(),
    close: jest.fn().mockResolvedValue(true),
    getJob: jest.fn().mockResolvedValue({ id: 'job-123', data: {} }),
    getJobs: jest.fn().mockResolvedValue([]),
    clean: jest.fn().mockResolvedValue([]),
    getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0 })
  }));
});
```

#### 1.4 Fix Node.js Built-in Modules
```javascript
// test/setup/mock.js
jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('random-hex-string')
  })
}));

jest.mock('path', () => ({
  extname: jest.fn().mockReturnValue('.jpg'),
  join: jest.fn().mockReturnValue('path/to/file'),
  basename: jest.fn().mockReturnValue('file.jpg')
}));
```

### Phase 2: Route Testing (Week 2)

#### 2.1 Auth Routes Integration Tests
```javascript
// test/integration/auth-routes.test.js
describe('Auth Routes', () => {
  test('POST /api/auth/register - should register new user', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('user');
    expect(response.body.user.email).toBe('test@example.com');
  });

  test('POST /api/auth/login - should login user', async () => {
    // First register user
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });

    // Then login
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
  });
});
```

#### 2.2 Web3 Routes Integration Tests
```javascript
// test/integration/web3-routes.test.js
describe('Web3 Routes', () => {
  test('GET /api/web3/stats/:contractAddress - should get contract stats', async () => {
    const response = await request(app)
      .get('/api/web3/stats/0x1234567890123456789012345678901234567890')
      .set('Authorization', `Bearer ${validToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('stats');
  });
});
```

### Phase 3: Service Testing (Week 3)

#### 3.1 UserService Unit Tests
```javascript
// test/unit/services/UserService.test.js
describe('UserService', () => {
  test('createUser - should create new user', async () => {
    const userData = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User'
    };

    const user = await userService.createUser(userData);
    
    expect(user).toHaveProperty('id');
    expect(user.email).toBe(userData.email);
    expect(user.name).toBe(userData.name);
  });

  test('authenticateUser - should authenticate valid credentials', async () => {
    const userData = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User'
    };

    await userService.createUser(userData);
    const authResult = await userService.authenticateUser(
      userData.email,
      userData.password
    );

    expect(authResult).toHaveProperty('user');
    expect(authResult).toHaveProperty('token');
  });
});
```

#### 3.2 EmailService Unit Tests
```javascript
// test/unit/services/EmailService.test.js
describe('EmailService', () => {
  test('sendVerificationEmail - should send verification email', async () => {
    const emailData = {
      to: 'test@example.com',
      token: 'verification-token',
      name: 'Test User'
    };

    const result = await emailService.sendVerificationEmail(emailData);
    
    expect(result).toBe(true);
    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: emailData.to,
        subject: expect.stringContaining('Verify')
      })
    );
  });
});
```

### Phase 4: Middleware Testing (Week 4)

#### 4.1 Auth Middleware Tests
```javascript
// test/unit/middleware/auth.test.js
describe('Auth Middleware', () => {
  test('authenticateToken - should authenticate valid token', async () => {
    const token = jwt.sign({ userId: 1 }, process.env.JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = {};
    const next = jest.fn();

    await authenticateToken(req, res, next);

    expect(req.user).toBeDefined();
    expect(req.user.userId).toBe(1);
    expect(next).toHaveBeenCalled();
  });

  test('authenticateToken - should reject invalid token', async () => {
    const req = { headers: { authorization: 'Bearer invalid-token' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
```

### Phase 5: Model Testing (Week 5)

#### 5.1 User Model Tests
```javascript
// test/unit/models/User.test.js
describe('User Model', () => {
  test('should create user with required fields', async () => {
    const userData = {
      email: 'test@example.com',
      password_hash: 'hashed-password',
      name: 'Test User',
      tenant_id: 1
    };

    const user = await User.create(userData);
    
    expect(user.email).toBe(userData.email);
    expect(user.name).toBe(userData.name);
    expect(user.tenant_id).toBe(userData.tenant_id);
  });

  test('should enforce unique email constraint', async () => {
    const userData = {
      email: 'test@example.com',
      password_hash: 'hashed-password',
      name: 'Test User',
      tenant_id: 1
    };

    await User.create(userData);
    
    await expect(User.create(userData)).rejects.toThrow();
  });
});
```

## Coverage Targets by Category

| Category   | Current | Target | Priority |
| ---------- | ------- | ------ | -------- |
| Routes     | 15%     | 85%    | HIGH     |
| Services   | 25%     | 90%    | HIGH     |
| Middleware | 40%     | 85%    | MEDIUM   |
| Models     | 30%     | 80%    | MEDIUM   |
| Workers    | 5%      | 60%    | LOW      |
| Utils      | 50%     | 75%    | MEDIUM   |

## Success Metrics

1. **Overall Coverage**: 80%+
2. **Critical Path Coverage**: 90%+ (auth, user management, file operations)
3. **Error Handling Coverage**: 85%+ (all error scenarios tested)
4. **Integration Test Coverage**: 70%+ (end-to-end workflows)

## Implementation Checklist

### Week 1: Foundation
- [ ] Fix all critical mock issues
- [ ] Update test setup files
- [ ] Ensure all tests run without errors
- [ ] Create comprehensive mock utilities

### Week 2: Routes
- [ ] Auth routes integration tests
- [ ] Web3 routes integration tests
- [ ] File routes integration tests
- [ ] Email routes integration tests
- [ ] Tenant routes integration tests

### Week 3: Services
- [ ] UserService unit tests
- [ ] EmailService unit tests
- [ ] Web3Service unit tests
- [ ] TenantService unit tests
- [ ] LoggingService unit tests

### Week 4: Middleware
- [ ] Auth middleware tests
- [ ] Tenant middleware tests
- [ ] Logging middleware tests
- [ ] Upload middleware tests
- [ ] Rate limiting tests

### Week 5: Models & Workers
- [ ] User model tests
- [ ] Transaction model tests
- [ ] UserActivity model tests
- [ ] EmailWorker tests
- [ ] BlockchainWorker tests

### Week 6: Finalization
- [ ] Coverage report analysis
- [ ] Missing edge case tests
- [ ] Performance test optimization
- [ ] Documentation updates

## Risk Mitigation

1. **Mock Complexity**: Start with simple mocks, gradually add complexity
2. **Test Data Management**: Use factories and fixtures for consistent test data
3. **Async Testing**: Ensure proper async/await patterns in all tests
4. **Database State**: Use transactions or cleanup strategies for test isolation

## Tools & Utilities

1. **Test Factories**: Create user, tenant, and transaction factories
2. **Mock Utilities**: Centralized mock creation and management
3. **Test Helpers**: Common test utilities and assertions
4. **Coverage Reports**: Regular coverage analysis and reporting

This plan provides a structured approach to achieving 80% test coverage while maintaining code quality and test reliability. 