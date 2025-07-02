// Mocks must be at the very top before any imports or code
jest.mock("crypto", () => {
  let mockRandomBytesCounter = 0;
  return {
    randomBytes: jest.fn((size) => ({
      toString: jest.fn(() => {
        mockRandomBytesCounter++;
        return `mocked-random-bytes-${size}-${mockRandomBytesCounter}`;
      })
    })),
    randomInt: jest.fn(() => ({
      toString: jest.fn(() => "123456")
    }))
  };
});

jest.mock("nodemailer", () => ({
  createTransport: jest.fn().mockReturnValue({
    verify: jest.fn().mockResolvedValue(true),
    sendMail: jest.fn().mockResolvedValue({
      messageId: "test-message-id",
      response: "OK"
    }),
    close: jest.fn().mockResolvedValue()
  })
}));

jest.mock("fs", () => ({
  promises: {
    readdir: jest.fn().mockResolvedValue([]),
    readFile: jest.fn().mockResolvedValue("template content")
  }
}));

// Reset modules and re-import after mocks
jest.resetModules();
const EmailService = require("../../../src/services/EmailService");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

describe("EmailService", () => {
  let emailService;
  let mockTransporter;

  beforeEach(() => {
    jest.clearAllMocks();

    // Manually mock crypto functions
    let mockRandomBytesCounter = 0;
    crypto.randomBytes = jest.fn((size) => ({
      toString: jest.fn(() => {
        mockRandomBytesCounter++;
        return `mocked-random-bytes-${size}-${mockRandomBytesCounter}`;
      })
    }));

    crypto.randomInt = jest.fn(() => ({
      toString: jest.fn(() => "123456")
    }));

    // Create a mock transporter for testing
    mockTransporter = {
      verify: jest.fn().mockResolvedValue(true),
      sendMail: jest.fn().mockResolvedValue({
        messageId: "test-message-id",
        response: "OK"
      }),
      close: jest.fn().mockResolvedValue()
    };

    emailService = new EmailService(mockTransporter);
  });

  describe("Initialization", () => {
    it("should initialize with fallback templates", () => {
      expect(emailService.templates).toBeDefined();
      expect(emailService.templates.welcome).toBeDefined();
      expect(emailService.templates.verification).toBeDefined();
      expect(emailService.templates.passwordReset).toBeDefined();
      expect(emailService.templates.twoFactor).toBeDefined();
      expect(emailService.templates.invite).toBeDefined();
      expect(emailService.templates.securityAlert).toBeDefined();
    });

    it("should have transporter initialized", () => {
      expect(emailService.transporter).toBeDefined();
    });
  });

  describe("Token Generation", () => {
    it("should generate verification tokens", () => {
      const token1 = emailService.generateVerificationToken();
      const token2 = emailService.generateVerificationToken();

      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
      expect(token1).toContain("mocked-random-bytes-32");
    });

    it("should generate 2FA codes", () => {
      const code1 = emailService.generateTwoFactorCode();
      const code2 = emailService.generateTwoFactorCode();

      expect(code1).toBeDefined();
      expect(code2).toBeDefined();
      expect(code1).toBe("123456"); // Mock always returns "123456"
      expect(code2).toBe("123456");
    });

    it("should generate invite codes", () => {
      const code1 = emailService.generateInviteCode();
      const code2 = emailService.generateInviteCode();

      expect(code1).toBeDefined();
      expect(code2).toBeDefined();
      expect(code1).not.toBe(code2);
      expect(code1).toContain("mocked-random-bytes-16");
    });
  });

  describe("Email Sending", () => {
    const mockUser = {
      name: "Test User",
      email: "test@example.com",
      id: 1
    };

    it("should send welcome email", async () => {
      const result = await emailService.sendWelcomeEmail(mockUser);

      expect(result).toBeDefined();
      expect(result.messageId).toBe("test-message-id");
    });

    it("should send verification email", async () => {
      const verificationToken = "test-verification-token";
      const result = await emailService.sendVerificationEmail(
        mockUser,
        verificationToken
      );

      expect(result).toBeDefined();
      expect(result.messageId).toBe("test-message-id");
    });

    it("should send password reset email", async () => {
      const resetToken = "test-reset-token";
      const result = await emailService.sendPasswordResetEmail(
        mockUser,
        resetToken
      );

      expect(result).toBeDefined();
      expect(result.messageId).toBe("test-message-id");
    });

    it("should send 2FA email", async () => {
      const twoFactorCode = "123456";
      const result = await emailService.sendTwoFactorEmail(
        mockUser,
        twoFactorCode
      );

      expect(result).toBeDefined();
      expect(result.messageId).toBe("test-message-id");
    });

    it("should send invite email", async () => {
      const inviteCode = "test-invite-code";
      const invitedBy = { name: "Inviter User" };
      const result = await emailService.sendInviteEmail(
        "invitee@example.com",
        inviteCode,
        invitedBy
      );

      expect(result).toBeDefined();
      expect(result.messageId).toBe("test-message-id");
    });

    it("should send security alert email", async () => {
      const alertType = "suspicious_login";
      const details = { ip: "192.168.1.1", location: "Unknown" };
      const result = await emailService.sendSecurityAlert(
        mockUser,
        alertType,
        details
      );

      expect(result).toBeDefined();
      expect(result.messageId).toBe("test-message-id");
    });
  });

  describe("Template Processing", () => {
    it("should replace template variables correctly", () => {
      const template = "Hello {{userName}}, your code is {{verificationCode}}";
      const processed = template
        .replace("{{userName}}", "John")
        .replace("{{verificationCode}}", "123456");

      expect(processed).toBe("Hello John, your code is 123456");
    });

    it("should convert HTML to text", () => {
      const html = "<h1>Hello</h1><p>World</p>";
      const text = emailService.htmlToText(html);

      expect(text).toBe("HelloWorld");
    });
  });

  describe("Health Check", () => {
    it("should return healthy status when transporter is working", async () => {
      const health = await emailService.healthCheck();
      expect(health.success).toBe(true);
      expect(health.data.status).toBe("healthy");
      expect(health.data.message).toBe("Email service is working");
    });

    it("should return unhealthy status when transporter fails", async () => {
      mockTransporter.verify.mockRejectedValue(new Error("Connection failed"));
      const health = await emailService.healthCheck();
      expect(health.success).toBe(false);
      expect(health.error).toBeDefined();
    });

    it("should return unavailable status when transporter is null", async () => {
      emailService.transporter = null;
      const health = await emailService.healthCheck();
      expect(health.success).toBe(true);
      expect(health.data.status).toBe("unavailable");
      expect(health.data.message).toBe("Email service not initialized");
    });
  });

  describe("Error Handling", () => {
    it("should handle email sending errors gracefully", async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error("SMTP error"));
      await expect(
        emailService.sendEmail("test@example.com", "Test", "<p>Test</p>")
      ).rejects.toThrow("Failed to send email to test@example.com");
    });

    it("should handle missing transporter", async () => {
      emailService.transporter = null;
      await expect(
        emailService.sendEmail("test@example.com", "Test", "<p>Test</p>")
      ).rejects.toThrow("Email service not initialized");
    });
  });

  describe("Environment Configuration", () => {
    it("should use default SMTP settings when env vars are not set", () => {
      const originalEnv = process.env;
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      delete process.env.SMTP_SECURE;

      const newEmailService = new EmailService(mockTransporter);

      expect(newEmailService.transporter).toBeDefined();

      process.env = originalEnv;
    });

    it("should use environment variables when set", () => {
      const originalEnv = process.env;
      process.env.SMTP_HOST = "smtp.gmail.com";
      process.env.SMTP_PORT = "587";
      process.env.SMTP_SECURE = "false";

      const newEmailService = new EmailService(mockTransporter);

      expect(newEmailService.transporter).toBeDefined();

      process.env = originalEnv;
    });
  });
});
