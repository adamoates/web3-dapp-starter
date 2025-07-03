const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

class User {
  constructor(pool) {
    this.pool = pool;
  }

  async create({
    email,
    password,
    name,
    walletAddress = null,
    tenantId = null
  }) {
    // Handle wallet-only users
    if (!email && !walletAddress) {
      throw new Error("Either email or wallet address is required");
    }

    let passwordHash = null;
    let verificationToken = null;
    let verificationExpires = null;

    // Only hash password if email is provided
    if (email && password) {
      passwordHash = await bcrypt.hash(password, 12);
      verificationToken = crypto.randomBytes(32).toString("hex");
      verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    }

    // If no tenantId provided, get default tenant
    if (!tenantId) {
      const defaultTenantResult = await this.pool.query(
        "SELECT id FROM tenants WHERE slug = 'default' AND status = 'active'"
      );
      tenantId = defaultTenantResult.rows[0]?.id;
      if (!tenantId) {
        throw new Error("Default tenant not found");
      }
    }

    // Check if wallet address already exists
    if (walletAddress) {
      const existingWallet = await this.findByWallet(walletAddress, tenantId);
      if (existingWallet) {
        throw new Error("Wallet address already registered");
      }
    }

    // Check if email already exists
    if (email) {
      const existingEmail = await this.findByEmail(email, tenantId);
      if (existingEmail) {
        throw new Error("Email already registered");
      }
    }

    const result = await this.pool.query(
      `
      INSERT INTO users (email, password_hash, name, wallet_address, email_verification_token, email_verification_expires_at, tenant_id) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING id, email, name, wallet_address, is_verified, email_verification_token, tenant_id, created_at
    `,
      [
        email,
        passwordHash,
        name,
        walletAddress,
        verificationToken,
        verificationExpires,
        tenantId
      ]
    );

    return result.rows[0];
  }

  async findByEmail(email, tenantId = null) {
    try {
      let query = "SELECT * FROM users WHERE email = $1";
      let params = [email];

      if (tenantId) {
        query += " AND tenant_id = $2";
        params.push(tenantId);
      }

      query += " ORDER BY created_at DESC LIMIT 1";

      const result = await this.pool.query(query, params);
      return result.rows[0] || null;
    } catch (error) {
      console.error("Find by email error:", error);
      throw error;
    }
  }

  async findById(id) {
    const result = await this.pool.query("SELECT * FROM users WHERE id = $1", [
      id
    ]);
    return result.rows[0];
  }

  async findByWallet(walletAddress, tenantId = null) {
    try {
      let query = "SELECT * FROM users WHERE wallet_address = $1";
      let params = [walletAddress];

      if (tenantId) {
        query += " AND tenant_id = $2";
        params.push(tenantId);
      }

      query += " ORDER BY created_at DESC LIMIT 1";

      const result = await this.pool.query(query, params);
      return result.rows[0] || null;
    } catch (error) {
      console.error("Find by wallet error:", error);
      throw error;
    }
  }

  async findByVerificationToken(token) {
    const result = await this.pool.query(
      "SELECT * FROM users WHERE email_verification_token = $1 AND email_verification_expires_at > CURRENT_TIMESTAMP",
      [token]
    );
    return result.rows[0];
  }

  async findByPasswordResetToken(token) {
    const result = await this.pool.query(
      "SELECT * FROM users WHERE password_reset_token = $1 AND password_reset_expires_at > CURRENT_TIMESTAMP",
      [token]
    );
    return result.rows[0];
  }

  async verifyEmail(token) {
    const result = await this.pool.query(
      `
      UPDATE users 
      SET is_verified = true, 
          email_verification_token = NULL, 
          email_verification_expires_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE email_verification_token = $1 
        AND email_verification_expires_at > CURRENT_TIMESTAMP
      RETURNING id, email, name, is_verified
    `,
      [token]
    );
    return result.rows[0];
  }

