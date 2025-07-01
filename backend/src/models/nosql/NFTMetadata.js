const mongoose = require("mongoose");

const nftMetadataSchema = new mongoose.Schema({
  tokenId: {
    type: String,
    required: true
  },
  contractAddress: {
    type: String,
    required: true
  },
  name: {
    type: String
  },
  description: {
    type: String
  },
  image: {
    type: String
  },
  externalUrl: {
    type: String
  },
  attributes: [
    {
      trait_type: String,
      value: mongoose.Schema.Types.Mixed
    }
  ],
  owner: {
    type: Number,
    index: true
  }, // Reference to PostgreSQL user
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  network: {
    type: String,
    default: "ethereum",
    index: true
  },
  tokenStandard: {
    type: String,
    enum: ["ERC-721", "ERC-1155"],
    default: "ERC-721"
  },
  isListed: {
    type: Boolean,
    default: false,
    index: true
  },
  listingPrice: {
    type: String
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound indexes for efficient querying
nftMetadataSchema.index({ contractAddress: 1, tokenId: 1 }, { unique: true });
nftMetadataSchema.index({ owner: 1 });
nftMetadataSchema.index({ network: 1, contractAddress: 1 });
nftMetadataSchema.index({ isListed: 1, createdAt: -1 });

// Instance methods
nftMetadataSchema.methods.updateOwner = function (newOwner) {
  this.owner = newOwner;
  this.lastUpdated = new Date();
  return this.save();
};

nftMetadataSchema.methods.listForSale = function (price) {
  this.isListed = true;
  this.listingPrice = price;
  this.lastUpdated = new Date();
  return this.save();
};

nftMetadataSchema.methods.removeFromSale = function () {
  this.isListed = false;
  this.listingPrice = null;
  this.lastUpdated = new Date();
  return this.save();
};

// Static methods
nftMetadataSchema.statics.findByOwner = function (
  ownerId,
  limit = 50,
  offset = 0
) {
  return this.find({ owner: ownerId })
    .sort({ lastUpdated: -1 })
    .skip(offset)
    .limit(limit);
};

nftMetadataSchema.statics.findListedNFTs = function (limit = 50, offset = 0) {
  return this.find({ isListed: true })
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit);
};

nftMetadataSchema.statics.findByContract = function (
  contractAddress,
  limit = 50,
  offset = 0
) {
  return this.find({ contractAddress })
    .sort({ tokenId: 1 })
    .skip(offset)
    .limit(limit);
};

nftMetadataSchema.statics.getCollectionStats = function (contractAddress) {
  return this.aggregate([
    { $match: { contractAddress } },
    {
      $group: {
        _id: null,
        totalSupply: { $sum: 1 },
        uniqueOwners: { $addToSet: "$owner" },
        listedCount: {
          $sum: { $cond: ["$isListed", 1, 0] }
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalSupply: 1,
        uniqueOwners: { $size: "$uniqueOwners" },
        listedCount: 1
      }
    }
  ]);
};

module.exports = mongoose.model("NFTMetadata", nftMetadataSchema);
