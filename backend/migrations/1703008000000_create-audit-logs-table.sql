-- Create audit_logs table for structured audit data
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    tenant_id INTEGER NOT NULL,
    action VARCHAR(255) NOT NULL,
    table_name VARCHAR(100),
    record_id INTEGER,
    old_values TEXT,
    new_values TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON audit_logs (table_name, record_id);
-- Add foreign key constraints
ALTER TABLE audit_logs
ADD CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE audit_logs
ADD CONSTRAINT fk_audit_logs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
-- Add comments for documentation
COMMENT ON TABLE audit_logs IS 'Structured audit log for compliance and security monitoring';
COMMENT ON COLUMN audit_logs.user_id IS 'ID of the user who performed the action';
COMMENT ON COLUMN audit_logs.tenant_id IS 'Tenant context for multi-tenant isolation';
COMMENT ON COLUMN audit_logs.action IS 'Type of action performed (e.g., login, logout, data_change)';
COMMENT ON COLUMN audit_logs.table_name IS 'Database table affected (if applicable)';
COMMENT ON COLUMN audit_logs.record_id IS 'ID of the record affected (if applicable)';
COMMENT ON COLUMN audit_logs.old_values IS 'Previous values before change (JSON)';
COMMENT ON COLUMN audit_logs.new_values IS 'New values after change (JSON)';
COMMENT ON COLUMN audit_logs.ip_address IS 'IP address of the request';
COMMENT ON COLUMN audit_logs.user_agent IS 'User agent string from the request';
COMMENT ON COLUMN audit_logs.created_at IS 'Timestamp when the audit log was created';