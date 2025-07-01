-- Migration: Create user files table and add avatar support
-- Up migration
-- Add avatar_url to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS avatar_url TEXT;
-- Create user_files table
CREATE TABLE IF NOT EXISTS user_files (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Create indexes for user_files table
CREATE INDEX IF NOT EXISTS idx_user_files_user_id ON user_files(user_id);
CREATE INDEX IF NOT EXISTS idx_user_files_filename ON user_files(filename);
CREATE INDEX IF NOT EXISTS idx_user_files_mime_type ON user_files(mime_type);
CREATE INDEX IF NOT EXISTS idx_user_files_created_at ON user_files(created_at);
-- Create trigger for updated_at timestamp
CREATE TRIGGER update_user_files_updated_at BEFORE
UPDATE ON user_files FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Add file storage settings to system_settings
INSERT INTO system_settings (
        setting_key,
        setting_value,
        description,
        is_public
    )
VALUES (
        'max_file_size_mb',
        '10',
        'Maximum file upload size in MB',
        false
    ),
    (
        'allowed_image_types',
        'image/jpeg,image/png,image/gif,image/webp',
        'Allowed image file types',
        false
    ),
    (
        'allowed_document_types',
        'application/pdf,text/plain,application/json,application/xml',
        'Allowed document file types',
        false
    ),
    (
        'file_retention_days',
        '365',
        'Number of days to retain user files',
        false
    ),
    (
        'enable_file_compression',
        'true',
        'Enable automatic file compression',
        false
    ) ON CONFLICT (setting_key) DO NOTHING;
-- Create file_analytics table for tracking file usage
CREATE TABLE IF NOT EXISTS file_analytics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_id INTEGER REFERENCES user_files(id) ON DELETE
    SET NULL,
        action VARCHAR(50) NOT NULL,
        -- upload, download, delete, view
        file_size BIGINT,
        mime_type VARCHAR(100),
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Create indexes for file_analytics table
CREATE INDEX IF NOT EXISTS idx_file_analytics_user_id ON file_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_file_analytics_file_id ON file_analytics(file_id);
CREATE INDEX IF NOT EXISTS idx_file_analytics_action ON file_analytics(action);
CREATE INDEX IF NOT EXISTS idx_file_analytics_created_at ON file_analytics(created_at);
-- Create file_shares table for sharing files between users
CREATE TABLE IF NOT EXISTS file_shares (
    id SERIAL PRIMARY KEY,
    file_id INTEGER NOT NULL REFERENCES user_files(id) ON DELETE CASCADE,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shared_with_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission VARCHAR(20) DEFAULT 'read',
    -- read, write, admin
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(file_id, shared_with_id)
);
-- Create indexes for file_shares table
CREATE INDEX IF NOT EXISTS idx_file_shares_file_id ON file_shares(file_id);
CREATE INDEX IF NOT EXISTS idx_file_shares_owner_id ON file_shares(owner_id);
CREATE INDEX IF NOT EXISTS idx_file_shares_shared_with_id ON file_shares(shared_with_id);
CREATE INDEX IF NOT EXISTS idx_file_shares_expires_at ON file_shares(expires_at);
-- Create trigger for file_shares updated_at timestamp
CREATE TRIGGER update_file_shares_updated_at BEFORE
UPDATE ON file_shares FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Add file-related columns to user_files for enhanced metadata
ALTER TABLE user_files
ADD COLUMN IF NOT EXISTS checksum VARCHAR(64);
ALTER TABLE user_files
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE user_files
ADD COLUMN IF NOT EXISTS tags TEXT [];
ALTER TABLE user_files
ADD COLUMN IF NOT EXISTS metadata JSONB;
-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_user_files_checksum ON user_files(checksum);
CREATE INDEX IF NOT EXISTS idx_user_files_is_public ON user_files(is_public);
CREATE INDEX IF NOT EXISTS idx_user_files_tags ON user_files USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_user_files_metadata ON user_files USING GIN(metadata);
-- Create function to calculate file checksum
CREATE OR REPLACE FUNCTION calculate_file_checksum(file_data BYTEA) RETURNS VARCHAR(64) AS $$ BEGIN RETURN encode(sha256(file_data), 'hex');
END;
$$ LANGUAGE plpgsql;
-- Create function to get user storage usage
CREATE OR REPLACE FUNCTION get_user_storage_usage(user_id_param INTEGER) RETURNS TABLE(
        total_files BIGINT,
        total_size BIGINT,
        image_files BIGINT,
        document_files BIGINT,
        other_files BIGINT
    ) AS $$ BEGIN RETURN QUERY
SELECT COUNT(*)::BIGINT as total_files,
    COALESCE(SUM(file_size), 0)::BIGINT as total_size,
    COUNT(
        CASE
            WHEN mime_type LIKE 'image/%' THEN 1
        END
    )::BIGINT as image_files,
    COUNT(
        CASE
            WHEN mime_type LIKE 'application/%' THEN 1
        END
    )::BIGINT as document_files,
    COUNT(
        CASE
            WHEN mime_type NOT LIKE 'image/%'
            AND mime_type NOT LIKE 'application/%' THEN 1
        END
    )::BIGINT as other_files
FROM user_files
WHERE user_id = user_id_param;
END;
$$ LANGUAGE plpgsql;
-- Create function to cleanup expired file shares
CREATE OR REPLACE FUNCTION cleanup_expired_file_shares() RETURNS INTEGER AS $$
DECLARE deleted_count INTEGER;
BEGIN
DELETE FROM file_shares
WHERE expires_at IS NOT NULL
    AND expires_at < CURRENT_TIMESTAMP;
GET DIAGNOSTICS deleted_count = ROW_COUNT;
RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
-- Down migration (commented out - uncomment to rollback)
/*
 DROP FUNCTION IF EXISTS cleanup_expired_file_shares();
 DROP FUNCTION IF EXISTS get_user_storage_usage(INTEGER);
 DROP FUNCTION IF EXISTS calculate_file_checksum(BYTEA);
 
 DROP TRIGGER IF EXISTS update_file_shares_updated_at ON file_shares;
 DROP TRIGGER IF EXISTS update_user_files_updated_at ON user_files;
 
 DROP TABLE IF EXISTS file_shares CASCADE;
 DROP TABLE IF EXISTS file_analytics CASCADE;
 DROP TABLE IF EXISTS user_files CASCADE;
 
 ALTER TABLE users DROP COLUMN IF EXISTS avatar_url;
 
 DELETE FROM system_settings WHERE setting_key IN (
 'max_file_size_mb',
 'allowed_image_types', 
 'allowed_document_types',
 'file_retention_days',
 'enable_file_compression'
 );
 */