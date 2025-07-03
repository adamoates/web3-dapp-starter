const User = require("../models/sql/User");
const UserActivityModel = require("../models/nosql/UserActivity").Model;
const crypto = require("crypto");
const Transaction = require("../models/sql/Transaction");
const EmailService = require("./EmailService");

class UserService {
  constructor(databases) {
    this.user = new User(databases.postgres);
    this.transaction = new Transaction(databases.postgres);
    this.databases = databases;
    this.emailService = new EmailService();
  }

  async registerUser(userData, ipAddress = null, userAgent = null) {
    try {
      // Create user in PostgreSQL
      const user = await this.user.create(userData);

      // Send welcome email with verification
      try {
        await this.emailService.sendWelcomeEmail(user);
      } catch (emailError) {
        console.warn("Failed to send welcome email:", emailError.message);
        // Don't fail registration if email fails
      }

      // Log activity in MongoDB with tenant context
      const activity = await UserActivityModel.create({
        userId: user.id,
        tenantId: user.tenant_id,
        action: "user_registered",
        details: {
          email: user.email,
          name: user.name,
          hasWallet: !!userData.walletAddress,
          tenantId: user.tenant_id
        },
        ipAddress,
        userAgent,
        sessionId: this.generateSessionId(user.id, user.tenant_id)
      });

      // Cache user session in Redis with tenant isolation
      const sessionKey = `tenant:${user.tenant_id}:user_session:${user.id}`;
      const sessionData = {
        ...user,
        sessionId: activity.sessionId,
        lastActivity: new Date().toISOString(),
        tenantId: user.tenant_id
      };
      await this.databases.redis.setex(
        sessionKey,
        3600,
        JSON.stringify(sessionData)
      );

      // Cache user profile for quick access with tenant isolation
      const profileKey = `tenant:${user.tenant_id}:user_profile:${user.id}`;
      await this.databases.redis.setex(
        profileKey,
        1800,
        JSON.stringify({
          id: user.id,
          email: user.email,
          name: user.name,
          walletAddress: user.wallet_address,
          isVerified: user.is_verified,
          tenantId: user.tenant_id,
          sessionId: activity.sessionId
        })
      );

      return user;
    } catch (error) {
      // console.error("User registration failed:", error);
      throw error;
    }
  }

  async loginUser(
    email,
    password,
    ipAddress = null,
    userAgent = null,
    tenantId = null
  ) {
    try {
      // Find user in PostgreSQL with tenant filtering
      const user = await this.user.findByEmail(email, tenantId);
      if (!user) {
        throw new Error("User not found");
      }

      // Check if account is locked
      const isLocked = await this.user.isAccountLocked(user.id);
      if (isLocked) {
        throw new Error(
          "Account is temporarily locked due to too many failed attempts"
        );
      }

      // Validate password
      const isValid = await this.user.validatePassword(
        password,
        user.password_hash
      );
      if (!isValid) {
        // Record failed login attempt
        await this.user.recordLoginAttempt(user.id, false);
        throw new Error("Invalid password");
      }

      // Record successful login
      await this.user.recordLoginAttempt(user.id, true);

      // Generate JWT token with tenant ID and session ID
      const sessionId = this.generateSessionId(user.id, user.tenant_id);
      const token = this.user.generateToken(user.id, user.tenant_id, sessionId);

      // Log activity in MongoDB with tenant context
      await UserActivityModel.create({
        userId: user.id,
        tenantId: user.tenant_id,
        action: "user_login",
        details: {
          method: "email",
          sessionId,
          tenantId: user.tenant_id
        },
        ipAddress,
        userAgent,
        sessionId
      });

      // Cache session in Redis with tenant isolation
      const sessionKey = `tenant:${user.tenant_id}:user_session:${user.id}`;
      const sessionData = {
        ...user,
        sessionId,
        lastActivity: new Date().toISOString(),
        tenantId: user.tenant_id
      };
      await this.databases.redis.setex(
        sessionKey,
        3600,
        JSON.stringify(sessionData)
      );

      // Store JWT in Redis for blacklisting capability with tenant isolation
      const tokenKey = `tenant:${user.tenant_id}:jwt:${user.id}:${
        token.split(".")[2]
      }`;
      await this.databases.redis.setex(
        tokenKey,
        86400,
        JSON.stringify({
          sessionId,
          issuedAt: new Date().toISOString(),
          tenantId: user.tenant_id
        })
      );

      // Track active sessions per tenant
      const activeSessionsKey = `tenant:${user.tenant_id}:active_sessions`;
      await this.databases.redis.sadd(activeSessionsKey, sessionId);
      await this.databases.redis.expire(activeSessionsKey, 86400);

      return { user, token, sessionId };
    } catch (error) {
      // console.error("User login failed:", error);
      throw error;
    }
  }

