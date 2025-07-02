const Tenant = require("../models/sql/Tenant");
const { ServiceError } = require("../errors/ServiceErrors");

class TenantService {
  constructor(databases) {
    this.tenant = new Tenant(databases.postgres);
    this.databases = databases;
  }

  /**
   * Get tenant configuration by ID
   */
  async getTenantConfig(tenantId) {
    try {
      const config = await this.tenant.getTenantConfig(tenantId);
      if (!config) {
        throw new ServiceError(
          `Tenant not found: ${tenantId}`,
          "TENANT_NOT_FOUND"
        );
      }
      return config;
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError(
        `Failed to get tenant config: ${error.message}`,
        "TENANT_CONFIG_ERROR"
      );
    }
  }

  /**
   * Get tenant configuration by slug
   */
  async getTenantConfigBySlug(slug) {
    try {
      const tenant = await this.tenant.findBySlug(slug);
      if (!tenant) {
        throw new ServiceError(`Tenant not found: ${slug}`, "TENANT_NOT_FOUND");
      }
      return await this.getTenantConfig(tenant.id);
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError(
        `Failed to get tenant config by slug: ${error.message}`,
        "TENANT_CONFIG_ERROR"
      );
    }
  }

  /**
   * Get tenant configuration by domain
   */
  async getTenantConfigByDomain(domain) {
    try {
      const tenant = await this.tenant.findByDomain(domain);
      if (!tenant) {
        throw new ServiceError(
          `Tenant not found for domain: ${domain}`,
          "TENANT_NOT_FOUND"
        );
      }
      return await this.getTenantConfig(tenant.id);
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError(
        `Failed to get tenant config by domain: ${error.message}`,
        "TENANT_CONFIG_ERROR"
      );
    }
  }

  /**
   * Get SMTP configuration for a tenant
   */
  async getTenantSMTP(tenantId) {
    try {
      const config = await this.getTenantConfig(tenantId);
      return (
        config.smtp || {
          host: process.env.MAIL_HOST || "localhost",
          port: parseInt(process.env.MAIL_PORT) || 1025,
          secure: false,
          from: process.env.MAIL_FROM || "noreply@default.com"
        }
      );
    } catch (error) {
      throw new ServiceError(
        `Failed to get tenant SMTP config: ${error.message}`,
        "TENANT_SMTP_ERROR"
      );
    }
  }

  /**
   * Get branding configuration for a tenant
   */
  async getTenantBranding(tenantId) {
    try {
      const config = await this.getTenantConfig(tenantId);
      return (
        config.branding || {
          name: "Default App",
          logo: null,
          primaryColor: "#3B82F6",
          secondaryColor: "#1F2937"
        }
      );
    } catch (error) {
      throw new ServiceError(
        `Failed to get tenant branding config: ${error.message}`,
        "TENANT_BRANDING_ERROR"
      );
    }
  }

  /**
   * Get blockchain configuration for a tenant
   */
  async getTenantBlockchain(tenantId) {
    try {
      const config = await this.getTenantConfig(tenantId);
      return (
        config.blockchain || {
          network: "ethereum",
          providerUrl: process.env.WEB3_PROVIDER_URL || "http://localhost:8545",
          chainId: 1337
        }
      );
    } catch (error) {
      throw new ServiceError(
        `Failed to get tenant blockchain config: ${error.message}`,
        "TENANT_BLOCKCHAIN_ERROR"
      );
    }
  }

  /**
   * Get storage configuration for a tenant
   */
  async getTenantStorage(tenantId) {
    try {
      const config = await this.getTenantConfig(tenantId);
      return (
        config.storage || {
          maxFileSize: 10485760, // 10MB
          allowedTypes: ["image/*", "application/pdf"],
          retentionDays: 365
        }
      );
    } catch (error) {
      throw new ServiceError(
        `Failed to get tenant storage config: ${error.message}`,
        "TENANT_STORAGE_ERROR"
      );
    }
  }

  /**
   * Get tenant settings
   */
  async getTenantSettings(tenantId) {
    try {
      const config = await this.getTenantConfig(tenantId);
      return (
        config.settings || {
          features: {
            email: true,
            fileUpload: true,
            blockchain: true,
            queues: true
          }
        }
      );
    } catch (error) {
      throw new ServiceError(
        `Failed to get tenant settings: ${error.message}`,
        "TENANT_SETTINGS_ERROR"
      );
    }
  }

  /**
   * Check if a feature is enabled for a tenant
   */
  async isFeatureEnabled(tenantId, feature) {
    try {
      const settings = await this.getTenantSettings(tenantId);
      return settings.features?.[feature] === true;
    } catch (error) {
      console.warn(
        `Failed to check feature ${feature} for tenant ${tenantId}:`,
        error.message
      );
      return false; // Default to disabled if error
    }
  }

  /**
   * Validate tenant access for a user
   */
  async validateTenantAccess(tenantId, userId) {
    try {
      return await this.tenant.validateTenantAccess(tenantId, userId);
    } catch (error) {
      throw new ServiceError(
        `Failed to validate tenant access: ${error.message}`,
        "TENANT_ACCESS_ERROR"
      );
    }
  }

  /**
   * Create a new tenant
   */
  async createTenant(tenantData) {
    try {
      return await this.tenant.create(tenantData);
    } catch (error) {
      throw new ServiceError(
        `Failed to create tenant: ${error.message}`,
        "TENANT_CREATE_ERROR"
      );
    }
  }

  /**
   * Update tenant configuration
   */
  async updateTenant(tenantId, updates) {
    try {
      return await this.tenant.update(tenantId, updates);
    } catch (error) {
      throw new ServiceError(
        `Failed to update tenant: ${error.message}`,
        "TENANT_UPDATE_ERROR"
      );
    }
  }

  /**
   * Get tenant statistics
   */
  async getTenantStats(tenantId) {
    try {
      return await this.tenant.getTenantStats(tenantId);
    } catch (error) {
      throw new ServiceError(
        `Failed to get tenant stats: ${error.message}`,
        "TENANT_STATS_ERROR"
      );
    }
  }

  /**
   * Get default tenant
   */
  async getDefaultTenant() {
    try {
      return await this.tenant.getDefaultTenant();
    } catch (error) {
      throw new ServiceError(
        `Failed to get default tenant: ${error.message}`,
        "TENANT_DEFAULT_ERROR"
      );
    }
  }

  /**
   * Resolve tenant from request (by domain, header, or default)
   */
  async resolveTenantFromRequest(req) {
    try {
      // Try to resolve by domain first
      const host = req.get("host");
      if (host) {
        const tenant = await this.getTenantConfigByDomain(host);
        if (tenant) {
          return tenant;
        }
      }

      // Try to resolve by tenant header
      const tenantSlug = req.get("x-tenant") || req.get("tenant");
      if (tenantSlug) {
        const tenant = await this.getTenantConfigBySlug(tenantSlug);
        if (tenant) {
          return tenant;
        }
      }

      // Fall back to default tenant
      const defaultTenant = await this.getDefaultTenant();
      if (defaultTenant) {
        return await this.getTenantConfig(defaultTenant.id);
      }

      throw new ServiceError("No tenant found", "TENANT_NOT_FOUND");
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError(
        `Failed to resolve tenant: ${error.message}`,
        "TENANT_RESOLVE_ERROR"
      );
    }
  }
}

module.exports = TenantService;
