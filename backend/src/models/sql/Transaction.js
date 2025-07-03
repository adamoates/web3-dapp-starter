class Transaction {
  constructor(pool) {
    this.pool = pool;
  }

  async create({
    userId,
    txHash,
    type,
    amount,
    status = "pending",
    blockNumber = null,
    gasUsed = null,
    gasPrice = null,
    tenantId = null
  }) {
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

    const result = await this.pool.query(
      `
      INSERT INTO transactions (user_id, tx_hash, type, amount, status, block_number, gas_used, gas_price, tenant_id) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
      RETURNING *
    `,
      [
        userId,
        txHash,
        type,
        amount,
        status,
        blockNumber,
        gasUsed,
        gasPrice,
        tenantId
      ]
    );

    return result.rows[0];
  }

  async findByHash(txHash) {
    const result = await this.pool.query(
      "SELECT * FROM transactions WHERE tx_hash = $1",
      [txHash]
    );
    return result.rows[0];
  }

  async findByUser(userId, limit = 50, offset = 0) {
    const result = await this.pool.query(
      `
      SELECT * FROM transactions 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `,
      [userId, limit, offset]
    );

    return result.rows;
  }

  async updateStatus(txHash, status, blockNumber = null) {
    const result = await this.pool.query(
      `
      UPDATE transactions 
      SET status = $1, block_number = $2, updated_at = CURRENT_TIMESTAMP 
      WHERE tx_hash = $3 
      RETURNING *
    `,
      [status, blockNumber, txHash]
    );

    return result.rows[0];
  }

  async getPendingTransactions() {
    const result = await this.pool.query(
      "SELECT * FROM transactions WHERE status = 'pending' ORDER BY created_at ASC"
    );
    return result.rows;
  }

  async getTransactionStats(userId) {
    const result = await this.pool.query(
      "SELECT COUNT(*) as total_transactions, COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_transactions, COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_transactions, COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_transactions, SUM(CASE WHEN status = 'confirmed' THEN amount ELSE 0 END) as total_amount FROM transactions WHERE user_id = $1",
      [userId]
    );
    return result.rows[0];
  }

  async deleteTransaction(txHash) {
    const result = await this.pool.query(
      "DELETE FROM transactions WHERE tx_hash = $1 RETURNING *",
      [txHash]
    );
    return result.rows[0];
  }
}

module.exports = Transaction;
