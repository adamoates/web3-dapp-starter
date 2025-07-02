require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const DatabaseManager = require("./db/DatabaseManager");
const createAuthRouter = require("./routes/auth");
const createWeb3Router = require("./routes/web3");
const createFileRouter = require("./routes/files");
const createEmailRouter = require("./routes/email");
const createTenantRouter = require("./routes/tenants");
const createQueueRouter = require("./routes/queues");
const MinIOService = require("./services/MinIOService");
const QueueService = require("./services/QueueService");
const EmailWorker = require("./workers/EmailWorker");
const BlockchainWorker = require("./workers/BlockchainWorker");
const MaintenanceWorker = require("./workers/MaintenanceWorker");
const { getClient, ensureBucket } = require("./utils/minio");
const nodemailer = require("nodemailer");
const {
  initializeAuth,
  authenticateToken,
  createRateLimit
} = require("./middleware/auth");
const {
  initializeTenant,
  resolveTenant,
  extractTenantFromToken,
  optionalTenant
} = require("./middleware/tenant");
const {
  initializeLogging,
  logApiRequests,
  logSecurityEvents,
  performanceMonitor,
  errorLogger
} = require("./middleware/logging");
const LoggingService = require("./services/LoggingService");

async function createApp() {
  const app = express();
  let dbManager = null;
  let loggingService = null;
  let queueService = null;

  // Initialize database connections
  async function initializeDatabases() {
    try {
      dbManager = new DatabaseManager();
      await dbManager.connect();

      // Initialize services that depend on databases
      loggingService = new LoggingService(dbManager.databases);

      // Initialize middleware with database connections
      initializeAuth(dbManager.databases);
      initializeLogging(dbManager.databases);
      initializeTenant(dbManager.databases);

      console.log("✅ Database connections and services initialized");
      return true;
    } catch (error) {
      console.error("❌ Failed to initialize databases:", error);
      return false;
    }
  }

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: [
            "'self'",
            "https://api.coingecko.com",
            "https://mainnet.infura.io"
          ]
        }
      }
    })
  );

  // CORS configuration
  app.use(
    cors({
      origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // Allow specific origins or all in development
        const allowedOrigins = process.env.ALLOWED_ORIGINS
          ? process.env.ALLOWED_ORIGINS.split(",")
          : ["http://localhost:3000", "http://localhost:3001"];

        if (
          allowedOrigins.includes(origin) ||
          process.env.NODE_ENV === "development"
        ) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Tenant-ID"]
    })
  );

  // Body parsing middleware
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Trust proxy for accurate IP addresses
  app.set("trust proxy", 1);

  // Global rate limiting
  app.use(
    createRateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // limit each IP to 1000 requests per windowMs
      message: "Too many requests from this IP, please try again later",
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  // Logging and monitoring middleware
  app.use(performanceMonitor);
  app.use(logApiRequests);
  app.use(logSecurityEvents);

  // Tenant resolution middleware
  if (process.env.NODE_ENV === "test") {
    app.use(optionalTenant);
  } else {
    app.use(resolveTenant);
  }

  // Await all async initialization before registering routes
  await initializeDatabases();

  // Initialize queue service (only in production or when explicitly requested)
  if (process.env.NODE_ENV !== "test") {
    queueService = new QueueService();
  }

  // Initialize MinIO service
  const minioService = new MinIOService();

  // Initialize workers if queue service is available
  let emailWorker, blockchainWorker, maintenanceWorker;
  if (queueService) {
    emailWorker = new EmailWorker(queueService);
    blockchainWorker = new BlockchainWorker(queueService, dbManager.databases);
    maintenanceWorker = new MaintenanceWorker(
      queueService,
      dbManager.databases
    );

    // Make workers available to routes
    app.locals.emailWorker = emailWorker;
    app.locals.blockchainWorker = blockchainWorker;
    app.locals.maintenanceWorker = maintenanceWorker;

    console.log("✅ Queue system initialized with workers");
  }

  // Only initialize MinIO if not in test
  if (process.env.NODE_ENV !== "test") {
    minioService.init().catch(console.error);
  }

  // Routes with database access
  app.use("/api/auth", createAuthRouter(dbManager));
  app.use("/api/web3", createWeb3Router(dbManager));
  app.use("/api/files", createFileRouter(dbManager));
  app.use("/api/email", createEmailRouter());
  app.use("/api/tenants", createTenantRouter(dbManager));

  // Queue management routes (only if queue service is available)
  if (queueService && emailWorker && blockchainWorker && maintenanceWorker) {
    app.use(
      "/api/queues",
      createQueueRouter(
        queueService,
        emailWorker,
        blockchainWorker,
        maintenanceWorker
      )
    );
  }

  console.log("✅ All routes and services initialized");

  // Health check endpoint
  app.get("/health", async (req, res) => {
    try {
      const health = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || "development",
        tenantId: req.tenantId || null
      };

      // Check database connections
      if (dbManager) {
        health.databases = {
          postgres: dbManager.databases.postgres ? "connected" : "disconnected",
          redis: dbManager.databases.redis ? "connected" : "disconnected",
          mongo: dbManager.databases.mongo ? "connected" : "disconnected"
        };
      }

      res.json(health);
    } catch (error) {
      res.status(500).json({
        status: "unhealthy",
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Logging routes (admin only)
  app.get("/api/logs", authenticateToken, async (req, res) => {
    try {
      if (!loggingService) {
        return res.status(503).json({ error: "Logging service not available" });
      }

      const {
        tenantId = req.tenantId,
        userId,
        action,
        level,
        startDate,
        endDate,
        limit = 100,
        offset = 0
      } = req.query;

      const logs = await loggingService.getLogs({
        tenantId,
        userId,
        action,
        level,
        startDate,
        endDate,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({ logs });
    } catch (error) {
      console.error("Get logs failed:", error);
      res.status(500).json({ error: "Failed to get logs" });
    }
  });

  // Audit trail endpoint
  app.get("/api/audit/:userId", authenticateToken, async (req, res) => {
    try {
      if (!loggingService) {
        return res.status(503).json({ error: "Logging service not available" });
      }

      const { userId } = req.params;
      const { days = 30 } = req.query;

      const auditTrail = await loggingService.getAuditTrail(
        parseInt(userId),
        req.tenantId,
        parseInt(days)
      );

      res.json({ auditTrail });
    } catch (error) {
      console.error("Get audit trail failed:", error);
      res.status(500).json({ error: "Failed to get audit trail" });
    }
  });

  // Security audit endpoint
  app.get("/api/security-audit", authenticateToken, async (req, res) => {
    try {
      if (!loggingService) {
        return res.status(503).json({ error: "Logging service not available" });
      }

      const { days = 30 } = req.query;
      const securityAudit = await loggingService.getSecurityAudit(
        req.tenantId,
        parseInt(days)
      );

      res.json({ securityAudit });
    } catch (error) {
      console.error("Get security audit failed:", error);
      res.status(500).json({ error: "Failed to get security audit" });
    }
  });

  // Graceful shutdown handler
  const gracefulShutdown = async (signal) => {
    console.log(`🛑 Received ${signal}, shutting down gracefully...`);

    try {
      // Close queue service if available
      if (queueService) {
        await queueService.shutdown();
        console.log("✅ Queue service shut down");
      }

      // Close database connections
      await dbManager.disconnect();
      console.log("✅ Database connections closed");

      process.exit(0);
    } catch (error) {
      console.error("❌ Error during shutdown:", error);
      process.exit(1);
    }
  };

  // Register shutdown handlers
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // Legacy endpoints for backward compatibility
  app.get("/ping", (req, res) => res.send("pong"));

  app.get("/mongo-status", async (req, res) => {
    try {
      const health = await dbManager.healthCheck();
      if (health.mongodb) {
        const stats = await dbManager.mongooseConnection.db.stats();
        res.json(stats);
      } else {
        res.status(503).json({ error: "MongoDB not connected" });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/postgres-status", async (req, res) => {
    try {
      const health = await dbManager.healthCheck();
      if (health.postgres) {
        const result = await dbManager.postgresPool.query("SELECT NOW()");
        res.json(result.rows[0]);
      } else {
        res.status(503).json({ error: "PostgreSQL not connected" });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/cache-test", async (req, res) => {
    try {
      const health = await dbManager.healthCheck();
      if (health.redis) {
        await dbManager.redisClient.set("message", "Web3 is fast!");
        const value = await dbManager.redisClient.get("message");
        res.send(`✅ Redis says: ${value}`);
      } else {
        res.status(503).json({ error: "Redis not connected" });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // MinIO test endpoint
  app.get("/minio-status", async (req, res) => {
    const bucket = process.env.MINIO_BUCKET || "dapp";
    try {
      await ensureBucket(bucket);
      const minioClient = getClient();
      const exists = await minioClient.bucketExists(bucket);
      res.json({ bucket, exists, status: "ok" });
    } catch (err) {
      console.error("❌ MinIO error:", err.message);
      res.status(500).json({
        error: "MinIO connection failed",
        detail: err.message
      });
    }
  });

  // Database info endpoint
  app.get("/db-info", async (req, res) => {
    try {
      const health = await dbManager.healthCheck();
      const info = {
        databases: {
          postgres: {
            status: health.postgres ? "connected" : "disconnected",
            type: "PostgreSQL",
            purpose: "Structured data, user accounts, transactions"
          },
          mongodb: {
            status: health.mongodb ? "connected" : "disconnected",
            type: "MongoDB",
            purpose: "Blockchain events, NFT metadata, user activity"
          },
          redis: {
            status: health.redis ? "connected" : "disconnected",
            type: "Redis",
            purpose: "Caching, sessions, real-time data"
          }
        },
        architecture: {
          description: "Multi-database architecture for optimal performance",
          postgresql: "ACID-compliant structured data storage",
          mongodb: "Flexible document storage for blockchain data",
          redis: "High-performance caching and session management"
        }
      };

      res.json(info);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Error handling middleware
  app.use(errorLogger);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: "Not found",
      path: req.path,
      method: req.method
    });
  });

  return app;
}

// Default export for normal usage
module.exports = createApp;

// For direct run (e.g. node src/app.js), start server
if (require.main === module) {
  (async () => {
    const app = await createApp();
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })();
}
