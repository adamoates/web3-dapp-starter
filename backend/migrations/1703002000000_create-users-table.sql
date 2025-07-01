-- Migration: Create users table
-- Up migration
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    wallet_address VARCHAR(42) UNIQUE,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = CURRENT_TIMESTAMP;
RETURN NEW;
END;
$$ language 'plpgsql';
-- Create trigger for updated_at
CREATE TRIGGER update_users_updated_at BEFORE
UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Down migration (commented out - uncomment to rollback)
/*
 DROP TRIGGER IF EXISTS update_users_updated_at ON users;
 DROP FUNCTION IF EXISTS update_updated_at_column();
 DROP TABLE IF EXISTS users CASCADE;
 */