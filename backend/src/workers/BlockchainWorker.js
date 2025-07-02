const Queue = require("bull");
const Web3Service = require("../services/Web3Service");

class BlockchainWorker {
  constructor(queueService, databases) {
    this.queueService = queueService;
    this.web3Service = new Web3Service(databases);
    this.queue = queueService.queues.get("blockchain");
    this.databases = databases;

    this.setupProcessors();
  }

  setupProcessors() {
    // Process blockchain jobs
    this.queue.process(async (job) => {
      const { type, data, tenantId } = job.data;

      console.log(
        `⛓️ Processing blockchain job: ${type} for tenant: ${tenantId}`
      );

      try {
        switch (type) {
          case "transaction-status-update":
            return await this.updateTransactionStatus(
              data.txHash,
              data.status,
              data.blockNumber
            );

          case "pending-transaction-check":
            return await this.checkPendingTransactions();

          case "blockchain-event-monitoring":
            return await this.monitorBlockchainEvents(
              data.contractAddress,
              data.eventName
            );

          case "nft-metadata-update":
            return await this.updateNFTMetadata(
              data.contractAddress,
              data.tokenId,
              data.metadata
            );

          case "process-pending-transactions":
            return await this.processPendingTransactions();

          default:
            throw new Error(`Unknown blockchain job type: ${type}`);
        }
      } catch (error) {
        console.error(`❌ Blockchain job failed: ${type}`, error);

        // Log to database for audit trail
        await this.logBlockchainFailure(job.data, error);

        throw error;
      }
    });

    // Handle failed jobs
    this.queue.on("failed", async (job, error) => {
      console.error(`❌ Blockchain job ${job.id} failed:`, error.message);

      // For blockchain operations, we might want to retry more times
      if (job.attemptsMade < 5) {
        console.log(`🔄 Retrying blockchain job: ${job.data.type}`);
      }
    });

    // Handle completed jobs
    this.queue.on("completed", async (job) => {
      console.log(`✅ Blockchain job ${job.id} completed: ${job.data.type}`);

      // Log successful operation for audit trail
      await this.logBlockchainSuccess(job.data);
    });
  }

  async updateTransactionStatus(txHash, status, blockNumber) {
    try {
      const result = await this.web3Service.updateTransactionStatus(
        txHash,
        status,
        blockNumber
      );
      console.log(`✅ Transaction status updated: ${txHash} -> ${status}`);
      return result;
    } catch (error) {
      console.error(`❌ Failed to update transaction status: ${txHash}`, error);
      throw error;
    }
  }

  async checkPendingTransactions() {
    try {
      const pendingTxs =
        await this.web3Service.transaction.getPendingTransactions();

      for (const tx of pendingTxs) {
        // Check blockchain for transaction status
        const receipt = await this.web3Service.getTransactionReceipt(
          tx.tx_hash
        );

        if (receipt) {
          const status = receipt.status ? "confirmed" : "failed";
          await this.web3Service.updateTransactionStatus(
            tx.tx_hash,
            status,
            receipt.blockNumber
          );

          console.log(
            `✅ Updated pending transaction: ${tx.tx_hash} -> ${status}`
          );
        }
      }

      return { processed: pendingTxs.length };
    } catch (error) {
      console.error(`❌ Failed to check pending transactions:`, error);
      throw error;
    }
  }

  async monitorBlockchainEvents(contractAddress, eventName) {
    try {
      // This would typically involve setting up event listeners
      // For now, we'll just log the monitoring request
      console.log(
        `👁️ Monitoring blockchain events: ${eventName} on ${contractAddress}`
      );

      // In a real implementation, you would:
      // 1. Set up Web3 event listeners
      // 2. Process incoming events
      // 3. Store events in database
      // 4. Trigger notifications if needed

      return { monitored: true, contractAddress, eventName };
    } catch (error) {
      console.error(`❌ Failed to monitor blockchain events:`, error);
      throw error;
    }
  }

