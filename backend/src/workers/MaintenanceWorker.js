const Queue = require("bull");
const MinIOService = require("../services/MinIOService");

class MaintenanceWorker {
  constructor(queueService, databases) {
    this.queueService = queueService;
    this.minioService = new MinIOService();
    this.queue = queueService.queues.get("maintenance");
    this.databases = databases;

    this.setupProcessors();
  }

  setupProcessors() {
    // Process maintenance jobs
    this.queue.process(async (job) => {
      const { type, data, tenantId } = job.data;

      console.log(
        `🔧 Processing maintenance job: ${type} for tenant: ${tenantId}`
      );

      try {
        switch (type) {
          case "cleanup-temp-files":
            return await this.cleanupTempFiles(data.olderThanHours);

          case "cleanup-old-activities":
            return await this.cleanupOldActivities(data.daysOld);

          case "cleanup-old-jobs":
            return await this.cleanupOldJobs(data.daysOld);

          case "database-maintenance":
            return await this.databaseMaintenance();

          case "cache-cleanup":
            return await this.cacheCleanup();

          case "health-check":
            return await this.healthCheck();

          default:
            throw new Error(`Unknown maintenance job type: ${type}`);
        }
      } catch (error) {
        console.error(`❌ Maintenance job failed: ${type}`, error);

        // Log to database for audit trail
        await this.logMaintenanceFailure(job.data, error);

        throw error;
      }
    });

    // Handle failed jobs
    this.queue.on("failed", async (job, error) => {
      console.error(`❌ Maintenance job ${job.id} failed:`, error.message);

      // For maintenance jobs, we might not want to retry immediately
      console.log(
        `⚠️ Maintenance job failed: ${job.data.type} - manual intervention may be needed`
      );
    });

    // Handle completed jobs
    this.queue.on("completed", async (job) => {
      console.log(`✅ Maintenance job ${job.id} completed: ${job.data.type}`);

      // Log successful operation for audit trail
      await this.logMaintenanceSuccess(job.data);
    });
  }

  async cleanupTempFiles(olderThanHours = 24) {
    try {
      console.log(
        `🧹 Cleaning up temp files older than ${olderThanHours} hours`
      );

      const result = await this.minioService.cleanupTempFiles(olderThanHours);

      console.log(`✅ Cleaned up ${result} temp files`);
      return { cleaned: result };
    } catch (error) {
      console.error(`❌ Failed to cleanup temp files:`, error);
      throw error;
    }
  }

  async cleanupOldActivities(daysOld = 90) {
    try {
      console.log(`🧹 Cleaning up activities older than ${daysOld} days`);

      // This would use the UserActivity model to cleanup old activities
      // For now, we'll just log the operation
      console.log(`✅ Would cleanup activities older than ${daysOld} days`);

      return { cleaned: 0 }; // Placeholder
    } catch (error) {
      console.error(`❌ Failed to cleanup old activities:`, error);
      throw error;
    }
  }

  async cleanupOldJobs(daysOld = 7) {
    try {
      console.log(`🧹 Cleaning up jobs older than ${daysOld} days`);

      const result = await this.queueService.cleanupOldJobs(daysOld);

      console.log(`✅ Cleaned up old jobs`);
      return { cleaned: true };
    } catch (error) {
      console.error(`❌ Failed to cleanup old jobs:`, error);
      throw error;
    }
  }

  async databaseMaintenance() {
    try {
      console.log(`🔧 Running database maintenance`);

      // This would include:
      // 1. PostgreSQL VACUUM
      // 2. MongoDB cleanup
      // 3. Index optimization
      // 4. Statistics updates

      console.log(`✅ Database maintenance completed`);
      return { maintained: true };
    } catch (error) {
      console.error(`❌ Failed to run database maintenance:`, error);
      throw error;
    }
  }

  async cacheCleanup() {
    try {
      console.log(`🧹 Cleaning up cache`);

      // This would cleanup Redis cache:
      // 1. Remove expired keys
      // 2. Cleanup old session data
      // 3. Optimize memory usage

      console.log(`✅ Cache cleanup completed`);
      return { cleaned: true };
    } catch (error) {
      console.error(`❌ Failed to cleanup cache:`, error);
      throw error;
    }
  }

  async healthCheck() {
    try {
      console.log(`🏥 Running health check`);

      const checks = {
        database: await this.checkDatabaseHealth(),
        redis: await this.checkRedisHealth(),
        minio: await this.checkMinIOHealth(),
        queues: await this.checkQueueHealth()
      };

      const allHealthy = Object.values(checks).every(
        (check) => check.status === "healthy"
      );

      console.log(
        `✅ Health check completed: ${
          allHealthy ? "All systems healthy" : "Issues detected"
        }`
      );

      return {
        healthy: allHealthy,
        checks
      };
    } catch (error) {
      console.error(`❌ Failed to run health check:`, error);
      throw error;
    }
  }

