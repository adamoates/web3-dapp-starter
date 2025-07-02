const Queue = require("bull");
const Redis = require("ioredis");

class QueueService {
  constructor() {
    this.queues = new Map();
    this.redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_QUEUE_DB || 1, // Separate DB for queues
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });

    this.initializeQueues();
  }

  initializeQueues() {
    // Email queue for all email operations
    this.queues.set(
      "email",
      new Queue("email", {
        redis: {
          host: process.env.REDIS_HOST || "localhost",
          port: process.env.REDIS_PORT || 6379,
          password: process.env.REDIS_PASSWORD,
          db: process.env.REDIS_QUEUE_DB || 1
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000
          },
          removeOnComplete: 100,
          removeOnFail: 50
        }
      })
    );

    // File processing queue
    this.queues.set(
      "file-processing",
      new Queue("file-processing", {
        redis: {
          host: process.env.REDIS_HOST || "localhost",
          port: process.env.REDIS_PORT || 6379,
          password: process.env.REDIS_PASSWORD,
          db: process.env.REDIS_QUEUE_DB || 1
        },
        defaultJobOptions: {
          attempts: 2,
          backoff: {
            type: "fixed",
            delay: 5000
          },
          removeOnComplete: 50,
          removeOnFail: 20
        }
      })
    );

    // Blockchain operations queue
    this.queues.set(
      "blockchain",
      new Queue("blockchain", {
        redis: {
          host: process.env.REDIS_HOST || "localhost",
          port: process.env.REDIS_PORT || 6379,
          password: process.env.REDIS_PASSWORD,
          db: process.env.REDIS_QUEUE_DB || 1
        },
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: "exponential",
            delay: 10000
          },
          removeOnComplete: 200,
          removeOnFail: 100
        }
      })
    );

    // Maintenance queue for cleanup tasks
    this.queues.set(
      "maintenance",
      new Queue("maintenance", {
        redis: {
          host: process.env.REDIS_HOST || "localhost",
          port: process.env.REDIS_PORT || 6379,
          password: process.env.REDIS_PASSWORD,
          db: process.env.REDIS_QUEUE_DB || 1
        },
        defaultJobOptions: {
          attempts: 1,
          removeOnComplete: 10,
          removeOnFail: 5
        }
      })
    );

    // Setup queue event handlers
    this.setupQueueHandlers();
  }

  setupQueueHandlers() {
    this.queues.forEach((queue, name) => {
      queue.on("error", (error) => {
        console.error(`❌ Queue ${name} error:`, error);
      });

      queue.on("failed", (job, error) => {
        console.error(
          `❌ Job ${job.id} in queue ${name} failed:`,
          error.message
        );
      });

      queue.on("completed", (job) => {
        console.log(`✅ Job ${job.id} in queue ${name} completed`);
      });

      queue.on("stalled", (job) => {
        console.warn(`⚠️ Job ${job.id} in queue ${name} stalled`);
      });
    });
  }

  // Email queue methods
  async addEmailJob(type, data, options = {}) {
    const queue = this.queues.get("email");
    const jobData = {
      type,
      data,
      tenantId: data.tenantId || "default",
      timestamp: new Date().toISOString()
    };

    const jobOptions = {
      priority: this.getEmailPriority(type),
      delay: options.delay || 0,
      ...options
    };

    return await queue.add(jobData, jobOptions);
  }

  getEmailPriority(type) {
    const priorities = {
      "security-alert": 1,
      "password-reset": 2,
      verification: 3,
      welcome: 4,
      newsletter: 5
    };
    return priorities[type] || 3;
  }

  // File processing queue methods
  async addFileProcessingJob(type, data, options = {}) {
    const queue = this.queues.get("file-processing");
    const jobData = {
      type,
      data,
      tenantId: data.tenantId || "default",
      timestamp: new Date().toISOString()
    };

    return await queue.add(jobData, options);
  }

  // Blockchain queue methods
  async addBlockchainJob(type, data, options = {}) {
    const queue = this.queues.get("blockchain");
    const jobData = {
      type,
      data,
      tenantId: data.tenantId || "default",
      timestamp: new Date().toISOString()
    };

    const jobOptions = {
      priority: this.getBlockchainPriority(type),
      ...options
    };

    return await queue.add(jobData, jobOptions);
  }

  getBlockchainPriority(type) {
    const priorities = {
      "transaction-status-update": 1,
      "pending-transaction-check": 2,
      "blockchain-event-monitoring": 3,
      "nft-metadata-update": 4
    };
    return priorities[type] || 3;
  }

  // Maintenance queue methods
  async addMaintenanceJob(type, data, options = {}) {
    const queue = this.queues.get("maintenance");
    const jobData = {
      type,
      data,
      tenantId: data.tenantId || "default",
      timestamp: new Date().toISOString()
    };

    return await queue.add(jobData, options);
  }

  // Scheduled jobs
  async scheduleRecurringJob(queueName, type, data, cronPattern, options = {}) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const jobData = {
      type,
      data,
      tenantId: data.tenantId || "default",
      timestamp: new Date().toISOString()
    };

    return await queue.add(jobData, {
      repeat: { cron: cronPattern },
      ...options
    });
  }

  // Queue monitoring
  async getQueueStats() {
    const stats = {};

    for (const [name, queue] of this.queues) {
      const [waiting, active, completed, failed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed()
      ]);

      stats[name] = {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        total: waiting.length + active.length + completed.length + failed.length
      };
    }

    return stats;
  }

  async getTenantStats(tenantId) {
    const stats = {};

    for (const [name, queue] of this.queues) {
      const jobs = await queue.getJobs([
        "waiting",
        "active",
        "completed",
        "failed"
      ]);
      const tenantJobs = jobs.filter((job) => job.data.tenantId === tenantId);

      stats[name] = {
        total: tenantJobs.length,
        waiting: tenantJobs.filter(
          (job) =>
            job.finishedOn === undefined && job.failedReason === undefined
        ).length,
        active: tenantJobs.filter((job) => job.processedOn && !job.finishedOn)
          .length,
        completed: tenantJobs.filter(
          (job) => job.finishedOn && !job.failedReason
        ).length,
        failed: tenantJobs.filter((job) => job.failedReason).length
      };
    }

    return stats;
  }

  // Queue cleanup
  async cleanupOldJobs(daysOld = 7) {
    const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;

    for (const [name, queue] of this.queues) {
      const completedJobs = await queue.getCompleted();
      const failedJobs = await queue.getFailed();

      const oldCompleted = completedJobs.filter(
        (job) => job.finishedOn < cutoffTime
      );
      const oldFailed = failedJobs.filter((job) => job.finishedOn < cutoffTime);

      for (const job of [...oldCompleted, ...oldFailed]) {
        await job.remove();
      }

      console.log(
        `🧹 Cleaned up ${
          oldCompleted.length + oldFailed.length
        } old jobs from ${name} queue`
      );
    }
  }

  // Graceful shutdown
  async shutdown() {
    console.log("🛑 Shutting down queue service...");

    const closePromises = Array.from(this.queues.values()).map((queue) =>
      queue.close()
    );

    await Promise.all(closePromises);
    await this.redis.quit();

    console.log("✅ Queue service shut down successfully");
  }

  // Health check
  async healthCheck() {
    try {
      await this.redis.ping();

      const stats = await this.getQueueStats();
      const totalJobs = Object.values(stats).reduce(
        (sum, queue) => sum + queue.total,
        0
      );

      return {
        status: "healthy",
        redis: "connected",
        queues: Object.keys(this.queues).length,
        totalJobs,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: "unhealthy",
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = QueueService;
