-- Migration: Create tenants table and add multi-tenant support

-- Up migration

-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    domain VARCHAR(255) UNIQUE,
    status VARCHAR(20) DEFAULT 'active',
    smtp_config JSONB,
    branding_config JSONB,
    blockchain_config JSONB,
    storage_config JSONB,
    settings JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for tenants table
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(domain);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_created_at ON tenants(created_at);

-- Add tenant_id to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);

-- Add tenant_id to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_id ON transactions(tenant_id);

-- Add tenant_id to user_files table
ALTER TABLE user_files ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_user_files_tenant_id ON user_files(tenant_id);

-- Add tenant_id to audit_logs table
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);

-- Create trigger for tenants updated_at timestamp
CREATE TRIGGER update_tenants_updated_at BEFORE
UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default tenant
INSERT INTO tenants (name, slug, domain, status, smtp_config, branding_config, blockchain_config, storage_config, settings)
VALUES (
    'Default Tenant',
    'default',
    'localhost',
    'active',
    '{"host": "localhost", "port": 1025, "secure": false, "from": "noreply@default.com"}',
    '{"name": "Default App", "logo": null, "primaryColor": "#3B82F6", "secondaryColor": "#1F2937"}',
    '{"network": "ethereum", "providerUrl": "http://localhost:8545", "chainId": 1337}',
    '{"maxFileSize": 10485760, "allowedTypes": ["image/*", "application/pdf"], "retentionDays": 365}',
    '{"features": {"email": true, "fileUpload": true, "blockchain": true, "queues": true}}'
) ON CONFLICT (slug) DO NOTHING;

-- Update existing records to use default tenant
UPDATE users SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default') WHERE tenant_id IS NULL;
UPDATE transactions SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default') WHERE tenant_id IS NULL;
UPDATE user_files SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default') WHERE tenant_id IS NULL;
UPDATE audit_logs SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default') WHERE tenant_id IS NULL;

-- Make tenant_id NOT NULL after setting default values
ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE transactions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE user_files ALTER COLUMN tenant_id SET NOT NULL;