  async verifyEmail(token) {
    try {
      const user = await this.user.verifyEmail(token);
      if (!user) {
        throw new Error("Invalid or expired verification token");
      }

      // Log activity with tenant context
      const activity = await UserActivityModel.create({
        userId: user.id,
        tenantId: user.tenant_id,
        action: "email_verified",
        details: {
          email: user.email,
          tenantId: user.tenant_id
        },
        sessionId: this.generateSessionId(user.id, user.tenant_id)
      });

      // Update cache with tenant isolation
      const profileKey = `tenant:${user.tenant_id}:user_profile:${user.id}`;
      const sessionKey = `tenant:${user.tenant_id}:user_session:${user.id}`;

      const profile = {
        id: user.id,
        email: user.email,
        name: user.name,
        isVerified: user.is_verified,
        tenantId: user.tenant_id
      };

      await this.databases.redis.setex(
        profileKey,
        1800,
        JSON.stringify(profile)
      );
      await this.databases.redis.setex(sessionKey, 3600, JSON.stringify(user));

      return user;
    } catch (error) {
      throw error;
    }
  }

  async resendVerificationEmail(email) {
    try {
      const user = await this.user.resendVerificationEmail(email);
      if (!user) {
        throw new Error("User not found or already verified");
      }

      // Send verification email
      await this.emailService.sendVerificationEmail(
        user,
        user.email_verification_token
      );

      // Log activity
      const activity = await UserActivityModel.create({
        userId: user.id,
        tenantId: user.tenant_id,
        action: "verification_email_resent",
        details: { email: user.email }
      });

      return { message: "Verification email sent successfully" };
    } catch (error) {
      throw error;
    }
  }

  async requestPasswordReset(email) {
    try {
      const user = await this.user.createPasswordResetToken(email);
      if (!user) {
        throw new Error("User not found");
      }

      // Send password reset email
      await this.emailService.sendPasswordResetEmail(
        user,
        user.password_reset_token
      );

      // Log activity
      const activity = await UserActivityModel.create({
        userId: user.id,
        tenantId: user.tenant_id,
        action: "password_reset_requested",
        details: { email: user.email }
      });

      return { message: "Password reset email sent successfully" };
    } catch (error) {
      throw error;
    }
  }

  async resetPassword(token, newPassword) {
    try {
      const user = await this.user.resetPassword(token, newPassword);
      if (!user) {
        throw new Error("Invalid or expired reset token");
      }

      // Log activity
      const activity = await UserActivityModel.create({
        userId: user.id,
        tenantId: user.tenant_id,
        action: "password_reset_completed",
        details: { email: user.email }
      });

      // Clear cache
      const sessionKey = `user_session:${user.id}`;
      const profileKey = `user_profile:${user.id}`;
      await this.databases.redis.del(sessionKey);
      await this.databases.redis.del(profileKey);

      return { message: "Password reset successfully" };
    } catch (error) {
      throw error;
    }
  }

  async sendTwoFactorCode(userId) {
    try {
      const user = await this.user.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      if (!user.two_factor_enabled) {
        throw new Error("Two-factor authentication not enabled");
      }

      const twoFactorCode = this.emailService.generateTwoFactorCode();

      // Store code in Redis with expiration (10 minutes)
      const codeKey = `2fa:${userId}:${twoFactorCode}`;
      await this.databases.redis.setex(codeKey, 600, "valid");

      // Send 2FA email
      await this.emailService.sendTwoFactorEmail(user, twoFactorCode);

      // Log activity
      const activity = await UserActivityModel.create({
        userId: user.id,
        tenantId: user.tenant_id,
        action: "2fa_code_sent",
        details: { email: user.email }
      });

      return { message: "2FA code sent successfully" };
    } catch (error) {
      throw error;
    }
  }

  async verifyTwoFactorCode(userId, code) {
    try {
      const codeKey = `2fa:${userId}:${code}`;
      const isValid = await this.databases.redis.get(codeKey);

      if (!isValid) {
        throw new Error("Invalid or expired 2FA code");
      }

      // Remove the code after successful verification
      await this.databases.redis.del(codeKey);

      // Log activity
      const activity = await UserActivityModel.create({
        userId,
        tenantId: 1, // Default tenant for 2FA operations
        action: "2fa_verified",
        details: { method: "email" }
      });

      return { message: "2FA verification successful" };
    } catch (error) {
      throw error;
    }
  }

