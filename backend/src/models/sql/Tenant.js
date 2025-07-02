const crypto = require("crypto");

class Tenant {
  constructor(pool) {
    this.pool = pool;
  }

  async create({
    name,
    slug,
    domain = null,
    status = "active",
    smtpConfig = null,
    brandingConfig = null,
    blockchainConfig = null,
    storageConfig = null,
    settings = null
  }) {
    const result = await this.pool.query(
      `
      INSERT INTO tenants (name, slug, domain, status, smtp_config, branding_config, blockchain_config, storage_config, settings) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
      RETURNING *
    `,
      [
        name,
        slug,
        domain,
        status,
        JSON.stringify(smtpConfig),
        JSON.stringify(brandingConfig),
        JSON.stringify(blockchainConfig),
        JSON.stringify(storageConfig),
        JSON.stringify(settings)
      ]
    );

    return result.rows[0];
  }

  async findBySlug(slug) {
    const result = await this.pool.query(
      "SELECT * FROM tenants WHERE slug = $1 AND status = 'active'",
      [slug]
    );
    return result.rows[0];
  }

  async findById(id) {
    const result = await this.pool.query(
      "SELECT * FROM tenants WHERE id = $1 AND status = 'active'",
      [id]
    );
    return result.rows[0];
  }

  async findByDomain(domain) {
    const result = await this.pool.query(
      "SELECT * FROM tenants WHERE domain = $1 AND status = 'active'",
      [domain]
    );
    return result.rows[0];
  }

  async findAll(limit = 50, offset = 0) {
    const result = await this.pool.query(
      `
      SELECT * FROM tenants 
      WHERE status = 'active'
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `,
      [limit, offset]
    );

    return result.rows;
  }

  async update(id, updates) {
    const allowedFields = [
      "name",
      "domain",
      "status",
      "smtp_config",
      "branding_config",
      "blockchain_config",
      "storage_config",
      "settings"
    ];

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = $${paramCount}`);
        values.push(typeof value === "object" ? JSON.stringify(value) : value);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      throw new Error("No valid fields to update");
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    const query = `
      UPDATE tenants 
      SET ${updateFields.join(", ")} 
      WHERE id = $${paramCount} 
      RETURNING *
    `;
    values.push(id);

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async delete(id) {
    // Soft delete - set status to inactive
    const result = await this.pool.query(
      `
      UPDATE tenants 
      SET status = 'inactive', updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1 
      RETURNING *
    `,
      [id]
    );

    return result.rows[0];
  }

  async getTenantStats(tenantId) {
    const result = await this.pool.query(
      `
      SELECT 
        (SELECT COUNT(*) FROM users WHERE tenant_id = $1) as user_count,
        (SELECT COUNT(*) FROM transactions WHERE tenant_id = $1) as transaction_count,
        (SELECT COUNT(*) FROM user_files WHERE tenant_id = $1) as file_count,
        (SELECT COUNT(*) FROM audit_logs WHERE tenant_id = $1) as audit_count
      FROM tenants WHERE id = $1
    `,
      [tenantId]
    );

    return result.rows[0];
  }

  async getTenantConfig(tenantId) {
    const tenant = await this.findById(tenantId);
    if (!tenant) {
      return null;
    }

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      domain: tenant.domain,
      smtp: tenant.smtp_config,
      branding: tenant.branding_config,
      blockchain: tenant.blockchain_config,
      storage: tenant.storage_config,
      settings: tenant.settings
    };
  }

  async validateTenantAccess(tenantId, userId) {
    const result = await this.pool.query(
      "SELECT id FROM users WHERE id = $1 AND tenant_id = $2",
      [userId, tenantId]
    );

    return result.rows.length > 0;
  }

  async getDefaultTenant() {
    return await this.findBySlug("default");
  }
}

module.exports = Tenant;
