const UserService = require("../services/UserService");
const { rateLimit } = require("express-rate-limit");

// Initialize UserService (will be injected with databases)
let userService = null;

// Initialize the middleware with database connections
function initializeAuth(databases) {
  userService = new UserService(databases);
}

/**
 * Authenticate JWT token from Authorization header with tenant context
 */
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "Access token required" });
    }

    const token = authHeader.split(" ")[1];

    if (!token || authHeader.split(" ")[0] !== "Bearer") {
      return res.status(401).json({ error: "Invalid authorization format" });
    }

    // Extract tenant context from request (could be from subdomain, header, or query param)
    const tenantId =
      req.tenantId || req.headers["x-tenant-id"] || req.query.tenantId;

    const user = await userService.verifyToken(token, tenantId);

    if (!user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Add tenant context to request
    req.user = user;
    req.tenantId = user.tenantId;
    req.sessionId = user.sessionId;

    next();
  } catch (error) {
    // console.error("Authentication error:", error);
    return res.status(500).json({ error: "Authentication service error" });
  }
}

/**
 * Validate session is still active
 */
async function validateSession(req, res, next) {
  try {
    if (!req.user || !req.sessionId || !req.tenantId) {
      return res.status(401).json({ error: "Invalid session" });
    }

    // Check if session is still active in Redis
    const sessionKey = `tenant:${req.tenantId}:user_session:${req.user.userId}`;
    const sessionData = await userService.databases.redis.get(sessionKey);

    if (!sessionData) {
      return res.status(401).json({ error: "Session expired" });
    }

    const session = JSON.parse(sessionData);
    if (session.sessionId !== req.sessionId) {
      return res.status(401).json({ error: "Session mismatch" });
    }

    // Update last activity
    session.lastActivity = new Date().toISOString();
    await userService.databases.redis.setex(
      sessionKey,
      3600,
      JSON.stringify(session)
    );

    next();
  } catch (error) {
    console.error("Session validation error:", error);
    return res.status(500).json({ error: "Session validation failed" });
  }
}

/**
 * Require authentication - user must be logged in
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

/**
 * Optional authentication - user can be logged in or not
 */
function optionalAuth(req, res, next) {
  // User can be authenticated or not, continue either way
  next();
}

/**
 * Require specific role
 */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (req.user.role !== role) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
}

/**
 * Require specific tenant access
 */
function requireTenant(tenantId) {
  return (req, res, next) => {
    if (!req.tenantId || req.tenantId !== tenantId) {
      return res.status(403).json({ error: "Tenant access denied" });
    }
    next();
  };
}

/**
 * Require admin role within tenant
 */
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

/**
 * Rate limiting middleware with tenant isolation
 */
function createRateLimit(options = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100, // limit each IP to 100 requests per windowMs
    message = "Too many requests from this IP",
    keyGenerator = null
  } = options;

  return rateLimit({
    windowMs,
    max,
    message,
    keyGenerator:
      keyGenerator ||
      ((req) => {
        // Include tenant context in rate limiting key
        const tenantId =
          req.tenantId || req.headers["x-tenant-id"] || "default";
        return `${tenantId}:${req.ip}`;
      }),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
}

/**
 * Validate wallet ownership
 */
function validateWalletOwnership() {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const walletAddress = req.params.walletAddress;

    if (!walletAddress) {
      return res.status(400).json({ error: "Wallet address required" });
    }

    if (req.user.walletAddress !== walletAddress) {
      return res.status(403).json({
        error: "Access denied: wallet ownership required"
      });
    }

    next();
  };
}

/**
 * Log authentication events
 */
async function logAuthEvent(req, eventType, details = {}) {
  try {
    if (!userService) return;

    const activity = new (require("../models/nosql/UserActivity"))({
      userId: req.user?.userId,
      tenantId: req.tenantId,
      action: eventType,
      details: {
        ...details,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        sessionId: req.sessionId
      },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      sessionId: req.sessionId
    });
    await activity.save();
  } catch (error) {
    console.error("Failed to log auth event:", error);
  }
}

module.exports = {
  initializeAuth,
  authenticateToken,
  validateSession,
  requireTenant,
  requireAdmin,
  createRateLimit,
  logAuthEvent,
  requireAuth,
  optionalAuth,
  requireRole,
  validateWalletOwnership
};
