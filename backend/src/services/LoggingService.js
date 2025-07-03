const UserActivityModel = require("../models/nosql/UserActivity").Model;
const { v4: uuidv4 } = require("uuid");

class LoggingService {
  constructor(databases) {
    this.databases = databases;
    this.logLevels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3
    };
    this.currentLogLevel = this.logLevels[process.env.LOG_LEVEL || "INFO"];

    // Enhanced activity logging with batching
    this.batchSize = parseInt(process.env.ACTIVITY_BATCH_SIZE) || 100;
    this.batchTimeout = parseInt(process.env.ACTIVITY_BATCH_TIMEOUT) || 5000;
    this.pendingMongoBatch = new Map();
    this.pendingPostgresBatch = new Map();
    this.batchTimers = new Map();
    this.redis = databases?.redis || null;

    // Performance monitoring thresholds
    this.slowRequestThreshold =
      parseInt(process.env.SLOW_REQUEST_THRESHOLD) || 1000;
    this.largeResponseThreshold =
      parseInt(process.env.LARGE_RESPONSE_THRESHOLD) || 1024 * 1024;

    console.log(
      "✅ Enhanced LoggingService initialized with batching and dual-database support"
    );
  }

  /**
   * Enhanced activity logging with batching, dual-database support, and Redis integration
   */
  async logActivity({
    userId,
    tenantId,
    walletAddress = null,
    action,
    details = {},
    tableName = null,
    recordId = null,
    oldValues = null,
    newValues = null,
    ipAddress = null,
    userAgent = null,
    sessionId = null
  }) {
    const timestamp = new Date();

    // MongoDB activity log (detailed, flexible schema)
    const mongoLog = {
      userId: parseInt(userId),
      tenantId: parseInt(tenantId),
      walletAddress,
      action,
      details: {
        ...details,
        ipAddress,
        userAgent,
        sessionId
      },
      timestamp
    };

    // PostgreSQL audit log (structured, compliance)
    const auditLog = {
      user_id: parseInt(userId),
      tenant_id: parseInt(tenantId),
      action,
      table_name: tableName,
      record_id: recordId ? parseInt(recordId) : null,
      old_values: oldValues ? JSON.stringify(oldValues) : null,
      new_values: newValues ? JSON.stringify(newValues) : null,
      ip_address: ipAddress,
      user_agent: userAgent,
      created_at: timestamp
    };

    // Add to batches and process
    this.addToBatch(tenantId, mongoLog, "mongo");
    if (tableName) {
      this.addToBatch(tenantId, auditLog, "postgres");
    }

    await this.updateRedisActivity(userId, tenantId, action);
    return { mongoLog, auditLog };
  }

  /**
   * Add log to batch for processing
   */
  addToBatch(tenantId, log, type) {
    const key = `${type}:${tenantId}`;
    const batch =
      type === "mongo" ? this.pendingMongoBatch : this.pendingPostgresBatch;

    if (!batch.has(key)) {
      batch.set(key, []);
    }

    batch.get(key).push(log);

    // Set timer for batch processing
    if (!this.batchTimers.has(key)) {
      this.batchTimers.set(
        key,
        setTimeout(() => {
          this.flushBatch(key, type);
        }, this.batchTimeout)
      );
    }

    // Flush if batch is full
    if (batch.get(key).length >= this.batchSize) {
      clearTimeout(this.batchTimers.get(key));
      this.batchTimers.delete(key);
      this.flushBatch(key, type);
    }
  }

  /**
   * Flush batch to database
   */
  async flushBatch(key, type) {
    try {
      const batch =
        type === "mongo" ? this.pendingMongoBatch : this.pendingPostgresBatch;
      const logs = batch.get(key) || [];

      if (logs.length === 0) return;

      if (type === "mongo") {
        await UserActivityModel.insertMany(logs);
      } else if (type === "postgres" && this.databases?.postgresql) {
        // Insert into PostgreSQL audit table
        const values = logs.map((log) => [
          log.user_id,
          log.tenant_id,
          log.action,
          log.table_name,
          log.record_id,
          log.old_values,
          log.new_values,
          log.ip_address,
          log.user_agent,
          log.created_at
        ]);

        await this.databases.postgresql.query(
          `
          INSERT INTO audit_logs (user_id, tenant_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent, created_at)
          VALUES ${values
            .map(
              (_, i) =>
                `($${i * 10 + 1}, $${i * 10 + 2}, $${i * 10 + 3}, $${
                  i * 10 + 4
                }, $${i * 10 + 5}, $${i * 10 + 6}, $${i * 10 + 7}, $${
                  i * 10 + 8
                }, $${i * 10 + 9}, $${i * 10 + 10})`
            )
            .join(", ")}
        `,
          values.flat()
        );
      }

      batch.delete(key);
      this.batchTimers.delete(key);
    } catch (error) {
      console.error(`Failed to flush ${type} batch:`, error);
    }
  }

  /**
   * Update Redis with activity tracking
   */
  async updateRedisActivity(userId, tenantId, action) {
    if (!this.redis) return;

    try {
      const now = Date.now();
      const userKey = `activity:user:${userId}:${tenantId}`;
      const tenantKey = `activity:tenant:${tenantId}`;

      // Update user activity
      await this.redis.zadd(userKey, now, `${action}:${now}`);
      await this.redis.expire(userKey, 86400); // 24 hours

      // Update tenant activity
      await this.redis.zadd(tenantKey, now, `${userId}:${action}:${now}`);
      await this.redis.expire(tenantKey, 86400); // 24 hours

      // Keep only last 1000 activities
      await this.redis.zremrangebyrank(userKey, 0, -1001);
      await this.redis.zremrangebyrank(tenantKey, 0, -1001);
    } catch (error) {
      console.error("Failed to update Redis activity:", error);
    }
  }

  /**
   * Log user activity with tenant context (backward compatibility)
   */
  async logUserActivity(data) {
    try {
      const {
        userId,
        tenantId,
        action,
        details = {},
        ipAddress = null,
        userAgent = null,
        sessionId = null,
        metadata = {}
      } = data;

      // Use enhanced logging if available
      if (this.logActivity) {
        return await this.logActivity({
          userId,
          tenantId,
          action,
          details: {
            ...details,
            ...metadata
          },
          ipAddress,
          userAgent,
          sessionId
        });
      }

      // Fallback to original method
      const activity = await UserActivityModel.create({
        userId,
        tenantId,
        action,
        details: {
          ...details,
          timestamp: new Date().toISOString()
        },
        ipAddress,
        userAgent,
        sessionId,
        metadata: {
          ...metadata,
          tenantId,
          logLevel: "ACTIVITY"
        }
      });
      return activity;
    } catch (error) {
      console.error("Failed to log user activity:", error);
      throw error;
    }
  }

  /**
   * Log system events
   */
  async logSystemEvent(data) {
    try {
      const {
        tenantId = null,
        event,
        level = "INFO",
        details = {},
        metadata = {}
      } = data;

      // Only log if level is appropriate
      if (this.logLevels[level] > this.currentLogLevel) {
        return;
      }

      const activity = await UserActivityModel.create({
        userId: 0, // System user for system events
        tenantId: tenantId || 1, // Default tenant if not provided
        action: `system_${event}`,
        details: {
          ...details,
          level,
          timestamp: new Date().toISOString()
        },
        metadata: {
          ...metadata,
          tenantId: tenantId || 1,
          logLevel: level,
          eventType: "SYSTEM"
        }
      });

      // Also log to console for immediate visibility
      const logMessage = `[${level}] [TENANT:${
        tenantId || "GLOBAL"
      }] ${event}: ${JSON.stringify(details)}`;
      this.consoleLog(level, logMessage);

      return activity;
    } catch (error) {
      console.error("Failed to log system event:", error);
      throw error;
    }
  }

  /**
   * Enhanced security event logging with threat detection
   */
  async logSecurityEvent(data) {
    try {
      const {
        userId = null,
        tenantId,
        event,
        details = {},
        ipAddress = null,
        userAgent = null,
        sessionId = null,
        severity = "MEDIUM"
      } = data;

      // Enhanced threat detection
      const securityChecks = {
        suspiciousUserAgent: /bot|crawler|spider|scraper/i.test(
          userAgent || ""
        ),
        sqlInjectionAttempt: /union|select|insert|delete|drop|exec/i.test(
          JSON.stringify(details)
        ),
        pathTraversal: /\.\.\/|\.\.\\/.test(details.path || ""),
        unusualMethod:
          details.method &&
          ![
            "GET",
            "POST",
            "PUT",
            "DELETE",
            "PATCH",
            "OPTIONS",
            "HEAD"
          ].includes(details.method)
      };

      const securityFlags = Object.entries(securityChecks)
        .filter(([key, detected]) => detected)
        .map(([key]) => key);

      // Upgrade severity if threats detected
      let finalSeverity = severity;
      if (securityFlags.length > 0) {
        finalSeverity = "HIGH";
        console.warn("🚨 Security threat detected:", {
          flags: securityFlags,
          event,
          ipAddress
        });
      }

      // Use enhanced activity logging if available
      if (this.logActivity) {
        await this.logActivity({
          userId: userId || "anonymous",
          tenantId: tenantId || 1,
          action: `security_${event}`,
          details: {
            ...details,
            severity: finalSeverity,
            securityFlags,
            threatLevel: securityFlags.length > 0 ? "HIGH" : "NORMAL"
          },
          ipAddress,
          userAgent,
          sessionId
        });
      } else {
        // Fallback to original method
        const activity = await UserActivityModel.create({
          userId: userId || 0,
          tenantId: tenantId || 1,
          action: `security_${event}`,
          details: {
            ...details,
            severity: finalSeverity,
            securityFlags,
            timestamp: new Date().toISOString()
          },
          ipAddress,
          userAgent,
          sessionId,
          metadata: {
            tenantId: tenantId || 1,
            logLevel: "SECURITY",
            severity: finalSeverity,
            eventType: "SECURITY"
          }
        });
      }

      // Enhanced console logging with threat indicators
      const threatIndicator = securityFlags.length > 0 ? "🚨" : "🔒";
      const logMessage = `${threatIndicator} [SECURITY:${finalSeverity}] [TENANT:${tenantId}] [USER:${
        userId || "SYSTEM"
      }] ${event}: ${JSON.stringify({ ...details, securityFlags })}`;
      this.consoleLog(finalSeverity === "HIGH" ? "ERROR" : "WARN", logMessage);

      return { success: true, securityFlags, severity: finalSeverity };
    } catch (error) {
      console.error("Failed to log security event:", error);
      throw error;
    }
  }

  /**
   * Enhanced API request logging with performance monitoring
   */
  async logApiRequest(data) {
    try {
      const {
        userId = null,
        tenantId,
        method,
        path,
        statusCode,
        responseTime,
        ipAddress = null,
        userAgent = null,
        sessionId = null,
        requestBody = null,
        responseSize = null
      } = data;

      // Enhanced performance monitoring
      const isSlowRequest = responseTime > this.slowRequestThreshold;
      const isLargeResponse = responseSize > this.largeResponseThreshold;
      const isError = statusCode >= 400;

      // Use enhanced activity logging if available
      if (this.logActivity) {
        await this.logActivity({
          userId: userId || "anonymous",
          tenantId: tenantId || 1,
          action: this.determineActionType(method, path, statusCode),
          details: {
            api: {
              method,
              path,
              statusCode,
              responseTime,
              responseSize,
              slow: isSlowRequest,
              large: isLargeResponse
            },
            performance: {
              responseTime,
              slow: isSlowRequest,
              large: isLargeResponse
            }
          },
          ipAddress,
          userAgent,
          sessionId
        });
      } else {
        // Fallback to original method
        const activity = await UserActivityModel.create({
          userId: userId || 0,
          tenantId: tenantId || 1,
          action: "api_request",
          details: {
            method,
            path,
            statusCode,
            responseTime,
            responseSize,
            timestamp: new Date().toISOString()
          },
          ipAddress,
          userAgent,
          sessionId,
          metadata: {
            tenantId: tenantId || 1,
            logLevel: "API",
            requestBody: requestBody
              ? JSON.stringify(requestBody).substring(0, 500)
              : null
          }
        });
      }

      // Enhanced console logging with performance indicators
      const statusColor = statusCode < 400 ? "✅" : "❌";
      const durationColor = isSlowRequest ? "🐌" : "⚡";
      const sizeIndicator = isLargeResponse ? "📦" : "";

      const logMessage = `📤 [API] ${statusColor} ${statusCode} ${durationColor} ${responseTime}ms ${sizeIndicator} ${method} ${path}`;
      this.consoleLog(
        isError ? "ERROR" : isSlowRequest ? "WARN" : "INFO",
        logMessage
      );

      // Log performance warnings
      if (isSlowRequest) {
        await this.logSystemEvent({
          tenantId,
          event: "slow_request",
          level: "WARN",
          details: {
            method,
            path,
            responseTime,
            threshold: this.slowRequestThreshold
          }
        });
      }

      if (isLargeResponse) {
        await this.logSystemEvent({
          tenantId,
          event: "large_response",
          level: "WARN",
          details: {
            method,
            path,
            responseSize,
            threshold: this.largeResponseThreshold
          }
        });
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to log API request:", error);
      throw error;
    }
  }

  /**
   * Determine action type for API requests
   */
  determineActionType(method, path, statusCode) {
    const patterns = {
      "GET /auth/profile": "profile_view",
      "POST /auth/login": statusCode < 400 ? "login_success" : "login_failed",
      "POST /auth/challenge": "wallet_challenge_request",
      "POST /auth/verify":
        statusCode < 400 ? "wallet_auth_success" : "wallet_auth_failed",
      "POST /files/avatar":
        statusCode < 400 ? "avatar_upload" : "avatar_upload_failed"
    };

    const pathParts = path.split("/").filter((part) => part.length > 0);
    if (pathParts[0] === "api") pathParts.shift();

    const key = `${method} /${pathParts.join("/")}`;
    return (
      patterns[key] ||
      `${method.toLowerCase()}_${pathParts[0] || "unknown"}${
        statusCode >= 400 ? "_failed" : ""
      }`
    );
  }

  /**
   * Log database operations
   */
  async logDatabaseOperation(data) {
    try {
      const {
        tenantId,
        operation,
        table,
        recordId = null,
        details = {},
        duration = null,
        success = true
      } = data;

      const activity = await UserActivityModel.create({
        userId: 0, // System user for database operations
        tenantId: tenantId || 1, // Default tenant if not provided
        action: `db_${operation}`,
        details: {
          table,
          recordId,
          duration,
          success,
          ...details,
          timestamp: new Date().toISOString()
        },
        metadata: {
          tenantId: tenantId || 1,
          logLevel: "DATABASE",
          operation,
          success
        }
      });

      // Log slow operations or failures
      if (!success || (duration && duration > 100)) {
        const logMessage = `[DB] [TENANT:${tenantId}] ${operation} on ${table} - ${
          success ? "SUCCESS" : "FAILED"
        } (${duration}ms)`;
        this.consoleLog(success ? "WARN" : "ERROR", logMessage);
      }

      return activity;
    } catch (error) {
      console.error("Failed to log database operation:", error);
      throw error;
    }
  }

  /**
   * Log blockchain operations
   */
  async logBlockchainOperation(data) {
    try {
      const {
        userId = null,
        tenantId,
        operation,
        txHash = null,
        contractAddress = null,
        details = {},
        success = true,
        gasUsed = null,
        blockNumber = null
      } = data;

      const activity = await UserActivityModel.create({
        userId: userId || 0, // System user if no user ID
        tenantId: tenantId || 1, // Default tenant if not provided
        action: `blockchain_${operation}`,
        details: {
          txHash,
          contractAddress,
          gasUsed,
          blockNumber,
          success,
          ...details,
          timestamp: new Date().toISOString()
        },
        metadata: {
          tenantId: tenantId || 1,
          logLevel: "BLOCKCHAIN",
          operation,
          success
        }
      });

      // Log all blockchain operations
      const logMessage = `[BLOCKCHAIN] [TENANT:${tenantId}] ${operation} - ${
        success ? "SUCCESS" : "FAILED"
      } ${txHash ? `(TX: ${txHash})` : ""}`;
      this.consoleLog(success ? "INFO" : "ERROR", logMessage);

      return activity;
    } catch (error) {
      console.error("Failed to log blockchain operation:", error);
      throw error;
    }
  }

  /**
   * Get logs with filtering
   */
  async getLogs(filters = {}) {
    try {
      const {
        tenantId,
        userId = null,
        action = null,
        level = null,
        startDate = null,
        endDate = null,
        limit = 100,
        offset = 0
      } = filters;

      let query = {};

      if (tenantId) query.tenantId = tenantId;
      if (userId) query.userId = userId;
      if (action) query.action = action;
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
      }

      const activities = await UserActivityModel.find(query)
        .sort({ timestamp: -1 })
        .skip(offset)
        .limit(limit)
        .lean();

      return activities;
    } catch (error) {
      console.error("Failed to get logs:", error);
      throw error;
    }
  }

  /**
   * Get audit trail for a specific user
   */
  async getAuditTrail(userId, tenantId, days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const activities = await UserActivity.find({
        userId,
        tenantId,
        timestamp: { $gte: startDate }
      })
        .sort({ timestamp: -1 })
        .lean();

      return activities;
    } catch (error) {
      console.error("Failed to get audit trail:", error);
      throw error;
    }
  }

  /**
   * Get security audit for tenant
   */
  async getSecurityAudit(tenantId, days = 30) {
    try {
      const securityEvents = await UserActivity.getSecurityEvents(
        tenantId,
        days
      );
      return securityEvents;
    } catch (error) {
      console.error("Failed to get security audit:", error);
      throw error;
    }
  }

  /**
   * Cleanup old logs
   */
  async cleanupOldLogs(daysOld = 90, tenantId = null) {
    try {
      const result = await UserActivity.cleanupOldActivities(daysOld, tenantId);

      // Log the cleanup operation
      await this.logSystemEvent({
        tenantId,
        event: "log_cleanup",
        level: "INFO",
        details: {
          daysOld,
          cleanedCount: result.deletedCount || 0
        }
      });

      return result;
    } catch (error) {
      console.error("Failed to cleanup old logs:", error);
      throw error;
    }
  }

  /**
   * Console logging with appropriate level
   */
  consoleLog(level, message) {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] ${message}`;

    switch (level) {
      case "ERROR":
        console.error(formattedMessage);
        break;
      case "WARN":
        console.warn(formattedMessage);
        break;
      case "INFO":
        console.info(formattedMessage);
        break;
      case "DEBUG":
        console.debug(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }
  }

  /**
   * Set log level
   */
  setLogLevel(level) {
    if (this.logLevels.hasOwnProperty(level)) {
      this.currentLogLevel = this.logLevels[level];
      this.logSystemEvent({
        event: "log_level_changed",
        level: "INFO",
        details: { newLevel: level }
      });
    }
  }

  /**
   * Flush all pending batches (for graceful shutdown)
   */
  async flushAllBatches() {
    try {
      const mongoKeys = Array.from(this.pendingMongoBatch.keys());
      const postgresKeys = Array.from(this.pendingPostgresBatch.keys());

      // Clear all timers
      for (const [key, timer] of this.batchTimers.entries()) {
        clearTimeout(timer);
      }
      this.batchTimers.clear();

      // Flush all batches
      await Promise.all([
        ...mongoKeys.map((key) => this.flushBatch(key, "mongo")),
        ...postgresKeys.map((key) => this.flushBatch(key, "postgres"))
      ]);

      console.log(
        `✅ Flushed ${mongoKeys.length + postgresKeys.length} activity batches`
      );
    } catch (error) {
      console.error("Failed to flush all batches:", error);
    }
  }

  /**
   * Get activity statistics from Redis
   */
  async getActivityStats(userId, tenantId, hours = 24) {
    if (!this.redis) return null;

    try {
      const now = Date.now();
      const cutoff = now - hours * 60 * 60 * 1000;

      const userKey = `activity:user:${userId}:${tenantId}`;
      const tenantKey = `activity:tenant:${tenantId}`;

      const [userActivities, tenantActivities] = await Promise.all([
        this.redis.zrangebyscore(userKey, cutoff, now),
        this.redis.zrangebyscore(tenantKey, cutoff, now)
      ]);

      return {
        userActivityCount: userActivities.length,
        tenantActivityCount: tenantActivities.length,
        userActivities: userActivities.slice(-10), // Last 10 activities
        tenantActivities: tenantActivities.slice(-10)
      };
    } catch (error) {
      console.error("Failed to get activity stats:", error);
      return null;
    }
  }
}

module.exports = LoggingService;
