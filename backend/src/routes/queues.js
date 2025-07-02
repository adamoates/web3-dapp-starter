const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const { body, validationResult } = require("express-validator");

function createQueueRouter(
  queueService,
  emailWorker,
  blockchainWorker,
  maintenanceWorker
) {
  const router = express.Router();

  // Get overall queue statistics
  router.get("/stats", authenticateToken, async (req, res) => {
    try {
      const stats = await queueService.getQueueStats();

      res.json({
        message: "Queue statistics retrieved successfully",
        stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Queue stats error:", error);
      res.status(500).json({
        error: "Failed to get queue statistics",
        message: error.message
      });
    }
  });

  // Get queue statistics by tenant
  router.get("/stats/:tenantId", authenticateToken, async (req, res) => {
    try {
      const { tenantId } = req.params;
      const stats = await queueService.getTenantStats(tenantId);

      res.json({
        message: "Tenant queue statistics retrieved successfully",
        tenantId,
        stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Tenant queue stats error:", error);
      res.status(500).json({
        error: "Failed to get tenant queue statistics",
        message: error.message
      });
    }
  });

  // Get specific queue statistics
  router.get("/stats/queue/:queueName", authenticateToken, async (req, res) => {
    try {
      const { queueName } = req.params;

      let stats;
      switch (queueName) {
        case "email":
          stats = await emailWorker.getStats();
          break;
        case "blockchain":
          stats = await blockchainWorker.getStats();
          break;
        case "maintenance":
          stats = await maintenanceWorker.getStats();
          break;
        default:
          return res.status(400).json({
            error: "Invalid queue name",
            validQueues: ["email", "blockchain", "maintenance"]
          });
      }

      res.json({
        message: `${queueName} queue statistics retrieved successfully`,
        queueName,
        stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Queue stats error:", error);
      res.status(500).json({
        error: "Failed to get queue statistics",
        message: error.message
      });
    }
  });

  // Queue health check
  router.get("/health", authenticateToken, async (req, res) => {
    try {
      const health = await queueService.healthCheck();

      res.json({
        message: "Queue health check completed",
        health,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Queue health check error:", error);
      res.status(500).json({
        error: "Failed to perform queue health check",
        message: error.message
      });
    }
  });

  // Clean up old jobs
  router.post(
    "/cleanup",
    [authenticateToken, body("daysOld").optional().isInt({ min: 1, max: 365 })],
    async (req, res) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            error: "Validation failed",
            details: errors.array()
          });
        }

        const daysOld = req.body.daysOld || 7;
        await queueService.cleanupOldJobs(daysOld);

        res.json({
          message: `Cleaned up jobs older than ${daysOld} days`,
          daysOld,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error("Queue cleanup error:", error);
        res.status(500).json({
          error: "Failed to cleanup old jobs",
          message: error.message
        });
      }
    }
  );

  // Pause a queue
  router.post("/pause/:queueName", authenticateToken, async (req, res) => {
    try {
      const { queueName } = req.params;
      const queue = queueService.queues.get(queueName);

      if (!queue) {
        return res.status(400).json({
          error: "Invalid queue name",
          validQueues: Array.from(queueService.queues.keys())
        });
      }

      await queue.pause();

      res.json({
        message: `${queueName} queue paused successfully`,
        queueName,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Queue pause error:", error);
      res.status(500).json({
        error: "Failed to pause queue",
        message: error.message
      });
    }
  });

  // Resume a queue
  router.post("/resume/:queueName", authenticateToken, async (req, res) => {
    try {
      const { queueName } = req.params;
      const queue = queueService.queues.get(queueName);

      if (!queue) {
        return res.status(400).json({
          error: "Invalid queue name",
          validQueues: Array.from(queueService.queues.keys())
        });
      }

      await queue.resume();

      res.json({
        message: `${queueName} queue resumed successfully`,
        queueName,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Queue resume error:", error);
      res.status(500).json({
        error: "Failed to resume queue",
        message: error.message
      });
    }
  });

  // Get queue status
  router.get("/status/:queueName", authenticateToken, async (req, res) => {
    try {
      const { queueName } = req.params;
      const queue = queueService.queues.get(queueName);

      if (!queue) {
        return res.status(400).json({
          error: "Invalid queue name",
          validQueues: Array.from(queueService.queues.keys())
        });
      }

      const isPaused = await queue.isPaused();

      res.json({
        message: `${queueName} queue status retrieved`,
        queueName,
        status: isPaused ? "paused" : "running",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Queue status error:", error);
      res.status(500).json({
        error: "Failed to get queue status",
        message: error.message
      });
    }
  });

  // Retry failed jobs
  router.post(
    "/retry/:queueName",
    [
      authenticateToken,
      body("jobId").optional().isString(),
      body("all").optional().isBoolean()
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

        const { queueName } = req.params;
        const { jobId, all } = req.body;
        const queue = queueService.queues.get(queueName);

        if (!queue) {
          return res.status(400).json({
            error: "Invalid queue name",
            validQueues: Array.from(queueService.queues.keys())
          });
        }

        if (all) {
          // Retry all failed jobs
          const failedJobs = await queue.getFailed();
          for (const job of failedJobs) {
            await job.retry();
          }

          res.json({
            message: `Retried ${failedJobs.length} failed jobs in ${queueName} queue`,
            queueName,
            retriedCount: failedJobs.length,
            timestamp: new Date().toISOString()
          });
        } else if (jobId) {
          // Retry specific job
          const job = await queue.getJob(jobId);
          if (!job) {
            return res.status(404).json({
              error: "Job not found"
            });
          }

          await job.retry();

          res.json({
            message: `Retried job ${jobId} in ${queueName} queue`,
            queueName,
            jobId,
            timestamp: new Date().toISOString()
          });
        } else {
          return res.status(400).json({
            error: "Either jobId or all must be provided"
          });
        }
      } catch (error) {
        console.error("Queue retry error:", error);
        res.status(500).json({
          error: "Failed to retry jobs",
          message: error.message
        });
      }
    }
  );

  // Get failed jobs
  router.get("/failed/:queueName", authenticateToken, async (req, res) => {
    try {
      const { queueName } = req.params;
      const queue = queueService.queues.get(queueName);

      if (!queue) {
        return res.status(400).json({
          error: "Invalid queue name",
          validQueues: Array.from(queueService.queues.keys())
        });
      }

      const failedJobs = await queue.getFailed();
      const jobs = failedJobs.map((job) => ({
        id: job.id,
        type: job.data.type,
        tenantId: job.data.tenantId,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn
      }));

      res.json({
        message: `Retrieved ${jobs.length} failed jobs from ${queueName} queue`,
        queueName,
        jobs,
        count: jobs.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Get failed jobs error:", error);
      res.status(500).json({
        error: "Failed to get failed jobs",
        message: error.message
      });
    }
  });

  // Schedule maintenance jobs
  router.post(
    "/schedule/maintenance",
    [
      authenticateToken,
      body("type").isIn([
        "cleanup-temp-files",
        "cleanup-old-activities",
        "cleanup-old-jobs",
        "database-maintenance",
        "health-check"
      ]),
      body("cronPattern").isString(),
      body("tenantId").optional().isString()
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

        const { type, cronPattern, tenantId = "default" } = req.body;

        let job;
        switch (type) {
          case "cleanup-temp-files":
            job = await maintenanceWorker.scheduleCleanupTempFiles(
              cronPattern,
              24,
              tenantId
            );
            break;
          case "cleanup-old-activities":
            job = await maintenanceWorker.scheduleCleanupOldActivities(
              cronPattern,
              90,
              tenantId
            );
            break;
          case "cleanup-old-jobs":
            job = await maintenanceWorker.scheduleCleanupOldJobs(
              cronPattern,
              7,
              tenantId
            );
            break;
          case "database-maintenance":
            job = await maintenanceWorker.scheduleDatabaseMaintenance(
              cronPattern,
              tenantId
            );
            break;
          case "health-check":
            job = await maintenanceWorker.scheduleHealthCheck(
              cronPattern,
              tenantId
            );
            break;
        }

        res.json({
          message: `Scheduled ${type} maintenance job`,
          type,
          cronPattern,
          tenantId,
          jobId: job.id,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error("Schedule maintenance error:", error);
        res.status(500).json({
          error: "Failed to schedule maintenance job",
          message: error.message
        });
      }
    }
  );

  return router;
}

module.exports = createQueueRouter;
