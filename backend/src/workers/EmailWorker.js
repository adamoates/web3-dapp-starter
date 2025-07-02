const Queue = require("bull");
const EmailService = require("../services/EmailService");

class EmailWorker {
  constructor(queueService) {
    this.queueService = queueService;
    this.emailService = new EmailService();
    this.queue = queueService.queues.get("email");

    this.setupProcessors();
  }

  setupProcessors() {
    // Process email jobs
    this.queue.process(async (job) => {
      const { type, data, tenantId } = job.data;

      console.log(`📧 Processing email job: ${type} for tenant: ${tenantId}`);

      try {
        switch (type) {
          case "welcome":
            return await this.emailService.sendWelcomeEmail(data.user);

          case "verification":
            return await this.emailService.sendVerificationEmail(data.user);

          case "password-reset":
            return await this.emailService.sendPasswordResetEmail(
              data.user,
              data.resetToken
            );

          case "two-factor":
            return await this.emailService.sendTwoFactorEmail(
              data.user,
              data.twoFactorCode
            );

          case "invite":
            return await this.emailService.sendInviteEmail(
              data.inviter,
              data.invitee,
              data.inviteToken
            );

          case "security-alert":
            return await this.emailService.sendSecurityAlert(
              data.user,
              data.alertType,
              data.details
            );

          case "custom":
            return await this.emailService.sendEmail(
              data.to,
              data.subject,
              data.html,
              data.text
            );

          default:
            throw new Error(`Unknown email type: ${type}`);
        }
      } catch (error) {
        console.error(`❌ Email job failed: ${type}`, error);

        // Log to database for audit trail
        await this.logEmailFailure(job.data, error);

        throw error;
      }
    });

    // Handle failed jobs
    this.queue.on("failed", async (job, error) => {
      console.error(`❌ Email job ${job.id} failed:`, error.message);

      // If it's a critical email (security, password reset), we might want to retry more
      if (
        job.data.type === "security-alert" ||
        job.data.type === "password-reset"
      ) {
        if (job.attemptsMade < 5) {
          console.log(`🔄 Retrying critical email: ${job.data.type}`);
        }
      }
    });

    // Handle completed jobs
    this.queue.on("completed", async (job) => {
      console.log(`✅ Email job ${job.id} completed: ${job.data.type}`);

      // Log successful email for audit trail
      await this.logEmailSuccess(job.data);
    });
  }

  async logEmailSuccess(emailData) {
    // This would typically log to a database for audit purposes
    // For now, we'll just console log
    console.log(
      `📝 Email success logged: ${emailData.type} to ${
        emailData.data.user?.email || emailData.data.to
      }`
    );
  }

  async logEmailFailure(emailData, error) {
    // This would typically log to a database for audit purposes
    console.error(
      `📝 Email failure logged: ${emailData.type} to ${
        emailData.data.user?.email || emailData.data.to
      }`,
      error.message
    );
  }

  // Add email jobs to queue
  async queueWelcomeEmail(user, tenantId = "default") {
    return await this.queueService.addEmailJob("welcome", {
      user,
      tenantId
    });
  }

  async queueVerificationEmail(user, tenantId = "default") {
    return await this.queueService.addEmailJob("verification", {
      user,
      tenantId
    });
  }

  async queuePasswordResetEmail(user, resetToken, tenantId = "default") {
    return await this.queueService.addEmailJob("password-reset", {
      user,
      resetToken,
      tenantId
    });
  }

  async queueTwoFactorEmail(user, twoFactorCode, tenantId = "default") {
    return await this.queueService.addEmailJob("two-factor", {
      user,
      twoFactorCode,
      tenantId
    });
  }

  async queueInviteEmail(inviter, invitee, inviteToken, tenantId = "default") {
    return await this.queueService.addEmailJob("invite", {
      inviter,
      invitee,
      inviteToken,
      tenantId
    });
  }

  async queueSecurityAlert(
    user,
    alertType,
    details = {},
    tenantId = "default"
  ) {
    return await this.queueService.addEmailJob("security-alert", {
      user,
      alertType,
      details,
      tenantId
    });
  }

  async queueCustomEmail(to, subject, html, text = null, tenantId = "default") {
    return await this.queueService.addEmailJob("custom", {
      to,
      subject,
      html,
      text,
      tenantId
    });
  }

  // Get email queue stats
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

  // Get email stats by tenant
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

module.exports = EmailWorker;
