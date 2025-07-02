-- Migration: Add email verification fields
-- Up migration
-- Add email verification fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255),
    ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255),
    ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255),
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);
CREATE INDEX IF NOT EXISTS idx_users_last_login_at ON users(last_login_at);
-- Add comments for documentation
COMMENT ON COLUMN users.email_verification_token IS 'Token for email verification';
COMMENT ON COLUMN users.email_verification_expires_at IS 'Expiration time for email verification token';
COMMENT ON COLUMN users.password_reset_token IS 'Token for password reset';
COMMENT ON COLUMN users.password_reset_expires_at IS 'Expiration time for password reset token';
COMMENT ON COLUMN users.two_factor_enabled IS 'Whether 2FA is enabled for this user';
COMMENT ON COLUMN users.two_factor_secret IS 'Secret key for 2FA';
COMMENT ON COLUMN users.last_login_at IS 'Timestamp of last login';
COMMENT ON COLUMN users.login_attempts IS 'Number of failed login attempts';
COMMENT ON COLUMN users.locked_until IS 'Account lockout until timestamp';
-- Down migration (commented out - uncomment to rollback)
/*
 DROP INDEX IF EXISTS idx_users_email_verification_token;
 DROP INDEX IF EXISTS idx_users_password_reset_token;
 DROP INDEX IF EXISTS idx_users_last_login_at;
 
 ALTER TABLE users 
 DROP COLUMN IF EXISTS email_verification_token,
 DROP COLUMN IF EXISTS email_verification_expires_at,
 DROP COLUMN IF EXISTS password_reset_token,
 DROP COLUMN IF EXISTS password_reset_expires_at,
 DROP COLUMN IF EXISTS two_factor_enabled,
 DROP COLUMN IF EXISTS two_factor_secret,
 DROP COLUMN IF EXISTS last_login_at,
 DROP COLUMN IF EXISTS login_attempts,
 DROP COLUMN IF EXISTS locked_until;
 */