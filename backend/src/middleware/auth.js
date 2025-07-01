const UserService = require("../services/UserService");

// Initialize UserService (will be injected with databases)
let userService;

// Initialize the middleware with database connections
function initializeAuth(databases) {
  userService = new UserService(databases);
}

/**
 * Authenticate JWT token from Authorization header
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

    const user = await userService.verifyToken(token);

    if (!user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(500).json({ error: "Authentication service error" });
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
 * Rate limiting middleware
 */
function rateLimit(options = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 5 // limit each IP to 5 requests per windowMs
  } = options;

  return (req, res, next) => {
    // Simple in-memory rate limiting (in production, use Redis)
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    if (!req.app.locals.rateLimit) {
      req.app.locals.rateLimit = new Map();
    }

    const rateLimitMap = req.app.locals.rateLimit;

    if (!rateLimitMap.has(ip)) {
      rateLimitMap.set(ip, { count: 0, resetTime: now + windowMs });
    }

    const rateLimit = rateLimitMap.get(ip);

    if (now > rateLimit.resetTime) {
      rateLimit.count = 0;
      rateLimit.resetTime = now + windowMs;
    }

    if (rateLimit.count >= max) {
      console.log(
        `[RateLimit] IP ${ip} is rate limited (count: ${rateLimit.count}, max: ${max})`
      );
      return res.status(429).json({
        error: "Too many requests, please try again later"
      });
    }

    rateLimit.count++;
    console.log(
      `[RateLimit] IP ${ip} request count: ${rateLimit.count}/${max}`
    );
    next();
  };
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

module.exports = {
  initializeAuth,
  authenticateToken,
  requireAuth,
  optionalAuth,
  requireRole,
  rateLimit,
  validateWalletOwnership
};
