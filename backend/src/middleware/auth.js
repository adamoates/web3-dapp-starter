const UserService = require("../services/UserService");
const { rateLimit } = require("express-rate-limit");
const { ethers } = require("ethers");
const crypto = require("crypto");

// Initialize UserService and LoggingService (will be injected with databases)
let userService = null;
let loggingService = null;

// Wallet authentication state
const walletNonces = new Map(); // address -> { nonce, timestamp }
const NONCE_EXPIRY = parseInt(process.env.WALLET_NONCE_EXPIRY) || 5 * 60 * 1000; // 5 minutes

// Initialize the middleware with database connections
function initializeAuth(databases) {
  userService = new UserService(databases);

  // Initialize logging service for enhanced activity logging
  try {
    const LoggingService = require("../services/LoggingService");
    loggingService = new LoggingService(databases);
    console.log("✅ Auth middleware initialized with enhanced logging");
  } catch (error) {
    console.warn("Enhanced logging service not available");
  }

  console.log("✅ Auth middleware initialized with wallet support");
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
 * Enhanced authentication event logging
 */
async function logAuthEvent(req, eventType, details = {}) {
  try {
    if (loggingService && loggingService.logActivity) {
      // Use enhanced activity logging
      await loggingService.logActivity({
        userId: req.user?.userId?.toString() || "anonymous",
        tenantId: req.tenantId || 1,
        walletAddress: req.user?.walletAddress,
        action: eventType,
        details: {
          ...details,
          path: req.path,
          method: req.method
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        sessionId: req.sessionId
      });
    } else if (userService) {
      // Fallback to original method
      const activity = new (require("../models/nosql/UserActivity"))({
        userId: req.user?.userId || 0,
        tenantId: req.tenantId || 1,
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
    }
  } catch (error) {
    console.error("Failed to log auth event:", error);
  }
}

/**
 * Generate wallet challenge for authentication
 */
function generateWalletChallenge(walletAddress) {
  const nonce = crypto.randomBytes(16).toString("hex");
  const timestamp = Date.now();

  walletNonces.set(walletAddress.toLowerCase(), { nonce, timestamp });
  cleanupExpiredNonces();

  const message = `Sign this message to authenticate with our service.

Wallet: ${walletAddress}
Nonce: ${nonce}
Timestamp: ${new Date().toISOString()}
Expires: ${new Date(timestamp + NONCE_EXPIRY).toISOString()}`;

  return {
    nonce,
    message,
    expiresAt: new Date(timestamp + NONCE_EXPIRY)
  };
}

/**
 * Verify wallet signature
 */
async function verifyWalletSignature(walletAddress, signature, providedNonce) {
  const normalizedAddress = walletAddress.toLowerCase();
  const storedNonce = walletNonces.get(normalizedAddress);

  if (!storedNonce || storedNonce.nonce !== providedNonce) {
    throw new Error("Invalid or expired nonce");
  }

  if (Date.now() - storedNonce.timestamp > NONCE_EXPIRY) {
    walletNonces.delete(normalizedAddress);
    throw new Error("Nonce expired");
  }

  // Recreate and verify the signed message
  const message = `Sign this message to authenticate with our service.

Wallet: ${walletAddress}
Nonce: ${providedNonce}
Timestamp: ${new Date(storedNonce.timestamp).toISOString()}
Expires: ${new Date(storedNonce.timestamp + NONCE_EXPIRY).toISOString()}`;

  const recoveredAddress = ethers.utils.verifyMessage(message, signature);

  if (recoveredAddress.toLowerCase() !== normalizedAddress) {
    throw new Error("Signature verification failed");
  }

  walletNonces.delete(normalizedAddress);
  return true;
}

/**
 * Authenticate wallet user
 */
async function authenticateWallet(
  walletAddress,
  signature,
  nonce,
  tenantId,
  req = {}
) {
  const db = userService?.databases?.postgres;
  if (!db) throw new Error("Database not available");

  await verifyWalletSignature(walletAddress, signature, nonce);
  const normalizedAddress = walletAddress.toLowerCase();

  // Find or create user
  let userResult = await db.query(
    `SELECT * FROM users WHERE wallet_address = $1 AND tenant_id = $2`,
    [normalizedAddress, tenantId]
  );
  let user = userResult.rows[0];
  let isNewUser = false;

  if (!user) {
    const insertResult = await db.query(
      `
      INSERT INTO users (wallet_address, tenant_id, password_hash, name, is_verified, last_login_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `,
      [
        normalizedAddress,
        tenantId,
        "", // Empty password hash for wallet users
        `User ${normalizedAddress.slice(0, 8)}`,
        true,
        new Date(),
        new Date(),
        new Date()
      ]
    );

    user = insertResult.rows[0];
    isNewUser = true;
  } else {
    await db.query(
      `UPDATE users SET last_login_at = $1, updated_at = $2 WHERE id = $3`,
      [new Date(), new Date(), user.id]
    );
  }

  // Generate JWT
  const jwt = require("jsonwebtoken");
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      walletAddress: user.wallet_address,
      tenantId: user.tenant_id,
      authMethod: "wallet",
      iat: Math.floor(Date.now() / 1000)
    },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );

  await logAuthEvent(req, "wallet_auth_success", {
    userId: user.id,
    walletAddress: normalizedAddress,
    isNewUser
  });

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      walletAddress: user.wallet_address,
      tenantId: user.tenant_id,
      authMethod: "wallet"
    },
    token,
    expiresIn: "24h",
    isNewUser
  };
}

/**
 * Clean up expired nonces
 */
function cleanupExpiredNonces() {
  const now = Date.now();
  for (const [address, data] of walletNonces.entries()) {
    if (now - data.timestamp > NONCE_EXPIRY) {
      walletNonces.delete(address);
    }
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
  validateWalletOwnership,
  generateWalletChallenge,
  verifyWalletSignature,
  authenticateWallet,
  cleanupExpiredNonces
};
