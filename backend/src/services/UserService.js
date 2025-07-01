const User = require("../models/sql/User");
const UserActivity = require("../models/nosql/UserActivity");
const Transaction = require("../models/sql/Transaction");

class UserService {
  constructor(databases) {
    this.user = new User(databases.postgresPool);
    this.transaction = new Transaction(databases.postgresPool);
    this.databases = databases;
  }

  async registerUser(userData, ipAddress = null, userAgent = null) {
    try {
      // Create user in PostgreSQL
      const user = await this.user.create(userData);

      // Log activity in MongoDB
      const activity = new UserActivity({
        userId: user.id,
        action: "user_registered",
        details: {
          email: user.email,
          name: user.name,
          hasWallet: !!userData.walletAddress
        },
        ipAddress,
        userAgent
      });
      await activity.save();

      // Cache user session in Redis
      const sessionKey = `user_session:${user.id}`;
      await this.databases.redisClient.setex(
        sessionKey,
        3600,
        JSON.stringify(user)
      );

      // Cache user profile for quick access
      const profileKey = `user_profile:${user.id}`;
      await this.databases.redisClient.setex(
        profileKey,
        1800,
        JSON.stringify({
          id: user.id,
          email: user.email,
          name: user.name,
          walletAddress: user.wallet_address
        })
      );

      return user;
    } catch (error) {
      console.error("User registration failed:", error);
      throw error;
    }
  }

  async loginUser(email, password, ipAddress = null, userAgent = null) {
    try {
      // Find user in PostgreSQL
      const user = await this.user.findByEmail(email);
      if (!user) {
        throw new Error("User not found");
      }

      // Validate password
      const isValid = await this.user.validatePassword(
        password,
        user.password_hash
      );
      if (!isValid) {
        throw new Error("Invalid password");
      }

      // Generate JWT token
      const token = this.user.generateToken(user.id);

      // Log activity in MongoDB
      const activity = new UserActivity({
        userId: user.id,
        action: "user_login",
        details: { method: "email" },
        ipAddress,
        userAgent
      });
      await activity.save();

      // Cache session in Redis
      const sessionKey = `user_session:${user.id}`;
      await this.databases.redisClient.setex(
        sessionKey,
        3600,
        JSON.stringify(user)
      );

      // Store JWT in Redis for blacklisting capability
      const tokenKey = `jwt:${user.id}:${token.split(".")[2]}`;
      await this.databases.redisClient.setex(tokenKey, 86400, "valid");

      return { user, token };
    } catch (error) {
      console.error("User login failed:", error);
      throw error;
    }
  }

  async linkWalletToUser(userId, walletAddress, signature, ipAddress = null) {
    try {
      // Verify signature first (implement signature verification)
      // const isValidSignature = await this.verifySignature(walletAddress, signature);
      // if (!isValidSignature) {
      //   throw new Error('Invalid signature');
      // }

      // Update user in PostgreSQL
      const user = await this.user.linkWallet(userId, walletAddress);

      // Log wallet linking in MongoDB
      const activity = new UserActivity({
        userId,
        action: "wallet_linked",
        details: { walletAddress },
        ipAddress
      });
      await activity.save();

      // Update cached session and profile
      const sessionKey = `user_session:${userId}`;
      const profileKey = `user_profile:${userId}`;

      await this.databases.redisClient.setex(
        sessionKey,
        3600,
        JSON.stringify(user)
      );
      await this.databases.redisClient.setex(
        profileKey,
        1800,
        JSON.stringify({
          id: user.id,
          email: user.email,
          name: user.name,
          walletAddress: user.wallet_address
        })
      );

      return user;
    } catch (error) {
      console.error("Wallet linking failed:", error);
      throw error;
    }
  }

  async getUserProfile(userId) {
    try {
      // Try to get from Redis cache first
      const profileKey = `user_profile:${userId}`;
      const cachedProfile = await this.databases.redisClient.get(profileKey);

      if (cachedProfile) {
        return JSON.parse(cachedProfile);
      }

      // Get from PostgreSQL if not cached
      const user = await this.user.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      // Cache the profile
      const profile = {
        id: user.id,
        email: user.email,
        name: user.name,
        walletAddress: user.wallet_address,
        isVerified: user.is_verified,
        createdAt: user.created_at
      };

      await this.databases.redisClient.setex(
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

  async getUserActivity(userId, limit = 50, offset = 0) {
    try {
      return await UserActivity.getUserActivity(userId, limit, offset);
    } catch (error) {
      console.error("Get user activity failed:", error);
      throw error;
    }
  }

  async getUserStats(userId) {
    try {
      // Get transaction stats from PostgreSQL
      const transactionStats = await this.transaction.getTransactionStats(
        userId
      );

      // Get activity stats from MongoDB
      const activityStats = await UserActivity.getActivityStats(userId, 30);

      return {
        transactions: transactionStats,
        activity: activityStats
      };
    } catch (error) {
      console.error("Get user stats failed:", error);
      throw error;
    }
  }

  async logoutUser(userId, token) {
    try {
      // Blacklist JWT token in Redis
      const tokenKey = `jwt:${userId}:${token.split(".")[2]}`;
      await this.databases.redisClient.setex(tokenKey, 86400, "blacklisted");

      // Remove session from Redis
      const sessionKey = `user_session:${userId}`;
      await this.databases.redisClient.del(sessionKey);

      // Log logout activity
      const activity = new UserActivity({
        userId,
        action: "user_logout",
        details: { method: "manual" }
      });
      await activity.save();

      return { success: true };
    } catch (error) {
      console.error("User logout failed:", error);
      throw error;
    }
  }

  async verifyToken(token) {
    try {
      // Check if token is blacklisted in Redis
      const decoded = this.user.verifyToken(token);
      if (!decoded) {
        return null;
      }

      const tokenKey = `jwt:${decoded.userId}:${token.split(".")[2]}`;
      const tokenStatus = await this.databases.redisClient.get(tokenKey);

      if (tokenStatus === "blacklisted") {
        return null;
      }

      return decoded;
    } catch (error) {
      console.error("Token verification failed:", error);
      return null;
    }
  }

  async updateUserProfile(userId, updates, ipAddress = null) {
    try {
      // Update in PostgreSQL
      const user = await this.user.updateProfile(userId, updates);

      // Log activity
      const activity = new UserActivity({
        userId,
        action: "profile_updated",
        details: { updatedFields: Object.keys(updates) },
        ipAddress
      });
      await activity.save();

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

      await this.databases.redisClient.setex(
        profileKey,
        1800,
        JSON.stringify(profile)
      );
      await this.databases.redisClient.setex(
        sessionKey,
        3600,
        JSON.stringify(user)
      );

      return user;
    } catch (error) {
      console.error("Profile update failed:", error);
      throw error;
    }
  }
}

module.exports = UserService;