  async enableTwoFactor(userId) {
    try {
      const secret = require("crypto").randomBytes(32).toString("hex");
      const user = await this.user.enableTwoFactor(userId, secret);

      // Log activity
      const activity = await UserActivityModel.create({
        userId,
        tenantId: 1, // Default tenant for 2FA operations
        action: "2fa_enabled",
        details: { method: "email" }
      });

      return { message: "Two-factor authentication enabled", secret };
    } catch (error) {
      throw error;
    }
  }

  async disableTwoFactor(userId) {
    try {
      const user = await this.user.disableTwoFactor(userId);

      // Log activity
      const activity = await UserActivityModel.create({
        userId,
        tenantId: 1, // Default tenant for 2FA operations
        action: "2fa_disabled",
        details: { method: "email" }
      });

      return { message: "Two-factor authentication disabled" };
    } catch (error) {
      throw error;
    }
  }

  async sendSecurityAlert(userId, alertType, details = {}) {
    try {
      const user = await this.user.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      await this.emailService.sendSecurityAlert(user, alertType, details);

      // Log activity
      const activity = await UserActivityModel.create({
        userId,
        tenantId: user.tenant_id,
        action: "security_alert_sent",
        details: { alertType, ...details }
      });

      return { message: "Security alert sent successfully" };
    } catch (error) {
      throw error;
    }
  }

