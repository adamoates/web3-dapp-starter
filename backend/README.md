# Multi-Database Web3 Backend

A comprehensive backend system built with a multi-database architecture optimized for Web3 applications, featuring PostgreSQL, MongoDB, and Redis.

## 🏗️ Architecture Overview

### Database Strategy

```
📊 POSTGRESQL - Structured/Critical Data
✅ User accounts & authentication
✅ User profiles & settings
✅ Financial transactions
✅ Audit logs
✅ System settings
✅ Relational data with ACID compliance

📄 MONGODB - Flexible/Application Data
✅ Blockchain event logs
✅ NFT metadata
✅ Smart contract interactions
✅ User activity feeds
✅ Analytics data
✅ JSON-heavy documents

⚡ REDIS - Session/Cache Data
✅ JWT sessions
✅ Rate limiting
✅ API response caching
✅ Real-time data
✅ Temporary data
✅ Pub/Sub for WebSocket
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 14+
- MongoDB 6+
- Redis 7+

### Environment Variables

Create a `.env` file in the backend directory:

```env
# Database Connections
POSTGRES_URI=postgresql://username:password@localhost:5432/dapp
MONGO_URI=mongodb://localhost:27017/dapp
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key

# Email Configuration
MAIL_HOST=mailpit
MAIL_PORT=1025
MAIL_FROM=noreply@dapp.com
TEST_EMAIL_TO=test@example.com

# MinIO Configuration
MINIO_BUCKET=dapp

# Server Configuration
PORT=5000
NODE_ENV=development
```

### Installation

```bash
# Install dependencies
npm install

# Run database migrations
npm run migrate

# Start development server
npm run dev

# Run tests
npm test
```

## 📊 Database Models

### PostgreSQL Models (Structured Data)

#### User Model
```javascript
// models/sql/User.js
class User {
  async create({ email, password, name, walletAddress })
  async findByEmail(email)
  async findById(id)
  async findByWallet(walletAddress)
  async linkWallet(userId, walletAddress)
  async updateProfile(userId, updates)
  async validatePassword(plainPassword, hashedPassword)
  generateToken(userId)
  async verifyToken(token)
}
```

#### Transaction Model
```javascript
// models/sql/Transaction.js
class Transaction {
  async create({ userId, txHash, type, amount, status })
  async findByHash(txHash)
  async findByUser(userId, limit, offset)
  async updateStatus(txHash, status, blockNumber)
  async getPendingTransactions()
  async getTransactionStats(userId)
}
```

### MongoDB Schemas (Flexible Data)

#### BlockchainEvent Schema
```javascript
// models/nosql/BlockchainEvent.js
{
  contractAddress: String,
  eventName: String,
  blockNumber: Number,
  transactionHash: String,
  eventData: Mixed,
  userId: Number,
  processed: Boolean,
  network: String,
  gasUsed: Number,
  gasPrice: String,
  createdAt: Date
}
```

#### NFTMetadata Schema
```javascript
// models/nosql/NFTMetadata.js
{
  tokenId: String,
  contractAddress: String,
  name: String,
  description: String,
  image: String,
  attributes: Array,
  owner: Number,
  metadata: Mixed,
  network: String,
  tokenStandard: String,
  isListed: Boolean,
  listingPrice: String,
  lastUpdated: Date
}
```

#### UserActivity Schema
```javascript
// models/nosql/UserActivity.js
{
  userId: Number,
  action: String,
  details: Mixed,
  ipAddress: String,
  userAgent: String,
  sessionId: String,
  metadata: Mixed,
  timestamp: Date
}
```

## 🔧 Services

### UserService
Orchestrates user operations across all databases:

```javascript
// services/UserService.js
class UserService {
  async registerUser(userData, ipAddress, userAgent)
  async loginUser(email, password, ipAddress, userAgent)
  async linkWalletToUser(userId, walletAddress, signature, ipAddress)
  async getUserProfile(userId)
  async getUserActivity(userId, limit, offset)
  async getUserStats(userId)
  async logoutUser(userId, token)
  async verifyToken(token)
  async updateUserProfile(userId, updates, ipAddress)
}
```

### Web3Service
Handles blockchain interactions and data management:

```javascript
// services/Web3Service.js
class Web3Service {
  async recordTransaction(txData)
  async updateTransactionStatus(txHash, status, blockNumber)
  async recordBlockchainEvent(eventData)
  async storeNFTMetadata(nftData)
  async getTransactionStatus(txHash)
  async getUserTransactions(userId, limit, offset)
  async getContractEvents(contractAddress, eventName, limit)
  async getNFTsByOwner(ownerId, limit, offset)
  async getListedNFTs(limit, offset)
  async updateNFTOwner(contractAddress, tokenId, newOwner)
  async getContractStats(contractAddress)
  async processPendingTransactions()
}
```

## 📁 File Management with MinIO

The backend includes a comprehensive file management system using MinIO for object storage, supporting:

### Features
- **Avatar Upload**: User profile picture management with automatic replacement
- **Document Storage**: Secure document upload with metadata tracking
- **NFT Asset Management**: Specialized storage for NFT images and metadata
- **File Sharing**: Share files between users with permissions
- **Search & Filtering**: Advanced file search with pagination
- **Activity Logging**: Track all file operations in MongoDB
- **Security**: File type validation, size limits, and access control

### MinIO Configuration
```bash
# Environment variables for MinIO
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ROOT_USER=minio
MINIO_ROOT_PASSWORD=minio123
MINIO_AVATARS_BUCKET=user-avatars
MINIO_DOCUMENTS_BUCKET=user-documents
MINIO_NFT_BUCKET=nft-assets
MINIO_TEMP_BUCKET=temp-uploads
```

### Bucket Structure
- `user-avatars`: Public access for profile pictures
- `user-documents`: Private documents with presigned URLs
- `nft-assets`: Public access for NFT images
- `temp-uploads`: Temporary files with automatic cleanup

### File Upload Endpoints

#### Upload Avatar
```bash
POST /api/files/avatar
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <image file>
```

#### Upload Document
```bash
POST /api/files/document
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <document file>
description: "Optional file description"
```

#### Upload NFT Asset
```bash
POST /api/files/nft-asset
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <nft image/video>
tokenId: "123"
contractAddress: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"
```

### File Management Endpoints

#### List User Files
```bash
GET /api/files/my-files?limit=50&offset=0
Authorization: Bearer <token>
```

#### Get File Details
```bash
GET /api/files/file/:fileId
Authorization: Bearer <token>
```

#### Download File
```bash
GET /api/files/download/:fileId
Authorization: Bearer <token>
```

#### Update File Description
```bash
PUT /api/files/file/:fileId/description
Authorization: Bearer <token>
Content-Type: application/json