  async createPasswordResetToken(email) {
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const result = await this.pool.query(
      `
      UPDATE users 
      SET password_reset_token = $1, 
          password_reset_expires_at = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE email = $3
      RETURNING id, email, name, password_reset_token
    `,
      [resetToken, resetExpires, email]
    );
    return result.rows[0];
  }

  async resetPassword(token, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, 12);

    const result = await this.pool.query(
      `
      UPDATE users 
      SET password_hash = $1, 
          password_reset_token = NULL, 
          password_reset_expires_at = NULL,
          login_attempts = 0,
          locked_until = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE password_reset_token = $2 
        AND password_reset_expires_at > CURRENT_TIMESTAMP
      RETURNING id, email, name
    `,
      [passwordHash, token]
    );
    return result.rows[0];
  }

  async resendVerificationEmail(email) {
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const result = await this.pool.query(
      `
      UPDATE users 
      SET email_verification_token = $1, 
          email_verification_expires_at = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE email = $3 AND is_verified = false
      RETURNING id, email, name, email_verification_token
    `,
      [verificationToken, verificationExpires, email]
    );
    return result.rows[0];
  }

  async enableTwoFactor(userId, secret) {
    const result = await this.pool.query(
      `
      UPDATE users 
      SET two_factor_enabled = true, 
          two_factor_secret = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, email, name, two_factor_enabled
    `,
      [secret, userId]
    );
    return result.rows[0];
  }

  async disableTwoFactor(userId) {
    const result = await this.pool.query(
      `
      UPDATE users 
      SET two_factor_enabled = false, 
          two_factor_secret = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, email, name, two_factor_enabled
    `,
      [userId]
    );
    return result.rows[0];
  }

  async recordLoginAttempt(userId, success = true) {
    if (success) {
      // Successful login
      const result = await this.pool.query(
        `
        UPDATE users 
        SET last_login_at = CURRENT_TIMESTAMP,
            login_attempts = 0,
            locked_until = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, email, name, last_login_at
      `,
        [userId]
      );
      return result.rows[0];
    } else {
      // Failed login attempt
      const result = await this.pool.query(
        `
        UPDATE users 
        SET login_attempts = login_attempts + 1,
            locked_until = CASE 
              WHEN login_attempts >= 4 THEN CURRENT_TIMESTAMP + INTERVAL '15 minutes'
              ELSE locked_until 
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, email, name, login_attempts, locked_until
      `,
        [userId]
      );
      return result.rows[0];
    }
  }

  async isAccountLocked(userId) {
    const result = await this.pool.query(
      "SELECT locked_until FROM users WHERE id = $1",
      [userId]
    );
    const user = result.rows[0];
    return (
      user && user.locked_until && new Date(user.locked_until) > new Date()
    );
  }

  async linkWallet(userId, walletAddress) {
    const result = await this.pool.query(
      `
      UPDATE users 
      SET wallet_address = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2 
      RETURNING id, email, name, wallet_address
    `,
      [walletAddress, userId]
    );

    return result.rows[0];
  }

  async updateProfile(userId, updates) {
    const allowedFields = ["name", "email", "is_verified"];
    const setClause = [];
    const values = [];
    let paramCount = 1;

    for (const [field, value] of Object.entries(updates)) {
      if (allowedFields.includes(field)) {
        setClause.push(`${field} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (setClause.length === 0) {
      throw new Error("No valid fields to update");
    }

    setClause.push("updated_at = CURRENT_TIMESTAMP");
    values.push(userId);

    const result = await this.pool.query(
      `
      UPDATE users 
      SET ${setClause.join(", ")}
      WHERE id = $${paramCount}
      RETURNING id, email, name, wallet_address, is_verified, created_at, updated_at
    `,
      values
    );

    return result.rows[0];
  }

  async validatePassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  generateToken(userId, tenantId = null, sessionId = null) {
    const payload = {
      userId,
      tenantId,
      sessionId,
      type: "access",
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, process.env.JWT_SECRET || "your-secret-key", {
      expiresIn: "24h"
    });
  }

  async verifyToken(token) {
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "your-secret-key"
      );
      return decoded;
    } catch (error) {
      return null;
    }
  }
}

module.exports = User;