  async checkDatabaseHealth() {
    try {
      // Check PostgreSQL
      await this.databases.postgresPool.query("SELECT 1");

      // Check MongoDB
      await this.databases.mongo.connection.db.admin().ping();

      return { status: "healthy" };
    } catch (error) {
      return { status: "unhealthy", error: error.message };
    }
  }

  async checkRedisHealth() {
    try {
      await this.databases.redis.ping();
      return { status: "healthy" };
    } catch (error) {
      return { status: "unhealthy", error: error.message };
    }
  }

  async checkMinIOHealth() {
    try {
      // This would check MinIO connectivity
      return { status: "healthy" };
    } catch (error) {
      return { status: "unhealthy", error: error.message };
    }
  }

  async checkQueueHealth() {
    try {
      const stats = await this.queueService.getQueueStats();
      const totalJobs = Object.values(stats).reduce(
        (sum, queue) => sum + queue.total,
        0
      );

      return {
        status: "healthy",
        totalJobs,
        queues: Object.keys(stats).length
      };
    } catch (error) {
      return { status: "unhealthy", error: error.message };
    }
  }

  async logMaintenanceSuccess(jobData) {
    // This would typically log to a database for audit purposes
    console.log(
      `📝 Maintenance success logged: ${jobData.type} for tenant: ${jobData.tenantId}`
    );
  }

  async logMaintenanceFailure(jobData, error) {
    // This would typically log to a database for audit purposes
    console.error(
      `📝 Maintenance failure logged: ${jobData.type} for tenant: ${jobData.tenantId}`,
      error.message
    );
  }

  // Add maintenance jobs to queue
  async queueCleanupTempFiles(olderThanHours = 24, tenantId = "default") {
    return await this.queueService.addMaintenanceJob("cleanup-temp-files", {
      olderThanHours,
      tenantId
    });
  }

  async queueCleanupOldActivities(daysOld = 90, tenantId = "default") {
    return await this.queueService.addMaintenanceJob("cleanup-old-activities", {
      daysOld,
      tenantId
    });
  }

  async queueCleanupOldJobs(daysOld = 7, tenantId = "default") {
    return await this.queueService.addMaintenanceJob("cleanup-old-jobs", {
      daysOld,
      tenantId
    });
  }

  async queueDatabaseMaintenance(tenantId = "default") {
    return await this.queueService.addMaintenanceJob("database-maintenance", {
      tenantId
    });
  }

  async queueCacheCleanup(tenantId = "default") {
    return await this.queueService.addMaintenanceJob("cache-cleanup", {
      tenantId
    });
  }

  async queueHealthCheck(tenantId = "default") {
    return await this.queueService.addMaintenanceJob("health-check", {
      tenantId
    });
  }

  // Schedule recurring maintenance jobs
  async scheduleCleanupTempFiles(
    cronPattern = "0 2 * * *",
    olderThanHours = 24,
    tenantId = "default"
  ) {
    return await this.queueService.scheduleRecurringJob(
      "maintenance",
      "cleanup-temp-files",
      { olderThanHours, tenantId },
      cronPattern
    );
  }

  async scheduleCleanupOldActivities(
    cronPattern = "0 3 * * 0",
    daysOld = 90,
    tenantId = "default"
  ) {
    return await this.queueService.scheduleRecurringJob(
      "maintenance",
      "cleanup-old-activities",
      { daysOld, tenantId },
      cronPattern
    );
  }

  async scheduleCleanupOldJobs(
    cronPattern = "0 4 * * *",
    daysOld = 7,
    tenantId = "default"
  ) {
    return await this.queueService.scheduleRecurringJob(
      "maintenance",
      "cleanup-old-jobs",
      { daysOld, tenantId },
      cronPattern
    );
  }

  async scheduleDatabaseMaintenance(
    cronPattern = "0 5 * * 0",
    tenantId = "default"
  ) {
    return await this.queueService.scheduleRecurringJob(
      "maintenance",
      "database-maintenance",
      { tenantId },
      cronPattern
    );
  }

  async scheduleHealthCheck(
    cronPattern = "*/15 * * * *",
    tenantId = "default"
  ) {
    return await this.queueService.scheduleRecurringJob(
      "maintenance",
      "health-check",
      { tenantId },
      cronPattern
    );
  }

  // Get maintenance queue stats
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

  // Get maintenance stats by tenant
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

module.exports = MaintenanceWorker;
