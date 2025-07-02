const LoggingService = require("../services/LoggingService");

let loggingService = null;

/**
 * Initialize logging middleware with database connections
 */
function initializeLogging(databases) {
  loggingService = new LoggingService(databases);
}

/**
 * Log API requests with tenant context and performance metrics
 */
function logApiRequests(req, res, next) {
  if (!loggingService) {
    return next();
  }

  const startTime = Date.now();
  const originalSend = res.send;

  // Capture request details
  const requestData = {
    method: req.method,
    path: req.path,
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get("User-Agent"),
    tenantId: req.tenantId,
    userId: req.user?.userId,
    sessionId: req.sessionId,
    requestBody: req.body,
    query: req.query,
    headers: {
      "content-type": req.get("Content-Type"),
      authorization: req.get("Authorization") ? "Bearer [REDACTED]" : undefined
    }
  };

  // Override res.send to capture response details
  res.send = function (data) {
    const responseTime = Date.now() - startTime;
    const responseSize = data ? JSON.stringify(data).length : 0;

    // Log the API request
    loggingService
      .logApiRequest({
        userId: requestData.userId,
        tenantId: requestData.tenantId,
        method: requestData.method,
        path: requestData.path,
        statusCode: res.statusCode,
        responseTime,
        ipAddress: requestData.ipAddress,
        userAgent: requestData.userAgent,
        sessionId: requestData.sessionId,
        requestBody: requestData.requestBody,
        responseSize
      })
      .catch((error) => {
        console.error("Failed to log API request:", error);
      });

    // Call original send
    originalSend.call(this, data);
  };

  next();
}

/**
 * Log security events
 */
function logSecurityEvents(req, res, next) {
  if (!loggingService) {
    return next();
  }

  // Log failed authentication attempts
  const originalJson = res.json;
  res.json = function (data) {
    if (res.statusCode === 401 || res.statusCode === 403) {
      loggingService
        .logSecurityEvent({
          userId: req.user?.userId,
          tenantId: req.tenantId,
          event: "auth_failure",
          details: {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            error: data.error
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
          sessionId: req.sessionId,
          severity: "HIGH"
        })
        .catch((error) => {
          console.error("Failed to log security event:", error);
        });
    }

    originalJson.call(this, data);
  };

  next();
}

/**
 * Log database operations
 */
function logDatabaseOperation(
  operation,
  table,
  recordId = null,
  details = {},
  duration = null,
  success = true
) {
  if (!loggingService) {
    return Promise.resolve();
  }

  return loggingService.logDatabaseOperation({
    tenantId: null, // Will be set by the calling service
    operation,
    table,
    recordId,
    details,
    duration,
    success
  });
}

/**
 * Log blockchain operations
 */
function logBlockchainOperation(operation, details = {}, success = true) {
  if (!loggingService) {
    return Promise.resolve();
  }

  return loggingService.logBlockchainOperation({
    userId: null, // Will be set by the calling service
    tenantId: null, // Will be set by the calling service
    operation,
    ...details,
    success
  });
}

/**
 * Log system events
 */
function logSystemEvent(event, details = {}, level = "INFO") {
  if (!loggingService) {
    return Promise.resolve();
  }

  return loggingService.logSystemEvent({
    event,
    details,
    level
  });
}

/**
 * Log user activity
 */
function logUserActivity(data) {
  if (!loggingService) {
    return Promise.resolve();
  }

  return loggingService.logUserActivity(data);
}

/**
 * Performance monitoring middleware
 */
function performanceMonitor(req, res, next) {
  const startTime = process.hrtime.bigint();

  res.on("finish", () => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

    // Log slow requests
    if (duration > 1000) {
      logSystemEvent(
        "slow_request",
        {
          method: req.method,
          path: req.path,
          duration: Math.round(duration),
          statusCode: res.statusCode,
          tenantId: req.tenantId
        },
        "WARN"
      );
    }

    // Log very slow requests as errors
    if (duration > 5000) {
      logSystemEvent(
        "very_slow_request",
        {
          method: req.method,
          path: req.path,
          duration: Math.round(duration),
          statusCode: res.statusCode,
          tenantId: req.tenantId
        },
        "ERROR"
      );
    }
  });

  next();
}

/**
 * Error logging middleware
 */
function errorLogger(err, req, res, next) {
  if (!loggingService) {
    return next(err);
  }

  // Log the error
  loggingService
    .logSystemEvent({
      event: "api_error",
      level: "ERROR",
      details: {
        method: req.method,
        path: req.path,
        error: err.message,
        stack: err.stack,
        statusCode: res.statusCode || 500,
        tenantId: req.tenantId,
        userId: req.user?.userId
      }
    })
    .catch((error) => {
      console.error("Failed to log error:", error);
    });

  next(err);
}

/**
 * Request sanitizer for logging
 */
function sanitizeRequest(req) {
  const sanitized = { ...req };

  // Remove sensitive data
  if (sanitized.body) {
    const sensitiveFields = [
      "password",
      "token",
      "secret",
      "key",
      "authorization"
    ];
    sensitiveFields.forEach((field) => {
      if (sanitized.body[field]) {
        sanitized.body[field] = "[REDACTED]";
      }
    });
  }

  if (sanitized.headers) {
    if (sanitized.headers.authorization) {
      sanitized.headers.authorization = "Bearer [REDACTED]";
    }
  }

  return sanitized;
}

module.exports = {
  initializeLogging,
  logApiRequests,
  logSecurityEvents,
  logDatabaseOperation,
  logBlockchainOperation,
  logSystemEvent,
  logUserActivity,
  performanceMonitor,
  errorLogger,
  sanitizeRequest
};