{
  "description": "Updated file description"
}
```

#### Delete File
```bash
DELETE /api/files/file/:fileId
Authorization: Bearer <token>
```

#### File Statistics
```bash
GET /api/files/stats
Authorization: Bearer <token>
```

#### Search Files
```bash
GET /api/files/search?q=search_term&type=image&limit=20&offset=0
Authorization: Bearer <token>
```

### Database Schema

#### user_files Table (PostgreSQL)
```sql
CREATE TABLE user_files (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    description TEXT,
    checksum VARCHAR(64),
    is_public BOOLEAN DEFAULT false,
    tags TEXT[],
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### file_analytics Table (PostgreSQL)
```sql
CREATE TABLE file_analytics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_id INTEGER REFERENCES user_files(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### file_shares Table (PostgreSQL)
```sql
CREATE TABLE file_shares (
    id SERIAL PRIMARY KEY,
    file_id INTEGER NOT NULL REFERENCES user_files(id) ON DELETE CASCADE,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shared_with_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission VARCHAR(20) DEFAULT 'read',
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(file_id, shared_with_id)
);
```

### Security Features
- **File Type Validation**: Whitelist of allowed MIME types per endpoint
- **Size Limits**: Configurable maximum file size (default: 10MB)
- **Access Control**: Users can only access their own files
- **Presigned URLs**: Secure temporary access to private files
- **Activity Logging**: All file operations logged with IP and user agent
- **Virus Scanning**: Integration ready for file scanning services

### Performance Optimizations
- **CDN Integration**: Direct URLs for public assets
- **Caching**: Redis caching for file metadata
- **Compression**: Automatic file compression for storage efficiency
- **Cleanup Jobs**: Automatic cleanup of temporary files
- **Indexing**: Database indexes for fast file queries

### Monitoring & Analytics
- **Storage Usage**: Track user storage consumption
- **File Analytics**: Monitor file access patterns
- **Health Checks**: MinIO service health monitoring
- **Error Tracking**: Comprehensive error logging

## 🌐 API Endpoints

### Authentication Routes (`/api/auth`)

| Method | Endpoint       | Description         |
| ------ | -------------- | ------------------- |
| POST   | `/register`    | Register new user   |
| POST   | `/login`       | User login          |
| POST   | `/link-wallet` | Link wallet to user |
| GET    | `/profile`     | Get user profile    |
| PUT    | `/profile`     | Update user profile |
| GET    | `/activity`    | Get user activity   |
| GET    | `/stats`       | Get user statistics |
| POST   | `/logout`      | User logout         |
| GET    | `/verify`      | Verify JWT token    |

### Web3 Routes (`/api/web3`)

| Method | Endpoint                       | Description                  |
| ------ | ------------------------------ | ---------------------------- |
| POST   | `/transactions`                | Record new transaction       |
| PUT    | `/transactions/:txHash/status` | Update transaction status    |
| GET    | `/transactions/:txHash/status` | Get transaction status       |
| GET    | `/transactions`                | Get user transactions        |
| POST   | `/events`                      | Record blockchain event      |
| GET    | `/events/:contractAddress`     | Get contract events          |
| POST   | `/nfts`                        | Store NFT metadata           |
| GET    | `/nfts/owner/:ownerId`         | Get NFTs by owner            |
| GET    | `/nfts/listed`                 | Get listed NFTs              |
| GET    | `/stats/:contractAddress`      | Get contract statistics      |
| POST   | `/process-pending`             | Process pending transactions |

### System Endpoints

| Method | Endpoint           | Description                |
| ------ | ------------------ | -------------------------- |
| GET    | `/health`          | System health check        |
| GET    | `/db-info`         | Database architecture info |
| GET    | `/ping`            | Simple ping test           |
| GET    | `/mongo-status`    | MongoDB status             |
| GET    | `/postgres-status` | PostgreSQL status          |
| GET    | `/cache-test`      | Redis cache test           |
| GET    | `/test-email`      | Email test                 |
| GET    | `/minio-status`    | MinIO status               |

## 🔐 Authentication

The system uses JWT tokens for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Token Structure
```javascript
{
  userId: number,
  type: "access",
  iat: number,
  exp: number
}
```

## 📈 Caching Strategy

### Redis Cache Keys

```javascript
// User sessions
`user_session:${userId}` // TTL: 1 hour

// User profiles
`user_profile:${userId}` // TTL: 30 minutes

// JWT tokens
`jwt:${userId}:${tokenSignature}` // TTL: 24 hours

// Transaction status
`tx_status:${txHash}` // TTL: 1 hour

// NFT data
`nft:${contractAddress}:${tokenId}` // TTL: 30 minutes

// Recent events
`recent_events:${contractAddress}` // TTL: 1 hour
```

## 🗄️ Database Migrations

Run the migration to set up the database schema:

```bash
# Apply migration
psql -d your_database -f migrations/1703003000000_add-wallet-support.sql
```

The migration creates:
- `users` table with wallet support
- `transactions` table for blockchain transactions
- `audit_logs` table for system events
- `system_settings` table for configuration
- Proper indexes and triggers

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:security
npm run test:performance

# Run with coverage
npm run test:coverage

# Full test suite with Docker
npm run test:full
```

## 📊 Monitoring & Health Checks

### Health Check Response
```json
{
  "status": "healthy",
  "databases": {
    "postgres": true,
    "mongodb": true,
    "redis": true
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Database Info Response
```json
{
  "databases": {
    "postgres": {
      "status": "connected",
      "type": "PostgreSQL",
      "purpose": "Structured data, user accounts, transactions"
    },
    "mongodb": {
      "status": "connected",
      "type": "MongoDB",
      "purpose": "Blockchain events, NFT metadata, user activity"
    },
    "redis": {
      "status": "connected",
      "type": "Redis",
      "purpose": "Caching, sessions, real-time data"
    }
  },
  "architecture": {
    "description": "Multi-database architecture for optimal performance"
  }
}
```

## 🔄 Cross-Database Patterns

### User Registration Flow
1. **PostgreSQL**: Create user record
2. **MongoDB**: Log registration activity
3. **Redis**: Cache user session and profile

### Transaction Recording Flow
1. **PostgreSQL**: Store transaction record
2. **MongoDB**: Log transaction activity
3. **Redis**: Cache transaction status

### NFT Metadata Flow
1. **MongoDB**: Store NFT metadata
2. **Redis**: Cache NFT data
3. **MongoDB**: Log NFT activity (if owner exists)

## 🚨 Error Handling

The system includes comprehensive error handling:

- **Validation errors**: 400 Bad Request
- **Authentication errors**: 401 Unauthorized
- **Authorization errors**: 403 Forbidden
- **Not found errors**: 404 Not Found
- **Conflict errors**: 409 Conflict
- **Server errors**: 500 Internal Server Error

## 🔒 Security Features

- **Helmet.js**: Security headers
- **CORS**: Cross-origin resource sharing
- **Input validation**: Express-validator
- **JWT token blacklisting**: Redis-based
- **Rate limiting**: Express-rate-limit
- **SQL injection protection**: Parameterized queries
- **XSS protection**: Input sanitization

## 📝 Best Practices

### When to Use Each Database

**PostgreSQL (Structured, ACID-compliant):**
- User accounts and authentication
- Financial data and transactions
- System configuration
- Data requiring referential integrity
- Complex queries with JOINs
- Audit trails

**MongoDB (Flexible documents):**
- Blockchain events and logs
- NFT metadata and attributes
- User activity feeds
- Analytics and metrics
- Variable schema data
- Event sourcing

**Redis (Fast, temporary):**
- User sessions and JWT tokens
- API response caching
- Rate limiting counters
- Real-time data
- Pub/Sub for WebSocket
- Temporary calculations

### Cross-Database Consistency
- Use PostgreSQL user.id as foreign key in MongoDB
- Cache PostgreSQL data in Redis for fast access
- Store blockchain events in MongoDB, reference users in PostgreSQL
- Use transactions across databases when needed (2PC pattern)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run the test suite
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License. 

## Test Organization

```
backend/test/
├── unit/                    # 55 tests - Component isolation
│   ├── models/User.test.js
│   ├── services/UserService.test.js
│   └── middleware/auth.test.js
├── mock-integration/        # 28 tests - API contract testing
│   ├── auth-routes.test.js
│   └── web3-routes.test.js
└── integration/            # Real database tests (available) 