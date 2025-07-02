/**
 * Interface for Email Service
 * Defines the contract that all email service implementations must follow
 */
class IEmailService {
  constructor() {
    if (this.constructor === IEmailService) {
      throw new Error(
        "IEmailService is an interface and cannot be instantiated"
      );
    }
  }

  // Core email functionality
  async sendEmail(to, subject, html, text) {
    throw new Error("sendEmail method must be implemented");
  }

  // Specific email types
  async sendWelcomeEmail(user) {
    throw new Error("sendWelcomeEmail method must be implemented");
  }

  async sendVerificationEmail(user, verificationToken) {
    throw new Error("sendVerificationEmail method must be implemented");
  }

  async sendPasswordResetEmail(user, resetToken) {
    throw new Error("sendPasswordResetEmail method must be implemented");
  }

  async sendTwoFactorEmail(user, twoFactorCode) {
    throw new Error("sendTwoFactorEmail method must be implemented");
  }

  async sendInviteEmail(inviter, invitee, inviteToken) {
    throw new Error("sendInviteEmail method must be implemented");
  }

  async sendSecurityAlert(user, alertType, details) {
    throw new Error("sendSecurityAlert method must be implemented");
  }

  // Token generation
  generateVerificationToken() {
    throw new Error("generateVerificationToken method must be implemented");
  }

  generateTwoFactorCode() {
    throw new Error("generateTwoFactorCode method must be implemented");
  }

  generateInviteCode() {
    throw new Error("generateInviteCode method must be implemented");
  }

  // Utility methods
  htmlToText(html) {
    throw new Error("htmlToText method must be implemented");
  }

  async healthCheck() {
    throw new Error("healthCheck method must be implemented");
  }
}

module.exports = IEmailService;
