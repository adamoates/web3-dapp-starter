const nodemailer = require("nodemailer");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs").promises;
const BaseService = require("./BaseService");
const IEmailService = require("../interfaces/IEmailService");
const {
  EmailServiceError,
  EmailTransporterError,
  EmailTemplateError
} = require("../errors/ServiceErrors");

class EmailService extends BaseService {
  constructor(transporter = null, tenantService = null) {
    super();
    this.transporter = transporter;
    this.tenantService = tenantService;
    this.templates = {};

    if (transporter) {
      // Use provided transporter (for testing)
      this._loadTemplates();
    } else {
      // Initialize transporter asynchronously (for production)
      this._initTransporter();
      this._loadTemplates();
    }
  }

  async _initTransporter(tenantId = null) {
    try {
      let config;

      if (tenantId && this.tenantService) {
        // Use tenant-specific SMTP configuration
        const smtpConfig = await this.tenantService.getTenantSMTP(tenantId);
        config = {
          host: smtpConfig.host,
          port: smtpConfig.port,
          secure: smtpConfig.secure || false,
          auth: {
            user: smtpConfig.user || "",
            pass: smtpConfig.pass || ""
          },
          tls: {
            rejectUnauthorized: false
          }
        };
      } else {
        // Use default configuration
        config = {
          host: process.env.SMTP_HOST || "mailpit",
          port: Number(process.env.SMTP_PORT || 1025),
          secure: process.env.SMTP_SECURE === "true",
          auth: {
            user: process.env.SMTP_USER || "",
            pass: process.env.SMTP_PASS || ""
          },
          tls: {
            rejectUnauthorized: false
          }
        };
      }

      this.transporter = nodemailer.createTransport(config);

      // Verify connection
      await this.transporter.verify();
      console.log("✅ Email service initialized successfully");
    } catch (error) {
      this.log("error", "Email service initialization failed", {
        error: error.message
      });
      // Don't throw - allow app to continue without email
    }
  }

  async _loadTemplates() {
    try {
      const templatesDir = path.join(__dirname, "../templates/email");
      const templateFiles = await fs.readdir(templatesDir);

      for (const file of templateFiles) {
        if (file.endsWith(".html")) {
          const templateName = path.basename(file, ".html");
          const templatePath = path.join(templatesDir, file);
          this.templates[templateName] = await fs.readFile(
            templatePath,
            "utf8"
          );
        }
      }
    } catch (error) {
      this.log("warn", "Could not load email templates", {
        error: error.message
      });
      // Use fallback templates
      this._setupFallbackTemplates();
    }
  }

  _setupFallbackTemplates() {
    this.templates = {
      welcome: this._getWelcomeTemplate(),
      verification: this._getVerificationTemplate(),
      passwordReset: this._getPasswordResetTemplate(),
      twoFactor: this._getTwoFactorTemplate(),
      invite: this._getInviteTemplate(),
      securityAlert: this._getSecurityAlertTemplate()
    };
  }

  async sendEmail(to, subject, html, text = null) {
    if (!this.transporter) {
      throw new EmailTransporterError("Email service not initialized");
    }

    const mailOptions = {
      from: process.env.MAIL_FROM || '"DApp" <no-reply@dapp.local>',
      to,
      subject,
      html,
      text: text || this.htmlToText(html)
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      this.log("info", `Email sent to ${to}`, { messageId: result.messageId });
      return result;
    } catch (error) {
      this.log("error", `Failed to send email to ${to}`, {
        error: error.message
      });
      throw new EmailServiceError(
        `Failed to send email to ${to}`,
        "EMAIL_SEND_FAILED",
        { originalError: error.message }
      );
    }
  }

  async sendWelcomeEmail(user) {
    const subject = "Welcome to DApp! 🚀";
    const html = this.templates.welcome
      .replace("{{userName}}", user.name)
      .replace("{{userEmail}}", user.email)
      .replace(
        "{{verificationLink}}",
        `${process.env.FRONTEND_URL}/verify-email?token=${user.verificationToken}`
      );

    return this.sendEmail(user.email, subject, html);
  }

  async sendVerificationEmail(user, verificationToken) {
    const subject = "Verify Your Email Address";
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    const html = this.templates.verification
      .replace("{{userName}}", user.name)
      .replace("{{verificationLink}}", verificationUrl)
      .replace("{{verificationCode}}", verificationToken.substring(0, 6));

    return this.sendEmail(user.email, subject, html);
  }

  async sendPasswordResetEmail(user, resetToken) {
    const subject = "Reset Your Password";
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const html = this.templates.passwordReset
      .replace("{{userName}}", user.name)
      .replace("{{resetLink}}", resetUrl)
      .replace("{{resetCode}}", resetToken.substring(0, 6));

    return this.sendEmail(user.email, subject, html);
  }

  async sendTwoFactorEmail(user, twoFactorCode) {
    const subject = "Your 2FA Code";

    const html = this.templates.twoFactor
      .replace("{{userName}}", user.name)
      .replace("{{twoFactorCode}}", twoFactorCode)
      .replace("{{expiryMinutes}}", "10");

    return this.sendEmail(user.email, subject, html);
  }

  async sendInviteEmail(email, inviteCode, invitedBy) {
    const subject = "You're Invited to Join DApp!";
    const inviteUrl = `${process.env.FRONTEND_URL}/register?invite=${inviteCode}`;

    const html = this.templates.invite
      .replace("{{invitedBy}}", invitedBy.name)
      .replace("{{inviteLink}}", inviteUrl)
      .replace("{{inviteCode}}", inviteCode);

    return this.sendEmail(email, subject, html);
  }

