const mongoose = require("mongoose");

const userActivitySchema = new mongoose.Schema({
  userId: {
    type: Number,
    required: true,
    index: true
  },
  tenantId: {
    type: Number,
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  sessionId: {
    type: String,
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Compound indexes for efficient querying with tenant isolation
userActivitySchema.index({ tenantId: 1, userId: 1, timestamp: -1 });
userActivitySchema.index({ tenantId: 1, action: 1, timestamp: -1 });
userActivitySchema.index({ tenantId: 1, sessionId: 1, timestamp: -1 });
userActivitySchema.index({ userId: 1, timestamp: -1 });
userActivitySchema.index({ action: 1, timestamp: -1 });
userActivitySchema.index({ sessionId: 1, timestamp: -1 });

// Static methods for analytics with tenant isolation
userActivitySchema.statics = {
  getUserActivity: function (userId, tenantId, limit = 50, offset = 0) {
    return this.find({ userId, tenantId })
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .lean();
  },

  getTenantActivity: function (tenantId, limit = 100, offset = 0) {
    return this.find({ tenantId })
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .lean();
  },

  getActivityStats: function (userId, tenantId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.aggregate([
      {
        $match: {
          userId,
          tenantId,
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: "$action",
          count: { $sum: 1 },
          lastActivity: { $max: "$timestamp" }
        }
      },
      { $sort: { count: -1 } }
    ]);
  },

  getTenantStats: function (tenantId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.aggregate([
      {
        $match: {
          tenantId,
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: "$action",
          count: { $sum: 1 },
          uniqueUsers: { $addToSet: "$userId" }
        }
      },
      {
        $project: {
          action: "$_id",
          count: 1,
          uniqueUsers: { $size: "$uniqueUsers" }
        }
      },
      { $sort: { count: -1 } }
    ]);
  },

  getDailyActivity: function (userId, tenantId, days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.aggregate([
      {
        $match: {
          userId,
          tenantId,
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$timestamp" }
          },
          count: { $sum: 1 },
          actions: { $addToSet: "$action" }
        }
      },
      { $sort: { _id: 1 } }
    ]);
  },

  getTenantDailyActivity: function (tenantId, days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.aggregate([
      {
        $match: {
          tenantId,
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$timestamp" }
          },
          count: { $sum: 1 },
          uniqueUsers: { $addToSet: "$userId" },
          actions: { $addToSet: "$action" }
        }
      },
      {
        $project: {
          date: "$_id",
          count: 1,
          uniqueUsers: { $size: "$uniqueUsers" },
          actions: 1
        }
      },
      { $sort: { date: 1 } }
    ]);
  },

  getPopularActions: function (tenantId = null, limit = 10) {
    const match = tenantId ? { tenantId } : {};

    return this.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$action",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: limit }
    ]);
  },

  getSessionActivity: function (sessionId, tenantId = null) {
    const match = { sessionId };
    if (tenantId) match.tenantId = tenantId;

    return this.find(match).sort({ timestamp: 1 }).lean();
  },

  getActiveSessions: function (tenantId, hours = 24) {
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);

    return this.aggregate([
      {
        $match: {
          tenantId,
          sessionId: { $exists: true, $ne: null },
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: "$sessionId",
          userId: { $first: "$userId" },
          lastActivity: { $max: "$timestamp" },
          actionCount: { $sum: 1 },
          actions: { $addToSet: "$action" }
        }
      },
      { $sort: { lastActivity: -1 } }
    ]);
  },

  getSecurityEvents: function (tenantId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const securityActions = [
      "user_login",
      "user_logout",
      "failed_login",
      "password_reset",
      "2fa_enabled",
      "2fa_disabled",
      "session_revoked",
      "security_alert_sent"
    ];

    return this.find({
      tenantId,
      action: { $in: securityActions },
      timestamp: { $gte: startDate }
    })
      .sort({ timestamp: -1 })
      .lean();
  }
};

// Pre-save middleware to add metadata
userActivitySchema.pre("save", function (next) {
  if (!this.metadata) {
    this.metadata = {};
  }

  // Add tenant context to metadata if not present
  if (!this.metadata.tenantId) {
    this.metadata.tenantId = this.tenantId;
  }

  next();
});

// Create the mongoose model
const UserActivityModel = mongoose.model("UserActivity", userActivitySchema);

// Class wrapper for the model (for tests)
class UserActivity {
  constructor(connection) {
    this.connection = connection;
    this.model = UserActivityModel;
  }

  async create(activityData) {
    return await this.model.create(activityData);
  }

  async findByUser(userId, tenantId, limit = 50, offset = 0) {
    return await this.model
      .find({ userId, tenantId })
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .exec();
  }

  async findByTenant(tenantId, limit = 100, offset = 0) {
    return await this.model
      .find({ tenantId })
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .exec();
  }

  async findByAction(action, tenantId = null) {
    const query = { action };
    if (tenantId) query.tenantId = tenantId;

    return await this.model.find(query).sort({ timestamp: -1 }).exec();
  }

  async getActivityStats(userId, tenantId) {
    return await this.model
      .aggregate([
        { $match: { userId, tenantId } },
        { $group: { _id: "$action", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
      .exec();
  }

  async getTenantStats(tenantId) {
    return await this.model
      .aggregate([
        { $match: { tenantId } },
        { $group: { _id: "$action", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
      .exec();
  }

  async getRecentActivity(tenantId = null, limit = 50) {
    const query = {};
    if (tenantId) query.tenantId = tenantId;

    return await this.model
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }

  async cleanupOldActivities(daysOld = 90, tenantId = null) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const query = { timestamp: { $lt: cutoffDate } };
    if (tenantId) query.tenantId = tenantId;

    return await this.model.deleteMany(query);
  }

  async getUserSessionData(userId, tenantId) {
    return await this.model
      .find({
        userId,
        tenantId,
        sessionId: { $exists: true, $ne: null }
      })
      .sort({ timestamp: 1 })
      .exec();
  }

  async save() {
    // This method should create a new instance, not call save on the model
    return await this.model.create(this);
  }
}

// Export both the class and the model
module.exports = UserActivity;
module.exports.Model = UserActivityModel;
