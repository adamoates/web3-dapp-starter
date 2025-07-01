const BlockchainEvent = require("../models/nosql/BlockchainEvent");
const NFTMetadata = require("../models/nosql/NFTMetadata");
const Transaction = require("../models/sql/Transaction");
const UserActivity = require("../models/nosql/UserActivity");

class Web3Service {
  constructor(databases) {
    this.transaction = new Transaction(databases.postgresPool);
    this.databases = databases;
  }

  async recordTransaction(txData) {
    try {
      // Store transaction in PostgreSQL
      const transaction = await this.transaction.create(txData);

      // Log activity in MongoDB
      const activity = new UserActivity({
        userId: txData.userId,
        action: "transaction_created",
        details: {
          txHash: txData.txHash,
          type: txData.type,
          amount: txData.amount,
          status: txData.status
        }
      });
      await activity.save();

      // Cache transaction status in Redis
      const txKey = `tx_status:${txData.txHash}`;
      await this.databases.redisClient.setex(
        txKey,
        3600,
        JSON.stringify({
          status: txData.status,
          userId: txData.userId,
          type: txData.type
        })
      );

      return transaction;
    } catch (error) {
      console.error("Transaction recording failed:", error);
      throw error;
    }
  }

  async updateTransactionStatus(txHash, status, blockNumber = null) {
    try {
      // Update in PostgreSQL
      const transaction = await this.transaction.updateStatus(
        txHash,
        status,
        blockNumber
      );

      // Update cache
      const txKey = `tx_status:${txHash}`;
      await this.databases.redisClient.setex(
        txKey,
        3600,
        JSON.stringify({
          status,
          userId: transaction.user_id,
          type: transaction.type,
          blockNumber
        })
      );

      // Log status update activity
      const activity = new UserActivity({
        userId: transaction.user_id,
        action: "transaction_status_updated",
        details: {
          txHash,
          oldStatus: transaction.status,
          newStatus: status,
          blockNumber
        }
      });
      await activity.save();

      return transaction;
    } catch (error) {
      console.error("Transaction status update failed:", error);
      throw error;
    }
  }

  async recordBlockchainEvent(eventData) {
    try {
      // Store blockchain event in MongoDB
      const event = new BlockchainEvent(eventData);
      await event.save();

      // Cache recent events in Redis
      const eventKey = `recent_events:${eventData.contractAddress}`;
      const recentEvents = await this.databases.redisClient.lrange(
        eventKey,
        0,
        9
      );

      const eventSummary = {
        eventName: eventData.eventName,
        blockNumber: eventData.blockNumber,
        txHash: eventData.transactionHash,
        timestamp: new Date().toISOString()
      };

      await this.databases.redisClient.lpush(
        eventKey,
        JSON.stringify(eventSummary)
      );
      await this.databases.redisClient.ltrim(eventKey, 0, 9);
      await this.databases.redisClient.expire(eventKey, 3600);

      return event;
    } catch (error) {
      console.error("Blockchain event recording failed:", error);
      throw error;
    }
  }

  async storeNFTMetadata(nftData) {
    try {
      // Store NFT metadata in MongoDB
      const nft = new NFTMetadata(nftData);
      await nft.save();

      // Cache NFT data in Redis
      const nftKey = `nft:${nftData.contractAddress}:${nftData.tokenId}`;
      await this.databases.redisClient.setex(
        nftKey,
        1800,
        JSON.stringify({
          name: nftData.name,
          image: nftData.image,
          owner: nftData.owner,
          isListed: nftData.isListed
        })
      );

      // Log NFT activity
      if (nftData.owner) {
        const activity = new UserActivity({
          userId: nftData.owner,
          action: "nft_metadata_stored",
          details: {
            contractAddress: nftData.contractAddress,
            tokenId: nftData.tokenId,
            name: nftData.name
          }
        });
        await activity.save();
      }

      return nft;
    } catch (error) {
      console.error("NFT metadata storage failed:", error);
      throw error;
    }
  }

