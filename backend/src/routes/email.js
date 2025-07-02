const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const { body, validationResult } = require("express-validator");
const EmailService = require("../services/EmailService");

function createEmailRouter() {
  const router = express.Router();
  const emailService = new EmailService();

  // Test email endpoint
  router.post("/test", async (req, res) => {
    try {
      const { to, subject, html } = req.body;

      if (!to || !subject || !html) {
        return res.status(400).json({
          error: "Missing required fields: to, subject, html"
        });
      }

      const result = await emailService.sendEmail(to, subject, html);

      res.json({
        message: "Test email sent successfully",
        messageId: result.messageId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Test email error:", error);
      res.status(500).json({
        error: "Failed to send test email",
        message: error.message
      });
    }
  });

  // Send verification email
  router.post(
    "/verification",
    [
      body("email").isEmail(),
      body("userId").isInt({ min: 1 }),
      body("name").isString().isLength({ min: 1 }),
      body("verificationToken").isString().isLength({ min: 32 })
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

        const { email, userId, name, verificationToken } = req.body;

        const user = {
          id: userId,
          email,
          name,
          verificationToken
        };

        // Check if queue system is available (for production)
        if (req.app.locals.emailWorker) {
          // Use queue for better reliability
          await req.app.locals.emailWorker.queueVerificationEmail(user);

          res.json({
            message: "Verification email queued successfully",
            email,
            timestamp: new Date().toISOString()
          });
        } else {
          // Fallback to direct sending (for development/testing)
          await emailService.sendVerificationEmail(user);

          res.json({
            message: "Verification email sent successfully",
            email,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error("Verification email error:", error);
        res.status(500).json({
          error: "Failed to send verification email",
          message: error.message
        });
      }
    }
  );

  // Send welcome email
  router.post(
    "/welcome",
    [
      body("email").isEmail(),
      body("userId").isInt({ min: 1 }),
      body("name").isString().isLength({ min: 1 }),
      body("verificationToken").isString().isLength({ min: 32 })
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

        const { email, userId, name, verificationToken } = req.body;

        const user = {
          id: userId,
          email,
          name,
          verificationToken
        };

        // Check if queue system is available
        if (req.app.locals.emailWorker) {
          await req.app.locals.emailWorker.queueWelcomeEmail(user);

          res.json({
            message: "Welcome email queued successfully",
            email,
            timestamp: new Date().toISOString()
          });
        } else {
          await emailService.sendWelcomeEmail(user);

          res.json({
            message: "Welcome email sent successfully",
            email,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error("Welcome email error:", error);
        res.status(500).json({
          error: "Failed to send welcome email",
          message: error.message
        });
      }
    }
  );

  // Send password reset email
  router.post(
    "/password-reset",
    [
      body("email").isEmail(),
      body("userId").isInt({ min: 1 }),
      body("name").isString().isLength({ min: 1 }),
      body("resetToken").isString().isLength({ min: 32 })
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

        const { email, userId, name, resetToken } = req.body;

        const user = {
          id: userId,
          email,
          name
        };

        if (req.app.locals.emailWorker) {
          await req.app.locals.emailWorker.queuePasswordResetEmail(
            user,
            resetToken
          );

          res.json({
            message: "Password reset email queued successfully",
            email,
            timestamp: new Date().toISOString()
          });
        } else {
          await emailService.sendPasswordResetEmail(user, resetToken);

          res.json({
            message: "Password reset email sent successfully",
            email,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error("Password reset email error:", error);
        res.status(500).json({
          error: "Failed to send password reset email",
          message: error.message
        });
      }
    }
  );

  // Send 2FA email
  router.post(
    "/two-factor",
    [
      body("email").isEmail(),
      body("userId").isInt({ min: 1 }),
      body("name").isString().isLength({ min: 1 }),
      body("twoFactorCode").isString().isLength({ min: 6, max: 6 })
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

        const { email, userId, name, twoFactorCode } = req.body;

        const user = {
          id: userId,
          email,
          name
        };

        if (req.app.locals.emailWorker) {
          await req.app.locals.emailWorker.queueTwoFactorEmail(
            user,
            twoFactorCode
          );

          res.json({
            message: "2FA email queued successfully",
            email,
            timestamp: new Date().toISOString()
          });
        } else {
          await emailService.sendTwoFactorEmail(user, twoFactorCode);

          res.json({
            message: "2FA email sent successfully",
            email,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error("2FA email error:", error);
        res.status(500).json({
          error: "Failed to send 2FA email",
          message: error.message
        });
      }
    }
  );

  // Send invite email
  router.post(
    "/invite",
    [
      body("inviterEmail").isEmail(),
      body("inviterName").isString().isLength({ min: 1 }),
      body("inviteeEmail").isEmail(),
      body("inviteToken").isString().isLength({ min: 32 })
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

        const { inviterEmail, inviterName, inviteeEmail, inviteToken } =
          req.body;

        const inviter = { email: inviterEmail, name: inviterName };
        const invitee = { email: inviteeEmail };
        const inviteTokenData = inviteToken;

        if (req.app.locals.emailWorker) {
          await req.app.locals.emailWorker.queueInviteEmail(
            inviter,
            invitee,
            inviteTokenData
          );

          res.json({
            message: "Invite email queued successfully",
            inviteeEmail,
            timestamp: new Date().toISOString()
          });
        } else {
          await emailService.sendInviteEmail(inviter, invitee, inviteTokenData);

          res.json({
            message: "Invite email sent successfully",
            inviteeEmail,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error("Invite email error:", error);
        res.status(500).json({
          error: "Failed to send invite email",
          message: error.message
        });
      }
    }
  );

  // Send security alert
  router.post(
    "/security-alert",
    [
      body("email").isEmail(),
      body("userId").isInt({ min: 1 }),
      body("name").isString().isLength({ min: 1 }),
      body("alertType").isString().isLength({ min: 1 }),
      body("details").optional().isObject()
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

        const { email, userId, name, alertType, details = {} } = req.body;

        const user = {
          id: userId,
          email,
          name
        };

        if (req.app.locals.emailWorker) {
          await req.app.locals.emailWorker.queueSecurityAlert(
            user,
            alertType,
            details
          );

          res.json({
            message: "Security alert queued successfully",
            email,
            alertType,
            timestamp: new Date().toISOString()
          });
        } else {
          await emailService.sendSecurityAlert(user, alertType, details);

          res.json({
            message: "Security alert sent successfully",
            email,
            alertType,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error("Security alert error:", error);
        res.status(500).json({
          error: "Failed to send security alert",
          message: error.message
        });
      }
    }
  );

  // Send custom email
  router.post(
    "/custom",
    [
      body("to").isEmail(),
      body("subject").isString().isLength({ min: 1, max: 200 }),
      body("html").isString().isLength({ min: 1 }),
      body("text").optional().isString()
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

        const { to, subject, html, text } = req.body;

        if (req.app.locals.emailWorker) {
          await req.app.locals.emailWorker.queueCustomEmail(
            to,
            subject,
            html,
            text
          );

          res.json({
            message: "Custom email queued successfully",
            to,
            subject,
            timestamp: new Date().toISOString()
          });
        } else {
          await emailService.sendEmail(to, subject, html, text);

          res.json({
            message: "Custom email sent successfully",
            to,
            subject,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error("Custom email error:", error);
        res.status(500).json({
          error: "Failed to send custom email",
          message: error.message
        });
      }
    }
  );

  return router;
}

module.exports = createEmailRouter;
