const mongoose = require("mongoose");

const userActivitySchema = new mongoose.Schema({
  userId: {
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

// Compound indexes for efficient querying
userActivitySchema.index({ userId: 1, timestamp: -1 });
userActivitySchema.index({ action: 1, timestamp: -1 });
userActivitySchema.index({ sessionId: 1, timestamp: -1 });

// Static methods for analytics
userActivitySchema.statics.getUserActivity = function (
  userId,
  limit = 50,
  offset = 0
) {
  return this.find({ userId })
    .sort({ timestamp: -1 })
    .skip(offset)
    .limit(limit)
    .lean();
};

userActivitySchema.statics.getActivityStats = function (userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.aggregate([
    {
      $match: {
        userId,
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
};

userActivitySchema.statics.getDailyActivity = function (userId, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.aggregate([
    {
      $match: {
        userId,
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
};

userActivitySchema.statics.getPopularActions = function (limit = 10) {
  return this.aggregate([
    {
      $group: {
        _id: "$action",
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);
};

userActivitySchema.statics.getSessionActivity = function (sessionId) {
  return this.find({ sessionId }).sort({ timestamp: 1 }).lean();
};

// Pre-save middleware to add metadata
userActivitySchema.pre("save", function (next) {
  if (!this.metadata) {
    this.metadata = {};
  }
  next();
});

module.exports = mongoose.model("UserActivity", userActivitySchema);