  async updateNFTMetadata(contractAddress, tokenId, metadata) {
    try {
      // This would update NFT metadata in the database
      console.log(`🖼️ Updating NFT metadata: ${contractAddress}:${tokenId}`);

      // In a real implementation, you would:
      // 1. Validate metadata
      // 2. Update database
      // 3. Trigger cache invalidation
      // 4. Send notifications if needed

      return { updated: true, contractAddress, tokenId };
    } catch (error) {
      console.error(`❌ Failed to update NFT metadata:`, error);
      throw error;
    }
  }

  async processPendingTransactions() {
    try {
      const result = await this.web3Service.processPendingTransactions();
      console.log(`✅ Processed ${result} pending transactions`);
      return result;
    } catch (error) {
      console.error(`❌ Failed to process pending transactions:`, error);
      throw error;
    }
  }

  async logBlockchainSuccess(jobData) {
    // This would typically log to a database for audit purposes
    console.log(
      `📝 Blockchain success logged: ${jobData.type} for tenant: ${jobData.tenantId}`
    );
  }

  async logBlockchainFailure(jobData, error) {
    // This would typically log to a database for audit purposes
    console.error(
      `📝 Blockchain failure logged: ${jobData.type} for tenant: ${jobData.tenantId}`,
      error.message
    );
  }

  // Add blockchain jobs to queue
  async queueTransactionStatusUpdate(
    txHash,
    status,
    blockNumber = null,
    tenantId = "default"
  ) {
    return await this.queueService.addBlockchainJob(
      "transaction-status-update",
      {
        txHash,
        status,
        blockNumber,
        tenantId
      }
    );
  }

  async queuePendingTransactionCheck(tenantId = "default") {
    return await this.queueService.addBlockchainJob(
      "pending-transaction-check",
      {
        tenantId
      }
    );
  }

  async queueBlockchainEventMonitoring(
    contractAddress,
    eventName,
    tenantId = "default"
  ) {
    return await this.queueService.addBlockchainJob(
      "blockchain-event-monitoring",
      {
        contractAddress,
        eventName,
        tenantId
      }
    );
  }

  async queueNFTMetadataUpdate(
    contractAddress,
    tokenId,
    metadata,
    tenantId = "default"
  ) {
    return await this.queueService.addBlockchainJob("nft-metadata-update", {
      contractAddress,
      tokenId,
      metadata,
      tenantId
    });
  }

  async queueProcessPendingTransactions(tenantId = "default") {
    return await this.queueService.addBlockchainJob(
      "process-pending-transactions",
      {
        tenantId
      }
    );
  }

  // Schedule recurring blockchain jobs
  async schedulePendingTransactionCheck(
    cronPattern = "*/5 * * * *",
    tenantId = "default"
  ) {
    return await this.queueService.scheduleRecurringJob(
      "blockchain",
      "pending-transaction-check",
      { tenantId },
      cronPattern
    );
  }

  async scheduleBlockchainEventMonitoring(
    contractAddress,
    eventName,
    cronPattern = "*/30 * * * *",
    tenantId = "default"
  ) {
    return await this.queueService.scheduleRecurringJob(
      "blockchain",
      "blockchain-event-monitoring",
      { contractAddress, eventName, tenantId },
      cronPattern
    );
  }

  // Get blockchain queue stats
  async getStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaiting(),
      this.queue.getActive(),
      this.queue.getCompleted(),
      this.queue.getFailed()
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      total: waiting.length + active.length + completed.length + failed.length
    };
  }

  // Get blockchain stats by tenant
  async getTenantStats(tenantId) {
    const jobs = await this.queue.getJobs([
      "waiting",
      "active",
      "completed",
      "failed"
    ]);
    const tenantJobs = jobs.filter((job) => job.data.tenantId === tenantId);

    return {
      total: tenantJobs.length,
      waiting: tenantJobs.filter(
        (job) => job.finishedOn === undefined && job.failedReason === undefined
      ).length,
      active: tenantJobs.filter((job) => job.processedOn && !job.finishedOn)
        .length,
      completed: tenantJobs.filter((job) => job.finishedOn && !job.failedReason)
        .length,
      failed: tenantJobs.filter((job) => job.failedReason).length
    };
  }
}

module.exports = BlockchainWorker;
