-- Migration: Add wallet support and transaction tables
-- Up migration
-- Add wallet_address column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(42) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tx_hash VARCHAR(66) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL,
    amount DECIMAL(36, 18),
    status VARCHAR(20) DEFAULT 'pending',
    block_number BIGINT,
    gas_used BIGINT,
    gas_price BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Create indexes for transactions table
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_tx_hash ON transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_block_number ON transactions(block_number);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
-- Create audit_logs table for system events
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE
    SET NULL,
        action VARCHAR(100) NOT NULL,
        table_name VARCHAR(50),
        record_id INTEGER,
        old_values JSONB,
        new_values JSONB,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Create indexes for audit_logs table
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON audit_logs(table_name, record_id);
-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Insert default system settings
INSERT INTO system_settings (
        setting_key,
        setting_value,
        description,
        is_public
    )
VALUES (
        'maintenance_mode',
        'false',
        'Whether the system is in maintenance mode',
        true
    ),
    (
        'max_transaction_amount',
        '1000000',
        'Maximum transaction amount allowed',
        false
    ),
    (
        'rate_limit_requests_per_minute',
        '100',
        'Rate limit for API requests per minute',
        false
    ),
    (
        'session_timeout_hours',
        '24',
        'Session timeout in hours',
        false
    ) ON CONFLICT (setting_key) DO NOTHING;
-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = CURRENT_TIMESTAMP;
RETURN NEW;
END;
$$ language 'plpgsql';
-- Create triggers for updated_at
CREATE TRIGGER update_transactions_updated_at BEFORE
UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_settings_updated_at BEFORE
UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Down migration (commented out - uncomment to rollback)
/*
 DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;
 DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
 DROP FUNCTION IF EXISTS update_updated_at_column();
 
 DROP TABLE IF EXISTS audit_logs CASCADE;
 DROP TABLE IF EXISTS system_settings CASCADE;
 DROP TABLE IF EXISTS transactions CASCADE;
 
 DROP INDEX IF EXISTS idx_users_wallet_address;
 ALTER TABLE users DROP COLUMN IF EXISTS wallet_address;
 */