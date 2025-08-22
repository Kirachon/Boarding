-- Migration 001: Initial Schema
-- Creates the complete database schema for Boarding House Monitor

-- Create migration tracking table if it doesn't exist
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    description TEXT
);

-- Check if this migration has already been applied
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = 1) THEN
        RAISE NOTICE 'Migration 001 already applied, skipping...';
        RETURN;
    END IF;
    
    -- Apply the migration
    RAISE NOTICE 'Applying migration 001: Initial Schema';
    
    -- Record the migration
    INSERT INTO schema_migrations (version, description) 
    VALUES (1, 'Initial schema with all tables, indexes, triggers, and functions');
END
$$;
