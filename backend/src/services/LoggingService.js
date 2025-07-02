const UserActivity = require("../models/nosql/UserActivity");

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
  }

  /**
   * Log user activity with tenant context
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

      const activity = new UserActivity({
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

      await activity.save();
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

      const activity = new UserActivity({
        userId: null, // System event
        tenantId,
        action: `system_${event}`,
        details: {
          ...details,
          level,
          timestamp: new Date().toISOString()
        },
        metadata: {
          ...metadata,
          tenantId,
          logLevel: level,
          eventType: "SYSTEM"
        }
      });

      await activity.save();

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
   * Log security events
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

      const activity = new UserActivity({
        userId,
        tenantId,
        action: `security_${event}`,
        details: {
          ...details,
          severity,
          timestamp: new Date().toISOString()
        },
        ipAddress,
        userAgent,
        sessionId,
        metadata: {
          tenantId,
          logLevel: "SECURITY",
          severity,
          eventType: "SECURITY"
        }
      });

      await activity.save();

      // Log to console with security prefix
      const logMessage = `[SECURITY:${severity}] [TENANT:${tenantId}] [USER:${
        userId || "SYSTEM"
      }] ${event}: ${JSON.stringify(details)}`;
      this.consoleLog("WARN", logMessage);

      return activity;
    } catch (error) {
      console.error("Failed to log security event:", error);
      throw error;
    }
  }

  /**
   * Log API requests
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

      const activity = new UserActivity({
        userId,
        tenantId,
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
          tenantId,
          logLevel: "API",
          requestBody: requestBody
            ? JSON.stringify(requestBody).substring(0, 500)
            : null
        }
      });

      await activity.save();

      // Log slow requests or errors
      if (responseTime > 1000 || statusCode >= 400) {
        const logMessage = `[API] [TENANT:${tenantId}] ${method} ${path} - ${statusCode} (${responseTime}ms)`;
        this.consoleLog(statusCode >= 400 ? "ERROR" : "WARN", logMessage);
      }

      return activity;
    } catch (error) {
      console.error("Failed to log API request:", error);
      throw error;
    }
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

      const activity = new UserActivity({
        userId: null,
        tenantId,
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
          tenantId,
          logLevel: "DATABASE",
          operation,
          success
        }
      });

      await activity.save();

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

      const activity = new UserActivity({
        userId,
        tenantId,
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
          tenantId,
          logLevel: "BLOCKCHAIN",
          operation,
          success
        }
      });

      await activity.save();

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

      const activities = await UserActivity.find(query)
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
}

module.exports = LoggingService;
