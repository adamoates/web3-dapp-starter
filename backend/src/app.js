require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const DatabaseManager = require("./db/DatabaseManager");
const createAuthRouter = require("./routes/auth");
const createWeb3Router = require("./routes/web3");
const createFileRouter = require("./routes/files");
const MinIOService = require("./services/MinIOService");
const { getClient, ensureBucket } = require("./utils/minio");
const nodemailer = require("nodemailer");

function createApp({ dbManager, minioService } = {}) {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  // Use provided dbManager or default
  dbManager = dbManager || new DatabaseManager();
  minioService = minioService || new MinIOService();

  // Only initialize MinIO if not in test
  if (process.env.NODE_ENV !== "test") {
    minioService.init().catch(console.error);
  }

  // Routes with database access
  app.use("/api/auth", createAuthRouter(dbManager));
  app.use("/api/web3", createWeb3Router(dbManager));
  app.use("/api/files", createFileRouter(dbManager));

  // Health check endpoint
  app.get("/health", async (req, res) => {
    try {
      const health = await dbManager.healthCheck();
      const minioHealth = await minioService.healthCheck();

      const isHealthy =
        health.postgres &&
        health.mongodb &&
        health.redis &&
        minioHealth.status === "healthy";

      res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? "healthy" : "unhealthy",
        databases: health,
        storage: minioHealth,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Health check error:", error);
      res.status(503).json({
        status: "unhealthy",
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

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

  // Email test endpoint
  app.get("/test-email", async (req, res) => {
    try {
      const transporter = nodemailer.createTransporter({
        host: process.env.MAIL_HOST || "mailpit",
        port: parseInt(process.env.MAIL_PORT || "1025", 10),
        secure: false,
        auth: process.env.MAIL_USERNAME
          ? { user: process.env.MAIL_USERNAME, pass: process.env.MAIL_PASSWORD }
          : undefined
      });

      const info = await transporter.sendMail({
        from: `"Dapp Mail" <${process.env.MAIL_FROM}>`,
        to: process.env.TEST_EMAIL_TO,
        subject: "Test Email from Dapp Backend ✔",
        text: "🚀 This is a test email sent from your Web3 backend."
      });
      res.json({ message: "✅ Email sent", info });
    } catch (error) {
      console.error("❌ Email send error:", error);
      res.status(500).json({
        error: "Failed to send email",
        detail: error.message
      });
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
  app.use((error, req, res, next) => {
    console.error("Unhandled error:", error);
    res.status(500).json({
      error: "Internal server error",
      message:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Something went wrong"
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: "Not found"
    });
  });

  return app;
}

// Default export for normal usage
module.exports = createApp;

// For direct run (e.g. node src/app.js), start server
if (require.main === module) {
  const app = createApp();
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}
