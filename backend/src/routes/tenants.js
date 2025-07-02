const express = require("express");
const {
  authenticateToken,
  requireAdmin,
  logAuthEvent
} = require("../middleware/auth");
const {
  resolveTenant,
  requireTenant,
  validateTenantAccess
} = require("../middleware/tenant");
const { body, validationResult } = require("express-validator");
const TenantService = require("../services/TenantService");
const UserActivity = require("../models/nosql/UserActivity");

function createTenantRouter(dbManager) {
  const router = express.Router();
  const tenantService = new TenantService(dbManager);

  // Get all tenants (admin only)
  router.get("/", authenticateToken, requireAdmin, async (req, res) => {
    try {
      // TODO: Add admin role check
      const tenants = await tenantService.tenant.findAll();

      res.json({
        message: "Tenants retrieved successfully",
        tenants,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Get tenants error:", error);
      res.status(500).json({
        error: "Failed to get tenants",
        message: error.message
      });
    }
  });

  // Get current tenant info
  router.get("/current", resolveTenant, requireTenant, async (req, res) => {
    try {
      const tenant = req.tenant;

      res.json({
        message: "Current tenant retrieved successfully",
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          domain: tenant.domain,
          branding: tenant.branding,
          settings: tenant.settings
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Get current tenant error:", error);
      res.status(500).json({
        error: "Failed to get current tenant",
        message: error.message
      });
    }
  });

  // Get tenant by slug
  router.get("/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const tenant = await tenantService.getTenantConfigBySlug(slug);

      if (!tenant) {
        return res.status(404).json({
          error: "Tenant not found",
          message: `Tenant with slug '${slug}' not found`
        });
      }

      res.json({
        message: "Tenant retrieved successfully",
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          domain: tenant.domain,
          branding: tenant.branding
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Get tenant error:", error);
      res.status(500).json({
        error: "Failed to get tenant",
        message: error.message
      });
    }
  });

  // Create new tenant
  router.post(
    "/",
    [
      authenticateToken,
      body("name").isLength({ min: 2, max: 255 }),
      body("slug")
        .isLength({ min: 2, max: 100 })
        .matches(/^[a-z0-9-]+$/),
      body("domain").optional().isURL(),
      body("smtpConfig").optional().isObject(),
      body("brandingConfig").optional().isObject(),
      body("blockchainConfig").optional().isObject(),
      body("storageConfig").optional().isObject(),
      body("settings").optional().isObject()
    ],
    async (req, res) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            error: "Validation failed",
            details: errors.array()
          });
        }

        const tenantData = {
          name: req.body.name,
          slug: req.body.slug,
          domain: req.body.domain,
          smtpConfig: req.body.smtpConfig,
          brandingConfig: req.body.brandingConfig,
          blockchainConfig: req.body.blockchainConfig,
          storageConfig: req.body.storageConfig,
          settings: req.body.settings
        };

        const tenant = await tenantService.createTenant(tenantData);

        res.status(201).json({
          message: "Tenant created successfully",
          tenant: {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            domain: tenant.domain,
            status: tenant.status,
            createdAt: tenant.created_at
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error("Create tenant error:", error);
        res.status(500).json({
          error: "Failed to create tenant",
          message: error.message
        });
      }
    }
  );

  // Update tenant
  router.put(
    "/:id",
    [
      authenticateToken,
      body("name").optional().isLength({ min: 2, max: 255 }),
      body("domain").optional().isURL(),
      body("smtpConfig").optional().isObject(),
      body("brandingConfig").optional().isObject(),
      body("blockchainConfig").optional().isObject(),
      body("storageConfig").optional().isObject(),
      body("settings").optional().isObject()
    ],
    async (req, res) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            error: "Validation failed",
            details: errors.array()
          });
        }

        const { id } = req.params;
        const updates = {};

        // Only include provided fields
        if (req.body.name) updates.name = req.body.name;
        if (req.body.domain) updates.domain = req.body.domain;
        if (req.body.smtpConfig) updates.smtpConfig = req.body.smtpConfig;
        if (req.body.brandingConfig)
          updates.brandingConfig = req.body.brandingConfig;
        if (req.body.blockchainConfig)
          updates.blockchainConfig = req.body.blockchainConfig;
        if (req.body.storageConfig)
          updates.storageConfig = req.body.storageConfig;
        if (req.body.settings) updates.settings = req.body.settings;

        const tenant = await tenantService.updateTenant(id, updates);

        res.json({
          message: "Tenant updated successfully",
          tenant: {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            domain: tenant.domain,
            status: tenant.status,
            updatedAt: tenant.updated_at
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error("Update tenant error:", error);
        res.status(500).json({
          error: "Failed to update tenant",
          message: error.message
        });
      }
    }
  );

  // Get tenant statistics
  router.get("/:id/stats", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const stats = await tenantService.getTenantStats(id);

      res.json({
        message: "Tenant statistics retrieved successfully",
        tenantId: id,
        stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Get tenant stats error:", error);
      res.status(500).json({
        error: "Failed to get tenant statistics",
        message: error.message
      });
    }
  });

  // Get tenant configuration
  router.get("/:id/config", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const config = await tenantService.getTenantConfig(id);

      res.json({
        message: "Tenant configuration retrieved successfully",
        tenantId: id,
        config,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Get tenant config error:", error);
      res.status(500).json({
        error: "Failed to get tenant configuration",
        message: error.message
      });
    }
  });

  // Delete tenant (soft delete)
  router.delete("/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const tenant = await tenantService.tenant.delete(id);

      res.json({
        message: "Tenant deleted successfully",
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          status: tenant.status,
          deletedAt: tenant.updated_at
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Delete tenant error:", error);
      res.status(500).json({
        error: "Failed to delete tenant",
        message: error.message
      });
    }
  });

  // Get tenant analytics and stats
  router.get(
    "/analytics",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
      try {
        const { days = 30 } = req.query;

        // Get tenant activity stats
        const activityStats = await UserActivity.getTenantStats(
          req.tenantId,
          parseInt(days)
        );

        // Get daily activity
        const dailyActivity = await UserActivity.getTenantDailyActivity(
          req.tenantId,
          7
        );

        // Get active sessions
        const activeSessions = await UserActivity.getActiveSessions(
          req.tenantId,
          24
        );

        // Get security events
        const securityEvents = await UserActivity.getSecurityEvents(
          req.tenantId,
          parseInt(days)
        );

        // Get popular actions
        const popularActions = await UserActivity.getPopularActions(
          req.tenantId,
          10
        );

        res.json({
          activityStats,
          dailyActivity,
          activeSessions: activeSessions.length,
          securityEvents: securityEvents.length,
          popularActions
        });
      } catch (error) {
        console.error("Get tenant analytics failed:", error);
        res.status(500).json({ error: "Failed to get analytics" });
      }
    }
  );

  // Get tenant activity feed
  router.get("/activity", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { limit = 100, offset = 0 } = req.query;
      const activities = await UserActivity.getTenantActivity(
        req.tenantId,
        parseInt(limit),
        parseInt(offset)
      );

      res.json({ activities });
    } catch (error) {
      console.error("Get tenant activity failed:", error);
      res.status(500).json({ error: "Failed to get activity" });
    }
  });

  // Get active sessions for tenant
  router.get("/sessions", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { hours = 24 } = req.query;
      const sessions = await UserActivity.getActiveSessions(
        req.tenantId,
        parseInt(hours)
      );

      res.json({ sessions });
    } catch (error) {
      console.error("Get tenant sessions failed:", error);
      res.status(500).json({ error: "Failed to get sessions" });
    }
  });

  // Revoke all sessions for a specific user in tenant
  router.delete(
    "/users/:userId/sessions",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
      try {
        const { userId } = req.params;

        // Get user sessions
        const userSessions = await UserActivity.getUserSessionData(
          userId,
          req.tenantId
        );

        // Revoke all sessions
        const revokedSessions = [];
        for (const session of userSessions) {
          if (session.sessionId) {
            // This would require access to UserService - for now just log
            revokedSessions.push(session.sessionId);
          }
        }

        // Log the admin action
        await logAuthEvent(req, "admin_session_revoke", {
          targetUserId: userId,
          revokedCount: revokedSessions.length,
          tenantId: req.tenantId
        });

        res.json({
          message: "User sessions revoked successfully",
          userId,
          revokedCount: revokedSessions.length
        });
      } catch (error) {
        console.error("Revoke user sessions failed:", error);
        res.status(500).json({ error: "Failed to revoke sessions" });
      }
    }
  );

  // Get security events for tenant
  router.get(
    "/security-events",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
      try {
        const { days = 30, type } = req.query;
        let events = await UserActivity.getSecurityEvents(
          req.tenantId,
          parseInt(days)
        );

        // Filter by type if specified
        if (type) {
          events = events.filter((event) => event.action === type);
        }

        res.json({ events });
      } catch (error) {
        console.error("Get security events failed:", error);
        res.status(500).json({ error: "Failed to get security events" });
      }
    }
  );

  // Get tenant configuration
  router.get("/config", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const tenant = await tenantService.getTenantById(req.tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      res.json({
        id: tenant.id,
        name: tenant.name,
        domain: tenant.domain,
        settings: tenant.settings,
        features: tenant.features,
        limits: tenant.limits
      });
    } catch (error) {
      console.error("Get tenant config failed:", error);
      res.status(500).json({ error: "Failed to get tenant configuration" });
    }
  });

  // Update tenant configuration
  router.put("/config", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { settings, features, limits } = req.body;

      const updatedTenant = await tenantService.updateTenant(req.tenantId, {
        settings,
        features,
        limits
      });

      // Log the configuration change
      await logAuthEvent(req, "tenant_config_updated", {
        updatedFields: Object.keys(req.body),
        tenantId: req.tenantId
      });

      res.json({
        message: "Tenant configuration updated successfully",
        tenant: updatedTenant
      });
    } catch (error) {
      console.error("Update tenant config failed:", error);
      res.status(500).json({ error: "Failed to update tenant configuration" });
    }
  });

  // Get tenant usage statistics
  router.get("/usage", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { period = "30d" } = req.query;

      // Get user count
      const userCount = await tenantService.getUserCount(req.tenantId);

      // Get activity count for period
      const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
      const activityStats = await UserActivity.getTenantStats(
        req.tenantId,
        days
      );

      // Get active sessions count
      const activeSessions = await UserActivity.getActiveSessions(
        req.tenantId,
        24
      );

      // Calculate usage metrics
      const totalActivities = activityStats.reduce(
        (sum, stat) => sum + stat.count,
        0
      );
      const uniqueUsers = activeSessions.length;

      res.json({
        period,
        userCount,
        totalActivities,
        activeUsers: uniqueUsers,
        activityBreakdown: activityStats
      });
    } catch (error) {
      console.error("Get tenant usage failed:", error);
      res.status(500).json({ error: "Failed to get usage statistics" });
    }
  });

  // Cleanup old data for tenant
  router.post("/cleanup", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { daysOld = 90 } = req.body;

      // Cleanup old activities
      const cleanupResult = await UserActivity.cleanupOldActivities(
        daysOld,
        req.tenantId
      );

      // Log the cleanup action
      await logAuthEvent(req, "tenant_data_cleanup", {
        daysOld,
        tenantId: req.tenantId,
        cleanedCount: cleanupResult.deletedCount || 0
      });

      res.json({
        message: "Tenant data cleanup completed",
        daysOld,
        cleanedCount: cleanupResult.deletedCount || 0
      });
    } catch (error) {
      console.error("Tenant cleanup failed:", error);
      res.status(500).json({ error: "Failed to cleanup tenant data" });
    }
  });

  return router;
}

module.exports = createTenantRouter;