  async linkWalletToUser(userId, walletAddress, signature, ipAddress) {
    try {
      // Verify signature first
      const { ethers } = require("ethers");

      // Create a message for wallet linking
      const message = `Link wallet ${walletAddress} to your account.\n\nUser ID: ${userId}\nTimestamp: ${Date.now()}`;

      try {
        const recoveredAddress = ethers.verifyMessage(message, signature);
        if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
          throw new Error("Invalid signature for wallet linking");
        }
      } catch (verifyError) {
        console.error(
          "Wallet linking signature verification failed:",
          verifyError
        );
        throw new Error("Invalid signature");
      }

      // Link wallet to user
      const user = await this.user.linkWallet(userId, walletAddress);

      // Log activity with tenant context
      const activity = await UserActivityModel.create({
        userId,
        tenantId: user.tenant_id,
        action: "wallet_linked",
        details: {
          walletAddress,
          signature: signature.slice(0, 10) + "...", // Don't log full signature
          ipAddress
        },
        ipAddress
      });

      // Update cache with tenant isolation
      const profileKey = `tenant:${user.tenant_id}:user_profile:${userId}`;
      const sessionKey = `tenant:${user.tenant_id}:user_session:${userId}`;

      const profile = {
        id: user.id,
        email: user.email,
        name: user.name,
        walletAddress: user.wallet_address,
        tenantId: user.tenant_id
      };

      await this.databases.redis.setex(
        profileKey,
        1800,
        JSON.stringify(profile)
      );
      await this.databases.redis.setex(sessionKey, 3600, JSON.stringify(user));

      return user;
    } catch (error) {
      console.error("Wallet linking failed:", error);
      throw error;
    }
  }

  async getUserProfile(userId) {
    try {
      // Try cache first
      const profileKey = `user_profile:${userId}`;
      const cached = await this.databases.redis.get(profileKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // Get from database
      const user = await this.user.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      const profile = {
        id: user.id,
        email: user.email,
        name: user.name,
        walletAddress: user.wallet_address,
        isVerified: user.is_verified,
        twoFactorEnabled: user.two_factor_enabled,
        createdAt: user.created_at
      };

      // Cache for 30 minutes
      await this.databases.redis.setex(
        profileKey,
        1800,
        JSON.stringify(profile)
      );

      return profile;
    } catch (error) {
      console.error("Get user profile failed:", error);
      throw error;
    }
  }

  async getUserActivity(userId, limit = 20, offset = 0) {
    try {
      const activities = await UserActivityModel.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset);

      return activities;
    } catch (error) {
      console.error("Get user activity failed:", error);
      throw error;
    }
  }

  async getUserStats(userId) {
    try {
      const totalActivities = await UserActivityModel.countDocuments({
        userId
      });
      const loginCount = await UserActivityModel.countDocuments({
        userId,
        action: "user_login"
      });
      const walletLinked = await UserActivityModel.countDocuments({
        userId,
        action: "wallet_linked"
      });

      return {
        totalActivities,
        loginCount,
        walletLinked,
        lastActivity: await UserActivityModel.findOne({ userId })
          .sort({ createdAt: -1 })
          .select("action createdAt")
      };
    } catch (error) {
      console.error("Get user stats failed:", error);
      throw error;
    }
  }

  async logoutUser(userId, token, tenantId = null) {
    try {
      // Extract session ID from token
      const tokenParts = token.split(".");
      const payload = JSON.parse(
        Buffer.from(tokenParts[1], "base64").toString()
      );
      const sessionId = payload.sessionId;

      // Blacklist JWT token with tenant isolation
      const tokenKey = `tenant:${tenantId}:jwt:${userId}:${tokenParts[2]}`;
      await this.databases.redis.setex(
        tokenKey,
        86400,
        JSON.stringify({
          blacklisted: true,
          blacklistedAt: new Date().toISOString(),
          sessionId,
          tenantId
        })
      );

      // Clear session cache with tenant isolation
      const sessionKey = `tenant:${tenantId}:user_session:${userId}`;
      await this.databases.redis.del(sessionKey);

      // Remove from active sessions
      const activeSessionsKey = `tenant:${tenantId}:active_sessions`;
      await this.databases.redis.srem(activeSessionsKey, sessionId);

      // Log activity with tenant context
      const activity = await UserActivityModel.create({
        userId,
        tenantId,
        action: "user_logout",
        details: {
          method: "manual",
          sessionId,
          tenantId
        },
        sessionId
      });

      return { message: "Logged out successfully" };
    } catch (error) {
      console.error("Logout failed:", error);
      throw error;
    }
  }

  async verifyToken(token, tenantId = null) {
    try {
      const decoded = this.user.verifyToken(token);
      if (!decoded) {
        return null;
      }

      // Check if token is blacklisted with tenant isolation
      const tokenKey = `tenant:${decoded.tenantId}:jwt:${decoded.userId}:${
        token.split(".")[2]
      }`;
      const tokenData = await this.databases.redis.get(tokenKey);

      if (tokenData) {
        const parsedData = JSON.parse(tokenData);
        if (parsedData.blacklisted) {
          return null;
        }
      }

      // Validate tenant context if provided
      if (tenantId && decoded.tenantId !== tenantId) {
        return null;
      }

      // Update session last activity
      if (decoded.sessionId) {
        const sessionKey = `tenant:${decoded.tenantId}:user_session:${decoded.userId}`;
        const sessionData = await this.databases.redis.get(sessionKey);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          session.lastActivity = new Date().toISOString();
          await this.databases.redis.setex(
            sessionKey,
            3600,
            JSON.stringify(session)
          );
        }
      }

      return decoded;
    } catch (error) {
      return null;
    }
  }

  async updateUserProfile(userId, updates, ipAddress = null) {
    try {
      // Update in PostgreSQL
      const user = await this.user.updateProfile(userId, updates);

      // Log activity
      const activity = await UserActivityModel.create({
        userId,
        tenantId: user.tenant_id,
        action: "profile_updated",
        details: { updatedFields: Object.keys(updates) },
        ipAddress
      });

      // Update cache
      const profileKey = `user_profile:${userId}`;
      const sessionKey = `user_session:${userId}`;

      const profile = {
        id: user.id,
        email: user.email,
        name: user.name,
        walletAddress: user.wallet_address,
        isVerified: user.is_verified,
        createdAt: user.created_at
      };

      await this.databases.redis.setex(
        profileKey,
        1800,
        JSON.stringify(profile)
      );
      await this.databases.redis.setex(sessionKey, 3600, JSON.stringify(user));

      return user;
    } catch (error) {
      console.error("Profile update failed:", error);
      throw error;
    }
  }

  generateSessionId(userId, tenantId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `${tenantId}_${userId}_${timestamp}_${random}`;
  }

  async getUserSessions(userId, tenantId) {
    try {
      const activeSessionsKey = `tenant:${tenantId}:active_sessions`;
      const sessionIds = await this.databases.redis.smembers(activeSessionsKey);

      const sessions = [];
      for (const sessionId of sessionIds) {
        const sessionKey = `tenant:${tenantId}:user_session:${userId}`;
        const sessionData = await this.databases.redis.get(sessionKey);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          if (session.sessionId === sessionId) {
            sessions.push({
              sessionId,
              lastActivity: session.lastActivity,
              ipAddress: session.ipAddress,
              userAgent: session.userAgent
            });
          }
        }
      }

      return sessions;
    } catch (error) {
      console.error("Get user sessions failed:", error);
      throw error;
    }
  }

  async revokeSession(userId, sessionId, tenantId) {
    try {
      // Remove from active sessions
      const activeSessionsKey = `tenant:${tenantId}:active_sessions`;
      await this.databases.redis.srem(activeSessionsKey, sessionId);

      // Clear session cache
      const sessionKey = `tenant:${tenantId}:user_session:${userId}`;
      await this.databases.redis.del(sessionKey);

      // Log activity
      const activity = await UserActivityModel.create({
        userId,
        tenantId,
        action: "session_revoked",
        details: { sessionId, tenantId },
        sessionId
      });

      return { message: "Session revoked successfully" };
    } catch (error) {
      console.error("Revoke session failed:", error);
      throw error;
    }
  }

  async generateWalletChallenge(walletAddress, tenantId = null) {
    try {
      // Generate a unique nonce for this wallet
      const nonce = crypto.randomBytes(32).toString("hex");
      const timestamp = Date.now();
      const expiresAt = new Date(timestamp + 5 * 60 * 1000); // 5 minutes

      // Create challenge message
      const message = `Sign this message to authenticate with our service.\n\nWallet: ${walletAddress}\nNonce: ${nonce}\nTimestamp: ${timestamp}\nExpires: ${expiresAt.toISOString()}`;

      // Store challenge in Redis with expiration
      const challengeKey = `wallet_challenge:${walletAddress}:${
        tenantId || "default"
      }`;
      const challengeData = {
        nonce,
        timestamp,
        expiresAt: expiresAt.toISOString(),
        message,
        walletAddress,
        tenantId
      };

      await this.databases.redis.setex(
        challengeKey,
        300,
        JSON.stringify(challengeData)
      ); // 5 minutes

      // Log challenge generation
      const activity = await UserActivityModel.create({
        userId: 0, // System user for unauthenticated actions
        tenantId: tenantId || 1, // Default tenant if not provided
        action: "wallet_challenge_generated",
        details: {
          walletAddress,
          nonce,
          expiresAt: expiresAt.toISOString()
        }
      });

      return {
        message,
        nonce,
        expiresAt: expiresAt.toISOString()
      };
    } catch (error) {
      console.error("Generate wallet challenge failed:", error);
      throw error;
    }
  }

  async verifyWalletSignature(walletAddress, signature, tenantId = null) {
    try {
      // Get stored challenge
      const challengeKey = `wallet_challenge:${walletAddress}:${
        tenantId || "default"
      }`;
      const challengeData = await this.databases.redis.get(challengeKey);

      if (!challengeData) {
        throw new Error("Challenge not found or expired");
      }

      const challenge = JSON.parse(challengeData);
      const now = new Date();

      // Check if challenge has expired
      if (new Date(challenge.expiresAt) < now) {
        await this.databases.redis.del(challengeKey);
        throw new Error("Challenge has expired");
      }

      // Verify signature using ethers.js
      const { ethers } = require("ethers");

      try {
        // Recover the address from the signature
        const recoveredAddress = ethers.verifyMessage(
          challenge.message,
          signature
        );

        // Check if recovered address matches the wallet address
        if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
          throw new Error("Invalid signature");
        }
      } catch (verifyError) {
        console.error("Signature verification failed:", verifyError);
        throw new Error("Invalid signature");
      }

      // Clear the challenge
      await this.databases.redis.del(challengeKey);

      // Find or create user
      let user = await this.user.findByWallet(walletAddress, tenantId);

      if (!user) {
        // Create new user with wallet - but mark as incomplete
        user = await this.user.create({
          email: null, // Wallet-only user
          password: null,
          name: `Wallet User ${walletAddress.slice(0, 8)}...`,
          walletAddress,
          tenantId
        });

        // Log new wallet user creation
        const activity = await UserActivityModel.create({
          userId: user.id,
          tenantId: user.tenant_id,
          action: "wallet_user_created",
          details: {
            walletAddress,
            method: "signature_verification",
            profileComplete: false
          }
        });

        // Return special response for new users
        return {
          user,
          token: null, // No token until profile is complete
          sessionId: null,
          isNewUser: true,
          requiresProfileCompletion: true
        };
      }

      // Existing user - proceed with normal login
      // Generate session and token
      const sessionId = this.generateSessionId(user.id, user.tenant_id);
      const token = this.user.generateToken(user.id, user.tenant_id, sessionId);

      // Log successful authentication
      const activity = await UserActivityModel.create({
        userId: user.id,
        tenantId: user.tenant_id,
        action: "wallet_authenticated",
        details: {
          walletAddress,
          method: "signature_verification",
          sessionId
        }
      });

      // Cache session with tenant isolation
      const sessionKey = `tenant:${user.tenant_id}:user_session:${user.id}`;
      const sessionData = {
        ...user,
        sessionId,
        lastActivity: new Date().toISOString(),
        tenantId: user.tenant_id
      };
      await this.databases.redis.setex(
        sessionKey,
        3600,
        JSON.stringify(sessionData)
      );

      // Store JWT with tenant isolation
      const tokenKey = `tenant:${user.tenant_id}:jwt:${user.id}:${
        token.split(".")[2]
      }`;
      await this.databases.redis.setex(
        tokenKey,
        86400,
        JSON.stringify({
          sessionId,
          issuedAt: new Date().toISOString(),
          tenantId: user.tenant_id
        })
      );

      // Track active sessions
      const activeSessionsKey = `tenant:${user.tenant_id}:active_sessions`;
      await this.databases.redis.sadd(activeSessionsKey, sessionId);
      await this.databases.redis.expire(activeSessionsKey, 86400);

      return { user, token, sessionId, isNewUser: false };
    } catch (error) {
      console.error("Verify wallet signature failed:", error);
      throw error;
    }
  }

  async completeWalletUserProfile(userId, profileData, tenantId = null) {
    try {
      // Validate required fields
      if (!profileData.name || profileData.name.trim().length < 2) {
        throw new Error("Name is required and must be at least 2 characters");
      }

      // Update user profile
      const updates = {
        name: profileData.name.trim(),
        email: profileData.email ? profileData.email.trim() : null,
        is_verified: true // Wallet users are considered verified
      };

      // Update in database
      const result = await this.pool.query(
        `
        UPDATE users 
        SET name = $1, 
            email = $2, 
            is_verified = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4 AND tenant_id = $5
        RETURNING id, email, name, wallet_address, is_verified, tenant_id
      `,
        [updates.name, updates.email, updates.is_verified, userId, tenantId]
      );

      if (result.rows.length === 0) {
        throw new Error("User not found");
      }

      const user = result.rows[0];

      // Generate session and token now that profile is complete
      const sessionId = this.generateSessionId(user.id, user.tenant_id);
      const token = this.user.generateToken(user.id, user.tenant_id, sessionId);

      // Log profile completion
      const activity = await UserActivityModel.create({
        userId: user.id,
        tenantId: user.tenant_id,
        action: "wallet_profile_completed",
        details: {
          walletAddress: user.wallet_address,
          profileData: {
            name: user.name,
            email: user.email
          }
        }
      });

      // Cache session with tenant isolation
      const sessionKey = `tenant:${user.tenant_id}:user_session:${user.id}`;
      const sessionData = {
        ...user,
        sessionId,
        lastActivity: new Date().toISOString(),
        tenantId: user.tenant_id
      };
      await this.databases.redis.setex(
        sessionKey,
        3600,
        JSON.stringify(sessionData)
      );

      // Store JWT with tenant isolation
      const tokenKey = `tenant:${user.tenant_id}:jwt:${user.id}:${
        token.split(".")[2]
      }`;
      await this.databases.redis.setex(
        tokenKey,
        86400,
        JSON.stringify({
          sessionId,
          issuedAt: new Date().toISOString(),
          tenantId: user.tenant_id
        })
      );

      // Track active sessions
      const activeSessionsKey = `tenant:${user.tenant_id}:active_sessions`;
      await this.databases.redis.sadd(activeSessionsKey, sessionId);
      await this.databases.redis.expire(activeSessionsKey, 86400);

      return { user, token, sessionId };
    } catch (error) {
      console.error("Complete wallet user profile failed:", error);
      throw error;
    }
  }

  async authenticateWithWallet(walletAddress, tenantId = null) {
    try {
      // Check if user exists
      const user = await this.user.findByWallet(walletAddress, tenantId);

      if (!user) {
        // Generate challenge for new user
        return await this.generateWalletChallenge(walletAddress, tenantId);
      }

      // Generate challenge for existing user
      return await this.generateWalletChallenge(walletAddress, tenantId);
    } catch (error) {
      console.error("Wallet authentication failed:", error);
      throw error;
    }
  }
}

module.exports = UserService;
