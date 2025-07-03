const express = require("express");
const bcrypt = require("bcryptjs");
const { faker } = require("@faker-js/faker");

function createTestRouter(databases) {
  const router = express.Router();

  // Only enable test routes in development or test environment
  if (process.env.NODE_ENV === "production") {
    return router; // Return empty router for production
  }

  // Create a test user with known credentials
  router.post("/users", async (req, res) => {
    try {
      const { email, password, name } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: "Email and password are required"
        });
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Get default tenant
      const tenantResult = await databases.postgres.query(
        "SELECT id FROM tenants WHERE slug = 'default' LIMIT 1"
      );
      const defaultTenantId = tenantResult.rows[0]?.id;

      if (!defaultTenantId) {
        return res.status(500).json({
          error: "Default tenant not found"
        });
      }

      // Create the user
      const result = await databases.postgres.query(
        `
        INSERT INTO users (email, password_hash, name, is_verified, tenant_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (email) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          name = EXCLUDED.name,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, email, name, is_verified, tenant_id
      `,
        [email, hashedPassword, name || "Test User", true, defaultTenantId]
      );

      const user = result.rows[0];

      res.status(201).json({
        message: "Test user created successfully",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isVerified: user.is_verified,
          tenantId: user.tenant_id
        },
        credentials: {
          email: email,
          password: password // Only return in test environment
        }
      });
    } catch (error) {
      console.error("Create test user error:", error);
      res.status(500).json({
        error: "Failed to create test user",
        message: error.message
      });
    }
  });

  // Create multiple test users
  router.post("/users/bulk", async (req, res) => {
    try {
      const { count = 5, password = "TestPass123!" } = req.body;

      // Get default tenant
      const tenantResult = await databases.postgres.query(
        "SELECT id FROM tenants WHERE slug = 'default' LIMIT 1"
      );
      const defaultTenantId = tenantResult.rows[0]?.id;

      if (!defaultTenantId) {
        return res.status(500).json({
          error: "Default tenant not found"
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const users = [];

      for (let i = 0; i < count; i++) {
        const email = faker.internet.email();
        const name = faker.person.fullName();

        const result = await databases.postgres.query(
          `
          INSERT INTO users (email, password_hash, name, is_verified, tenant_id, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (email) DO UPDATE SET
            password_hash = EXCLUDED.password_hash,
            name = EXCLUDED.name,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id, email, name, is_verified
        `,
          [email, hashedPassword, name, true, defaultTenantId]
        );

        users.push({
          id: result.rows[0].id,
          email: result.rows[0].email,
          name: result.rows[0].name,
          isVerified: result.rows[0].is_verified
        });
      }

      res.status(201).json({
        message: `${users.length} test users created successfully`,
        users: users,
        credentials: {
          password: password // Only return in test environment
        }
      });
    } catch (error) {
      console.error("Create bulk test users error:", error);
      res.status(500).json({
        error: "Failed to create test users",
        message: error.message
      });
    }
  });

  // Get all test users
  router.get("/users", async (req, res) => {
    try {
      const result = await databases.postgres.query(
        "SELECT id, email, name, is_verified, tenant_id, created_at FROM users ORDER BY created_at DESC LIMIT 50"
      );

      res.json({
        message: "Test users retrieved successfully",
        users: result.rows.map((user) => ({
          id: user.id,
          email: user.email,
          name: user.name,
          isVerified: user.is_verified,
          tenantId: user.tenant_id,
          createdAt: user.created_at
        }))
      });
    } catch (error) {
      console.error("Get test users error:", error);
      res.status(500).json({
        error: "Failed to get test users",
        message: error.message
      });
    }
  });

  // Clean up test data
  router.post("/cleanup", async (req, res) => {
    try {
      const { keepUsers = [] } = req.body; // Array of user IDs to keep

      let deleteQuery = "DELETE FROM users";
      let params = [];

      if (keepUsers.length > 0) {
        deleteQuery +=
          " WHERE id NOT IN (" +
          keepUsers.map((_, i) => `$${i + 1}`).join(",") +
          ")";
        params = keepUsers;
      }

      const result = await databases.postgres.query(deleteQuery, params);

      res.json({
        message: "Test data cleaned up successfully",
        deletedUsers: result.rowCount
      });
    } catch (error) {
      console.error("Cleanup error:", error);
      res.status(500).json({
        error: "Failed to cleanup test data",
        message: error.message
      });
    }
  });

  // Health check for test environment
  router.get("/health", async (req, res) => {
    try {
      const health = {
        status: "healthy",
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        databases: {
          postgres: false,
          mongodb: false,
          redis: false
        }
      };

      // Check PostgreSQL
      try {
        await databases.postgres.query("SELECT 1");
        health.databases.postgres = true;
      } catch (error) {
        console.error("PostgreSQL health check failed:", error.message);
      }

      // Check MongoDB
      try {
        await databases.mongo.db.admin().ping();
        health.databases.mongodb = true;
      } catch (error) {
        console.error("MongoDB health check failed:", error.message);
      }

      // Check Redis
      try {
        await databases.redis.ping();
        health.databases.redis = true;
      } catch (error) {
        console.error("Redis health check failed:", error.message);
      }

      res.json(health);
    } catch (error) {
      console.error("Health check error:", error);
      res.status(500).json({
        status: "unhealthy",
        error: error.message
      });
    }
  });

  return router;
}

module.exports = createTestRouter;
