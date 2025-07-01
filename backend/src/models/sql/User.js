const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

class User {
  constructor(pool) {
    this.pool = pool;
  }

  async create({ email, password, name, walletAddress = null }) {
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await this.pool.query(
      `
      INSERT INTO users (email, password_hash, name, wallet_address) 
      VALUES ($1, $2, $3, $4) 
      RETURNING id, email, name, wallet_address, is_verified, created_at
    `,
      [email, passwordHash, name, walletAddress]
    );

    return result.rows[0];
  }

  async findByEmail(email) {
    const result = await this.pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );
    return result.rows[0];
  }

  async findById(id) {
    const result = await this.pool.query("SELECT * FROM users WHERE id = $1", [
      id
    ]);
    return result.rows[0];
  }

  async findByWallet(walletAddress) {
    const result = await this.pool.query(
      "SELECT * FROM users WHERE wallet_address = $1",
      [walletAddress]
    );
    return result.rows[0];
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

  generateToken(userId) {
    return jwt.sign(
      { userId, type: "access" },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "24h" }
    );
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
