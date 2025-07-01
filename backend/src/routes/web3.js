const express = require("express");
const { body, validationResult } = require("express-validator");
const Web3Service = require("../services/Web3Service");

function createWeb3Router(dbManager) {
  const router = express.Router();
  const web3Service = new Web3Service(dbManager);

  // Middleware to authenticate JWT token
  const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }

    try {
      // Simple token verification - in production, use a proper JWT service
      const jwt = require("jsonwebtoken");
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "your-secret-key"
      );
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
  };

  // Record a new transaction
  router.post(
    "/transactions",
    [
      authenticateToken,
      body("txHash").isLength({ min: 66, max: 66 }),
      body("type").isIn([
        "transfer",
        "mint",
        "burn",
        "swap",
        "stake",
        "unstake"
      ]),
      body("amount").isFloat({ min: 0 }),
      body("status").optional().isIn(["pending", "confirmed", "failed"]),
      body("blockNumber").optional().isInt({ min: 0 }),
      body("gasUsed").optional().isInt({ min: 0 }),
      body("gasPrice").optional().isString()
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

        const txData = {
          userId: req.user.userId,
          txHash: req.body.txHash,
          type: req.body.type,
          amount: req.body.amount,
          status: req.body.status || "pending",
          blockNumber: req.body.blockNumber,
          gasUsed: req.body.gasUsed,
          gasPrice: req.body.gasPrice
        };

        const transaction = await web3Service.recordTransaction(txData);

        res.status(201).json({
          message: "Transaction recorded successfully",
          transaction: {
            id: transaction.id,
            txHash: transaction.tx_hash,
            type: transaction.type,
            amount: transaction.amount,
            status: transaction.status,
            blockNumber: transaction.block_number,
            createdAt: transaction.created_at
          }
        });
      } catch (error) {
        console.error("Transaction recording error:", error);

        if (error.code === "23505") {
          // PostgreSQL unique constraint violation
          return res.status(409).json({
            error: "Transaction already exists"
          });
        }

        res.status(500).json({
          error: "Failed to record transaction",
          message: error.message
        });
      }
    }
  );

  // Update transaction status
  router.put(
    "/transactions/:txHash/status",
    [
      authenticateToken,
      body("status").isIn(["pending", "confirmed", "failed"]),
      body("blockNumber").optional().isInt({ min: 0 })
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

        const { txHash } = req.params;
        const { status, blockNumber } = req.body;

        const transaction = await web3Service.updateTransactionStatus(
          txHash,
          status,
          blockNumber
        );

        res.json({
          message: "Transaction status updated successfully",
          transaction: {
            id: transaction.id,
            txHash: transaction.tx_hash,
            type: transaction.type,
            amount: transaction.amount,
            status: transaction.status,
            blockNumber: transaction.block_number,
            updatedAt: transaction.updated_at
          }
        });
      } catch (error) {
        console.error("Transaction status update error:", error);
        res.status(500).json({
          error: "Failed to update transaction status",
          message: error.message
        });
      }
    }
  );

  // Get transaction status
  router.get("/transactions/:txHash/status", async (req, res) => {
    try {
      const { txHash } = req.params;
      const status = await web3Service.getTransactionStatus(txHash);

      if (!status) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      res.json({ status });
    } catch (error) {
      console.error("Get transaction status error:", error);
      res.status(500).json({
        error: "Failed to get transaction status",
        message: error.message
      });
    }
  });

  // Get user transactions
  router.get("/transactions", [authenticateToken], async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;

      const transactions = await web3Service.getUserTransactions(
        req.user.userId,
        limit,
        offset
      );

      res.json({
        transactions: transactions.map((tx) => ({
          id: tx.id,
          txHash: tx.tx_hash,
          type: tx.type,
          amount: tx.amount,
          status: tx.status,
          blockNumber: tx.block_number,
          createdAt: tx.created_at
        })),
        pagination: {
          limit,
          offset,
          total: transactions.length
        }
      });
    } catch (error) {
      console.error("Get user transactions error:", error);
      res.status(500).json({
        error: "Failed to get user transactions",
        message: error.message
      });
    }
  });

  // Record blockchain event
  router.post(
    "/events",
    [
      body("contractAddress").isLength({ min: 42, max: 42 }),
      body("eventName").notEmpty(),
      body("blockNumber").isInt({ min: 0 }),
      body("transactionHash").isLength({ min: 66, max: 66 }),
      body("eventData").optional(),
      body("userId").optional().isInt({ min: 1 }),
      body("network").optional().isString(),
      body("gasUsed").optional().isInt({ min: 0 }),
      body("gasPrice").optional().isString()
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

        const eventData = {
          contractAddress: req.body.contractAddress,
          eventName: req.body.eventName,
          blockNumber: req.body.blockNumber,
          transactionHash: req.body.transactionHash,
          eventData: req.body.eventData,
          userId: req.body.userId,
          network: req.body.network || "ethereum",
          gasUsed: req.body.gasUsed,
          gasPrice: req.body.gasPrice
        };

        const event = await web3Service.recordBlockchainEvent(eventData);

        res.status(201).json({
          message: "Blockchain event recorded successfully",
          event: {
            id: event._id,
            contractAddress: event.contractAddress,
            eventName: event.eventName,
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            processed: event.processed,
            createdAt: event.createdAt
          }
        });
      } catch (error) {
        console.error("Event recording error:", error);

        if (error.code === 11000) {
          // MongoDB duplicate key error
          return res.status(409).json({
            error: "Event already exists"
          });
        }

        res.status(500).json({
          error: "Failed to record blockchain event",
          message: error.message
        });
      }
    }
  );

  // Get contract events
  router.get("/events/:contractAddress", async (req, res) => {
    try {
      const { contractAddress } = req.params;
      const { eventName, limit = 50 } = req.query;

      const events = await web3Service.getContractEvents(
        contractAddress,
        eventName,
        parseInt(limit)
      );

      res.json({
        events: events.map((event) => ({
          id: event._id,
          contractAddress: event.contractAddress,
          eventName: event.eventName,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          processed: event.processed,
          createdAt: event.createdAt
        })),
        pagination: {
          limit: parseInt(limit),
          total: events.length
        }
      });
    } catch (error) {
      console.error("Get contract events error:", error);
      res.status(500).json({
        error: "Failed to get contract events",
        message: error.message
      });
    }
  });

  // Store NFT metadata
  router.post(
    "/nfts",
    [
      body("tokenId").notEmpty(),
      body("contractAddress").isLength({ min: 42, max: 42 }),
      body("name").optional(),
      body("description").optional(),
      body("image").optional(),
      body("externalUrl").optional(),
      body("attributes").optional().isArray(),
      body("owner").optional().isInt({ min: 1 }),
      body("metadata").optional(),
      body("network").optional().isString(),
      body("tokenStandard").optional().isIn(["ERC-721", "ERC-1155"]),
      body("isListed").optional().isBoolean(),
      body("listingPrice").optional().isString()
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

        const nftData = {
          tokenId: req.body.tokenId,
          contractAddress: req.body.contractAddress,
          name: req.body.name,
          description: req.body.description,
          image: req.body.image,
          externalUrl: req.body.externalUrl,
          attributes: req.body.attributes,
          owner: req.body.owner,
          metadata: req.body.metadata,
          network: req.body.network || "ethereum",
          tokenStandard: req.body.tokenStandard || "ERC-721",
          isListed: req.body.isListed || false,
          listingPrice: req.body.listingPrice
        };

        const nft = await web3Service.storeNFTMetadata(nftData);

        res.status(201).json({
          message: "NFT metadata stored successfully",
          nft: {
            id: nft._id,
            tokenId: nft.tokenId,
            contractAddress: nft.contractAddress,
            name: nft.name,
            owner: nft.owner,
            isListed: nft.isListed,
            lastUpdated: nft.lastUpdated
          }
        });
      } catch (error) {
        console.error("NFT storage error:", error);

        if (error.code === 11000) {
          // MongoDB duplicate key error
          return res.status(409).json({
            error: "NFT metadata already exists"
          });
        }

        res.status(500).json({
          error: "Failed to store NFT metadata",
          message: error.message
        });
      }
    }
  );

  // Get NFTs by owner
  router.get("/nfts/owner/:ownerId", async (req, res) => {
    try {
      const { ownerId } = req.params;
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;

      const nfts = await web3Service.getNFTsByOwner(
        parseInt(ownerId),
        limit,
        offset
      );

      res.json({
        nfts: nfts.map((nft) => ({
          id: nft._id,
          tokenId: nft.tokenId,
          contractAddress: nft.contractAddress,
          name: nft.name,
          image: nft.image,
          owner: nft.owner,
          isListed: nft.isListed,
          listingPrice: nft.listingPrice,
          lastUpdated: nft.lastUpdated
        })),
        pagination: {
          limit,
          offset,
          total: nfts.length
        }
      });
    } catch (error) {
      console.error("Get NFTs by owner error:", error);
      res.status(500).json({
        error: "Failed to get NFTs by owner",
        message: error.message
      });
    }
  });

  // Get listed NFTs
  router.get("/nfts/listed", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;

      const nfts = await web3Service.getListedNFTs(limit, offset);

      res.json({
        nfts: nfts.map((nft) => ({
          id: nft._id,
          tokenId: nft.tokenId,
          contractAddress: nft.contractAddress,
          name: nft.name,
          image: nft.image,
          owner: nft.owner,
          listingPrice: nft.listingPrice,
          createdAt: nft.createdAt
        })),
        pagination: {
          limit,
          offset,
          total: nfts.length
        }
      });
    } catch (error) {
      console.error("Get listed NFTs error:", error);
      res.status(500).json({
        error: "Failed to get listed NFTs",
        message: error.message
      });
    }
  });

  // Get contract stats
  router.get("/stats/:contractAddress", async (req, res) => {
    try {
      const { contractAddress } = req.params;
      const stats = await web3Service.getContractStats(contractAddress);

      res.json({ stats });
    } catch (error) {
      console.error("Get contract stats error:", error);
      res.status(500).json({
        error: "Failed to get contract stats",
        message: error.message
      });
    }
  });

  // Process pending transactions (admin endpoint)
  router.post("/process-pending", async (req, res) => {
    try {
      const processedCount = await web3Service.processPendingTransactions();

      res.json({
        message: "Pending transactions processed",
        processedCount
      });
    } catch (error) {
      console.error("Process pending transactions error:", error);
      res.status(500).json({
        error: "Failed to process pending transactions",
        message: error.message
      });
    }
  });

  return router;
}

module.exports = createWeb3Router;
