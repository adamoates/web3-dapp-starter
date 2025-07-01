const express = require("express");
const { body, validationResult } = require("express-validator");
const UserService = require("../services/UserService");
const { rateLimit } = require("../middleware/auth");

function createAuthRouter(dbManager) {
  const router = express.Router();
  const userService = new UserService(dbManager);

  // Middleware to extract client info
  const extractClientInfo = (req, res, next) => {
    req.clientInfo = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent")
    };
    next();
  };

  // Middleware to validate JWT token
  const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }

    try {
      const decoded = await userService.verifyToken(token);
      if (!decoded) {
        return res.status(403).json({ error: "Invalid or expired token" });
      }

      req.user = decoded;
      next();
    } catch (error) {
      return res.status(403).json({ error: "Token verification failed" });
    }
  };

  // Register new user
  router.post(
    "/register",
    [
      body("email").isEmail().normalizeEmail(),
      body("password").isLength({ min: 8 }),
      body("name").trim().isLength({ min: 2, max: 100 }),
      body("walletAddress").optional().isLength({ min: 42, max: 42 }),
      extractClientInfo
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

        const { email, password, name, walletAddress } = req.body;
        const { ipAddress, userAgent } = req.clientInfo;

        const user = await userService.registerUser(
          { email, password, name, walletAddress },
          ipAddress,
          userAgent
        );

        res.status(201).json({
          message: "User registered successfully",
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            walletAddress: user.wallet_address,
            isVerified: user.is_verified
          }
        });
      } catch (error) {
        console.error("Registration error:", error);

        if (error.code === "23505") {
          // PostgreSQL unique constraint violation
          return res.status(409).json({
            error: "User already exists with this email or wallet address"
          });
        }

        res.status(500).json({
          error: "Registration failed",
          message: error.message
        });
      }
    }
  );

  // Login user
  router.post(
    "/login",
    [
      body("email").isEmail().normalizeEmail(),
      body("password").notEmpty(),
      extractClientInfo
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

        const { email, password } = req.body;
        const { ipAddress, userAgent } = req.clientInfo;

        const result = await userService.loginUser(
          email,
          password,
          ipAddress,
          userAgent
        );

        res.json({
          message: "Login successful",
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            walletAddress: result.user.wallet_address,
            isVerified: result.user.is_verified
          },
          token: result.token
        });
      } catch (error) {
        console.error("Login error:", error);

        if (
          error.message === "User not found" ||
          error.message === "Invalid password"
        ) {
          return res.status(401).json({
            error: "Invalid email or password"
          });
        }

        res.status(500).json({
          error: "Login failed",
          message: error.message
        });
      }
    }
  );

  // Link wallet to user
  router.post(
    "/link-wallet",
    [
      authenticateToken,
      body("walletAddress").isLength({ min: 42, max: 42 }),
      body("signature").notEmpty(),
      extractClientInfo
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

        const { walletAddress, signature } = req.body;
        const { ipAddress } = req.clientInfo;

        const user = await userService.linkWalletToUser(
          req.user.userId,
          walletAddress,
          signature,
          ipAddress
        );

        res.json({
          message: "Wallet linked successfully",
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            walletAddress: user.wallet_address
          }
        });
      } catch (error) {
        console.error("Wallet linking error:", error);
        res.status(500).json({
          error: "Wallet linking failed",
          message: error.message
        });
      }
    }
  );

  // Get user profile
  router.get(
    "/profile",
    rateLimit({ max: 2, windowMs: 15 * 60 * 1000 }), // Low limit for testing
    authenticateToken,
    async (req, res) => {
      try {
        const profile = await userService.getUserProfile(req.user.userId);
        res.json({ profile });
      } catch (error) {
        console.error("Get profile error:", error);
        res.status(500).json({
          error: "Failed to get profile",
          message: error.message
        });
      }
    }
  );

  // Update user profile
  router.put(
    "/profile",
    [
      authenticateToken,
      body("name").optional().trim().isLength({ min: 2, max: 100 }),
      body("email").optional().isEmail().normalizeEmail(),
      extractClientInfo
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

        const updates = {};
        if (req.body.name) updates.name = req.body.name;
        if (req.body.email) updates.email = req.body.email;

        if (Object.keys(updates).length === 0) {
          return res.status(400).json({ error: "No valid fields to update" });
        }

        const { ipAddress } = req.clientInfo;
        const user = await userService.updateUserProfile(
          req.user.userId,
          updates,
          ipAddress
        );

        res.json({
          message: "Profile updated successfully",
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            walletAddress: user.wallet_address,
            isVerified: user.is_verified
          }
        });
      } catch (error) {
        console.error("Profile update error:", error);
        res.status(500).json({
          error: "Profile update failed",
          message: error.message
        });
      }
    }
  );

  // Get user activity
  router.get(
    "/activity",
    [
      authenticateToken,
      body("limit").optional().isInt({ min: 1, max: 100 }),
      body("offset").optional().isInt({ min: 0 })
    ],
    async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        const activity = await userService.getUserActivity(
          req.user.userId,
          limit,
          offset
        );
        res.json({ activity });
      } catch (error) {
        console.error("Get activity error:", error);
        res.status(500).json({
          error: "Failed to get activity",
          message: error.message
        });
      }
    }
  );

  // Get user stats
  router.get("/stats", authenticateToken, async (req, res) => {
    try {
      const stats = await userService.getUserStats(req.user.userId);
      res.json({ stats });
    } catch (error) {
      console.error("Get stats error:", error);
      res.status(500).json({
        error: "Failed to get stats",
        message: error.message
      });
    }
  });

  // Logout user
  router.post("/logout", authenticateToken, async (req, res) => {
    try {
      const authHeader = req.headers["authorization"];
      const token = authHeader && authHeader.split(" ")[1];

      await userService.logoutUser(req.user.userId, token);
      res.json({ message: "Logout successful" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({
        error: "Logout failed",
        message: error.message
      });
    }
  });

  // Verify token
  router.get("/verify", authenticateToken, async (req, res) => {
    res.json({
      message: "Token is valid",
      user: {
        id: req.user.userId,
        type: req.user.type
      }
    });
  });

  return router;
}

module.exports = createAuthRouter;
