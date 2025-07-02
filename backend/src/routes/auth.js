const express = require("express");
const { body, validationResult } = require("express-validator");
const UserService = require("../services/UserService");
const {
  rateLimit: createRateLimit,
  logAuthEvent
} = require("../middleware/auth");
const UserActivity = require("../models/nosql/UserActivity");

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
    createRateLimit({ max: 2, windowMs: 15 * 60 * 1000 }), // Low limit for testing
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

  // Get user activity with tenant isolation
  router.get("/activity", authenticateToken, async (req, res) => {
    try {
      const { limit = 50, offset = 0 } = req.query;
      const activities = await UserActivity.getUserActivity(
        req.user.userId,
        req.tenantId,
        parseInt(limit),
        parseInt(offset)
      );

      res.json({ activity: activities });
    } catch (error) {
      console.error("Get activity failed:", error);
      res.status(500).json({ error: "Failed to get activity" });
    }
  });

  // Get user sessions
  router.get("/sessions", authenticateToken, async (req, res) => {
    try {
      const sessions = await userService.getUserSessions(
        req.user.userId,
        req.tenantId
      );
      res.json({ sessions });
    } catch (error) {
      console.error("Get sessions failed:", error);
      res.status(500).json({ error: "Failed to get sessions" });
    }
  });

  // Revoke specific session
  router.delete("/sessions/:sessionId", authenticateToken, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const result = await userService.revokeSession(
        req.user.userId,
        sessionId,
        req.tenantId
      );
      res.json(result);
    } catch (error) {
      console.error("Revoke session failed:", error);
      res.status(500).json({ error: "Failed to revoke session" });
    }
  });

  // Revoke all sessions except current
  router.delete("/sessions", authenticateToken, async (req, res) => {
    try {
      const sessions = await userService.getUserSessions(
        req.user.userId,
        req.tenantId
      );
      const currentSessionId = req.sessionId;

      const revokedSessions = [];
      for (const session of sessions) {
        if (session.sessionId !== currentSessionId) {
          await userService.revokeSession(
            req.user.userId,
            session.sessionId,
            req.tenantId
          );
          revokedSessions.push(session.sessionId);
        }
      }

      res.json({
        message: "Sessions revoked successfully",
        revokedCount: revokedSessions.length,
        revokedSessions
      });
    } catch (error) {
      console.error("Revoke all sessions failed:", error);
      res.status(500).json({ error: "Failed to revoke sessions" });
    }
  });

  // Get user stats with tenant context
  router.get("/stats", authenticateToken, async (req, res) => {
    try {
      const stats = await userService.getUserStats(
        req.user.userId,
        req.tenantId
      );
      res.json(stats);
    } catch (error) {
      console.error("Get user stats failed:", error);
      res.status(500).json({ error: "Failed to get user stats" });
    }
  });

  // Get security events
  router.get("/security-events", authenticateToken, async (req, res) => {
    try {
      const { days = 30 } = req.query;
      const events = await UserActivity.getSecurityEvents(
        req.tenantId,
        parseInt(days)
      );
      res.json({ events });
    } catch (error) {
      console.error("Get security events failed:", error);
      res.status(500).json({ error: "Failed to get security events" });
    }
  });

  // Enhanced logout with session tracking
  router.post("/logout", authenticateToken, async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(" ")[1];

      const result = await userService.logoutUser(
        req.user.userId,
        token,
        req.tenantId
      );

      // Log the logout event
      await logAuthEvent(req, "user_logout", { method: "api" });

      res.json(result);
    } catch (error) {
      console.error("Logout failed:", error);
      res.status(500).json({ error: "Logout failed" });
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

  // Email verification
  router.post("/verify-email", [body("token").notEmpty()], async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors.array()
        });
      }

      const { token } = req.body;
      const user = await userService.verifyEmail(token);

      res.json({
        message: "Email verified successfully",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isVerified: user.is_verified
        }
      });
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(400).json({
        error: "Email verification failed",
        message: error.message
      });
    }
  });

  // Resend verification email
  router.post(
    "/resend-verification",
    [body("email").isEmail().normalizeEmail()],
    async (req, res) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            error: "Validation failed",
            details: errors.array()
          });
        }

        const { email } = req.body;
        await userService.resendVerificationEmail(email);

        res.json({
          message: "Verification email sent successfully"
        });
      } catch (error) {
        console.error("Resend verification error:", error);
        res.status(400).json({
          error: "Failed to resend verification email",
          message: error.message
        });
      }
    }
  );

  // Request password reset
  router.post(
    "/forgot-password",
    [body("email").isEmail().normalizeEmail()],
    async (req, res) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            error: "Validation failed",
            details: errors.array()
          });
        }

        const { email } = req.body;
        await userService.requestPasswordReset(email);

        res.json({
          message: "Password reset email sent successfully"
        });
      } catch (error) {
        console.error("Password reset request error:", error);
        res.status(400).json({
          error: "Failed to send password reset email",
          message: error.message
        });
      }
    }
  );

  // Reset password
  router.post(
    "/reset-password",
    [body("token").notEmpty(), body("password").isLength({ min: 8 })],
    async (req, res) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            error: "Validation failed",
            details: errors.array()
          });
        }

        const { token, password } = req.body;
        await userService.resetPassword(token, password);

        res.json({
          message: "Password reset successfully"
        });
      } catch (error) {
        console.error("Password reset error:", error);
        res.status(400).json({
          error: "Password reset failed",
          message: error.message
        });
      }
    }
  );

  // Send 2FA code
  router.post("/send-2fa", [authenticateToken], async (req, res) => {
    try {
      await userService.sendTwoFactorCode(req.user.userId);

      res.json({
        message: "2FA code sent successfully"
      });
    } catch (error) {
      console.error("Send 2FA error:", error);
      res.status(400).json({
        error: "Failed to send 2FA code",
        message: error.message
      });
    }
  });

  // Verify 2FA code
  router.post(
    "/verify-2fa",
    [authenticateToken, body("code").isLength({ min: 6, max: 6 })],
    async (req, res) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            error: "Validation failed",
            details: errors.array()
          });
        }

        const { code } = req.body;
        await userService.verifyTwoFactorCode(req.user.userId, code);

        res.json({
          message: "2FA verification successful"
        });
      } catch (error) {
        console.error("2FA verification error:", error);
        res.status(400).json({
          error: "2FA verification failed",
          message: error.message
        });
      }
    }
  );

  // Enable 2FA
  router.post("/enable-2fa", [authenticateToken], async (req, res) => {
    try {
      const result = await userService.enableTwoFactor(req.user.userId);

      res.json({
        message: "Two-factor authentication enabled",
        secret: result.secret
      });
    } catch (error) {
      console.error("Enable 2FA error:", error);
      res.status(400).json({
        error: "Failed to enable 2FA",
        message: error.message
      });
    }
  });

  // Disable 2FA
  router.post("/disable-2fa", [authenticateToken], async (req, res) => {
    try {
      await userService.disableTwoFactor(req.user.userId);

      res.json({
        message: "Two-factor authentication disabled"
      });
    } catch (error) {
      console.error("Disable 2FA error:", error);
      res.status(400).json({
        error: "Failed to disable 2FA",
        message: error.message
      });
    }
  });

  // Wallet authentication challenge
  router.post(
    "/challenge",
    [body("walletAddress").isLength({ min: 42, max: 42 }), extractClientInfo],
    async (req, res) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            error: "Validation failed",
            details: errors.array()
          });
        }

        const { walletAddress } = req.body;
        const { ipAddress, userAgent } = req.clientInfo;
        const tenantId = req.tenantId;

        const challenge = await userService.generateWalletChallenge(
          walletAddress,
          tenantId
        );

        res.json({
          message: "Challenge generated successfully",
          challenge
        });
      } catch (error) {
        console.error("Challenge generation error:", error);
        res.status(500).json({
          error: "Failed to generate challenge",
          message: error.message
        });
      }
    }
  );

  // Wallet authentication verify
  router.post(
    "/verify",
    [
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
        const { ipAddress, userAgent } = req.clientInfo;
        const tenantId = req.tenantId;

        const result = await userService.verifyWalletSignature(
          walletAddress,
          signature,
          tenantId
        );

        res.json({
          message: "Wallet authentication successful",
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            walletAddress: result.user.wallet_address,
            isVerified: result.user.is_verified,
            tenantId: result.user.tenant_id
          },
          token: result.token,
          sessionId: result.sessionId
        });
      } catch (error) {
        console.error("Wallet verification error:", error);

        if (
          error.message.includes("Challenge not found") ||
          error.message.includes("expired")
        ) {
          return res.status(400).json({
            error: "Invalid or expired challenge",
            message: error.message
          });
        }

        if (error.message.includes("Invalid signature")) {
          return res.status(401).json({
            error: "Invalid signature",
            message: error.message
          });
        }

        res.status(500).json({
          error: "Wallet verification failed",
          message: error.message
        });
      }
    }
  );

  // Wallet authentication (combined challenge + verify flow)
  router.post(
    "/wallet-auth",
    [
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
        const { ipAddress, userAgent } = req.clientInfo;
        const tenantId = req.tenantId;

        const result = await userService.verifyWalletSignature(
          walletAddress,
          signature,
          tenantId
        );

        res.json({
          message: "Wallet authentication successful",
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            walletAddress: result.user.wallet_address,
            isVerified: result.user.is_verified,
            tenantId: result.user.tenant_id
          },
          token: result.token,
          sessionId: result.sessionId
        });
      } catch (error) {
        console.error("Wallet authentication error:", error);

        if (
          error.message.includes("Challenge not found") ||
          error.message.includes("expired")
        ) {
          return res.status(400).json({
            error: "Invalid or expired challenge",
            message: error.message
          });
        }

        if (error.message.includes("Invalid signature")) {
          return res.status(401).json({
            error: "Invalid signature",
            message: error.message
          });
        }

        res.status(500).json({
          error: "Wallet authentication failed",
          message: error.message
        });
      }
    }
  );

  return router;
}

module.exports = createAuthRouter;