  async sendSecurityAlert(user, alertType, details = {}) {
    const subject = "Security Alert - DApp Account";

    const html = this.templates.securityAlert
      .replace("{{userName}}", user.name)
      .replace("{{alertType}}", alertType)
      .replace("{{alertDetails}}", JSON.stringify(details, null, 2))
      .replace("{{timestamp}}", new Date().toISOString());

    return this.sendEmail(user.email, subject, html);
  }

  generateVerificationToken() {
    return crypto.randomBytes(32).toString("hex");
  }

  generateTwoFactorCode() {
    return crypto.randomInt(100000, 999999).toString();
  }

  generateInviteCode() {
    return crypto.randomBytes(16).toString("hex");
  }

  htmlToText(html) {
    return html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();
  }

  // Private fallback templates
  _getWelcomeTemplate() {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome to DApp</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2563eb;">Welcome to DApp! 🚀</h1>
            <p>Hi {{userName}},</p>
            <p>Welcome to DApp! We're excited to have you on board.</p>
            <p>Your account has been created with the email: <strong>{{userEmail}}</strong></p>
            <p>To get started, please verify your email address:</p>
            <a href="{{verificationLink}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify Email</a>
            <p>If you have any questions, feel free to reach out to our support team.</p>
            <p>Best regards,<br>The DApp Team</p>
          </div>
        </body>
      </html>
    `;
  }

  _getVerificationTemplate() {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Verify Your Email</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2563eb;">Verify Your Email Address</h1>
            <p>Hi {{userName}},</p>
            <p>Please verify your email address to complete your account setup.</p>
            <p>Your verification code is: <strong style="font-size: 24px; color: #2563eb;">{{verificationCode}}</strong></p>
            <p>Or click the link below:</p>
            <a href="{{verificationLink}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify Email</a>
            <p>This link will expire in 24 hours.</p>
            <p>Best regards,<br>The DApp Team</p>
          </div>
        </body>
      </html>
    `;
  }

  _getPasswordResetTemplate() {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Reset Your Password</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #dc2626;">Reset Your Password</h1>
            <p>Hi {{userName}},</p>
            <p>We received a request to reset your password.</p>
            <p>Your reset code is: <strong style="font-size: 24px; color: #dc2626;">{{resetCode}}</strong></p>
            <p>Or click the link below:</p>
            <a href="{{resetLink}}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <p>Best regards,<br>The DApp Team</p>
          </div>
        </body>
      </html>
    `;
  }

  _getTwoFactorTemplate() {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Your 2FA Code</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #059669;">Two-Factor Authentication</h1>
            <p>Hi {{userName}},</p>
            <p>Here's your two-factor authentication code:</p>
            <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #059669; letter-spacing: 4px;">{{twoFactorCode}}</span>
            </div>
            <p>This code will expire in {{expiryMinutes}} minutes.</p>
            <p>If you didn't request this code, please contact support immediately.</p>
            <p>Best regards,<br>The DApp Team</p>
          </div>
        </body>
      </html>
    `;
  }

  _getInviteTemplate() {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>You're Invited to DApp</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #7c3aed;">You're Invited! 🎉</h1>
            <p>{{invitedBy}} has invited you to join DApp!</p>
            <p>DApp is a cutting-edge blockchain platform where you can:</p>
            <ul>
              <li>Create and trade NFTs</li>
              <li>Participate in DeFi protocols</li>
              <li>Connect with other blockchain enthusiasts</li>
              <li>Build and deploy smart contracts</li>
            </ul>
            <p>Your invite code is: <strong style="color: #7c3aed;">{{inviteCode}}</strong></p>
            <p>Click the link below to get started:</p>
            <a href="{{inviteLink}}" style="background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Join DApp</a>
            <p>This invitation will expire in 7 days.</p>
            <p>Best regards,<br>The DApp Team</p>
          </div>
        </body>
      </html>
    `;
  }

  _getSecurityAlertTemplate() {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Security Alert</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #dc2626;">Security Alert ⚠️</h1>
            <p>Hi {{userName}},</p>
            <p>We detected a security event on your account:</p>
            <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <strong>Alert Type:</strong> {{alertType}}<br>
              <strong>Time:</strong> {{timestamp}}<br>
              <strong>Details:</strong><br>
              <pre style="background-color: #f9fafb; padding: 10px; border-radius: 4px; font-size: 12px;">{{alertDetails}}</pre>
            </div>
            <p>If this wasn't you, please:</p>
            <ol>
              <li>Change your password immediately</li>
              <li>Enable two-factor authentication</li>
              <li>Contact our support team</li>
            </ol>
            <p>Best regards,<br>The DApp Security Team</p>
          </div>
        </body>
      </html>
    `;
  }

  async healthCheck() {
    try {
      if (!this.transporter) {
        return this.createSuccessResponse(
          { status: "unavailable", message: "Email service not initialized" },
          "Email service health check completed"
        );
      }

      await this.transporter.verify();
      return this.createSuccessResponse(
        { status: "healthy", message: "Email service is working" },
        "Email service health check completed"
      );
    } catch (error) {
      return this.handleError(error, "healthCheck");
    }
  }

  async shutdown() {
    try {
      if (this.transporter) {
        this.transporter.close();
        this.log("info", "Email service shutdown completed");
      }
      return this.createSuccessResponse(
        null,
        "Email service shutdown completed"
      );
    } catch (error) {
      return this.handleError(error, "shutdown");
    }
  }
}

module.exports = EmailService;