  async getTransactionStatus(txHash) {
    try {
      // Try cache first
      const txKey = `tx_status:${txHash}`;
      const cachedStatus = await this.databases.redisClient.get(txKey);

      if (cachedStatus) {
        return JSON.parse(cachedStatus);
      }

      // Get from PostgreSQL
      const transaction = await this.transaction.findByHash(txHash);
      if (!transaction) {
        return null;
      }

      const status = {
        status: transaction.status,
        userId: transaction.user_id,
        type: transaction.type,
        blockNumber: transaction.block_number
      };

      // Cache the result
      await this.databases.redisClient.setex(
        txKey,
        3600,
        JSON.stringify(status)
      );
      return status;
    } catch (error) {
      console.error("Get transaction status failed:", error);
      throw error;
    }
  }

  async getUserTransactions(userId, limit = 50, offset = 0) {
    try {
      return await this.transaction.findByUser(userId, limit, offset);
    } catch (error) {
      console.error("Get user transactions failed:", error);
      throw error;
    }
  }

  async getContractEvents(contractAddress, eventName = null, limit = 50) {
    try {
      if (eventName) {
        return await BlockchainEvent.findByContractAndEvent(
          contractAddress,
          eventName,
          limit
        );
      } else {
        return await BlockchainEvent.find({ contractAddress })
          .sort({ blockNumber: -1 })
          .limit(limit)
          .lean();
      }
    } catch (error) {
      console.error("Get contract events failed:", error);
      throw error;
    }
  }

  async getNFTsByOwner(ownerId, limit = 50, offset = 0) {
    try {
      return await NFTMetadata.findByOwner(ownerId, limit, offset);
    } catch (error) {
      console.error("Get NFTs by owner failed:", error);
      throw error;
    }
  }

  async getListedNFTs(limit = 50, offset = 0) {
    try {
      return await NFTMetadata.findListedNFTs(limit, offset);
    } catch (error) {
      console.error("Get listed NFTs failed:", error);
      throw error;
    }
  }

  async updateNFTOwner(contractAddress, tokenId, newOwner) {
    try {
      const nft = await NFTMetadata.findOne({ contractAddress, tokenId });
      if (!nft) {
        throw new Error("NFT not found");
      }

      const oldOwner = nft.owner;
      await nft.updateOwner(newOwner);

      // Update cache
      const nftKey = `nft:${contractAddress}:${tokenId}`;
      await this.databases.redisClient.setex(
        nftKey,
        1800,
        JSON.stringify({
          name: nft.name,
          image: nft.image,
          owner: newOwner,
          isListed: nft.isListed
        })
      );

      // Log ownership transfer
      if (oldOwner && newOwner) {
        const activity = new UserActivity({
          userId: newOwner,
          action: "nft_ownership_transferred",
          details: {
            contractAddress,
            tokenId,
            fromOwner: oldOwner,
            toOwner: newOwner
          }
        });
        await activity.save();
      }

      return nft;
    } catch (error) {
      console.error("Update NFT owner failed:", error);
      throw error;
    }
  }

  async getContractStats(contractAddress) {
    try {
      // Get event stats from MongoDB
      const eventStats = await BlockchainEvent.getEventStats(contractAddress);

      // Get NFT collection stats
      const nftStats = await NFTMetadata.getCollectionStats(contractAddress);

      return {
        events: eventStats,
        nfts: nftStats[0] || { totalSupply: 0, uniqueOwners: 0, listedCount: 0 }
      };
    } catch (error) {
      console.error("Get contract stats failed:", error);
      throw error;
    }
  }

  async processPendingTransactions() {
    try {
      const pendingTxs = await this.transaction.getPendingTransactions();

      // Process each pending transaction
      for (const tx of pendingTxs) {
        // Here you would implement blockchain status checking
        // For now, we'll just log them
        console.log(`Processing pending transaction: ${tx.tx_hash}`);
      }

      return pendingTxs.length;
    } catch (error) {
      console.error("Process pending transactions failed:", error);
      throw error;
    }
  }
}

module.exports = Web3Service;
