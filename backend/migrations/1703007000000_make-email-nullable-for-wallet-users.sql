-- Migration: Make email nullable for wallet-only users
-- Up migration
-- First, make email nullable
ALTER TABLE users
ALTER COLUMN email DROP NOT NULL;
-- Add a constraint to ensure either email or wallet_address is present
ALTER TABLE users
ADD CONSTRAINT users_email_or_wallet_check CHECK (
        email IS NOT NULL
        OR wallet_address IS NOT NULL
    );
-- Update the unique constraint on email to allow multiple NULL values
-- (PostgreSQL treats NULL values as distinct in unique constraints)
-- This is already handled by the existing UNIQUE constraint
-- Add comment for documentation
COMMENT ON CONSTRAINT users_email_or_wallet_check ON users IS 'Users must have either email or wallet_address';
-- Down migration (commented out - uncomment to rollback)
/*
 ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_or_wallet_check;
 ALTER TABLE users ALTER COLUMN email SET NOT NULL;
 */