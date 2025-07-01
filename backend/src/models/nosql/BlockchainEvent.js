const mongoose = require("mongoose");

const blockchainEventSchema = new mongoose.Schema({
  contractAddress: {
    type: String,
    required: true,
    index: true
  },
  eventName: {
    type: String,
    required: true
  },
  blockNumber: {
    type: Number,
    required: true,
    index: true
  },
  transactionHash: {
    type: String,
    required: true,
    unique: true
  },
  eventData: {
    type: mongoose.Schema.Types.Mixed
  },
  userId: {
    type: Number,
    index: true
  }, // Reference to PostgreSQL user
  processed: {
    type: Boolean,
    default: false
  },
  network: {
    type: String,
    default: "ethereum",
    index: true
  },
  gasUsed: {
    type: Number
  },
  gasPrice: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound indexes for efficient querying
blockchainEventSchema.index({ contractAddress: 1, blockNumber: -1 });
blockchainEventSchema.index({ userId: 1, createdAt: -1 });
blockchainEventSchema.index({ network: 1, blockNumber: -1 });
blockchainEventSchema.index({ processed: 1, createdAt: -1 });

// Instance methods
blockchainEventSchema.methods.markAsProcessed = function () {
  this.processed = true;
  return this.save();
};

// Static methods
blockchainEventSchema.statics.findUnprocessedEvents = function (limit = 100) {
  return this.find({ processed: false }).sort({ blockNumber: 1 }).limit(limit);
};

blockchainEventSchema.statics.findByContractAndEvent = function (
  contractAddress,
  eventName,
  limit = 50
) {
  return this.find({
    contractAddress,
    eventName
  })
    .sort({ blockNumber: -1 })
    .limit(limit);
};

blockchainEventSchema.statics.getEventStats = function (contractAddress) {
  return this.aggregate([
    { $match: { contractAddress } },
    {
      $group: {
        _id: "$eventName",
        count: { $sum: 1 },
        lastEvent: { $max: "$createdAt" },
        firstEvent: { $min: "$createdAt" }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

module.exports = mongoose.model("BlockchainEvent", blockchainEventSchema);
