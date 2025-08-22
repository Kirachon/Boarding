-- Database Backup and Restore Utilities
-- Functions for backup and restore operations

-- Function to create a full database backup
CREATE OR REPLACE FUNCTION create_database_backup(backup_name TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    backup_filename TEXT;
    backup_timestamp TEXT;
BEGIN
    -- Generate backup filename
    backup_timestamp := to_char(NOW(), 'YYYY-MM-DD_HH24-MI-SS');
    
    IF backup_name IS NULL THEN
        backup_filename := 'boarding_house_backup_' || backup_timestamp;
    ELSE
        backup_filename := backup_name || '_' || backup_timestamp;
    END IF;
    
    -- Log the backup operation
    INSERT INTO audit_log (table_name, record_id, action, new_values)
    VALUES ('database_backup', 0, 'BACKUP', 
            json_build_object('filename', backup_filename, 'timestamp', NOW()));
    
    RETURN backup_filename;
END;
$$ LANGUAGE plpgsql;

-- Function to get backup statistics
CREATE OR REPLACE FUNCTION get_backup_statistics()
RETURNS TABLE(
    total_buildings INTEGER,
    total_rooms INTEGER,
    total_tenants INTEGER,
    total_bookings INTEGER,
    total_expenses DECIMAL(12,2),
    total_inventory_items INTEGER,
    database_size TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*)::INTEGER FROM buildings) as total_buildings,
        (SELECT COUNT(*)::INTEGER FROM rooms) as total_rooms,
        (SELECT COUNT(*)::INTEGER FROM tenants) as total_tenants,
        (SELECT COUNT(*)::INTEGER FROM bookings) as total_bookings,
        (SELECT COALESCE(SUM(amount), 0) FROM expenses) as total_expenses,
        (SELECT COUNT(*)::INTEGER FROM inventory_items) as total_inventory_items,
        pg_size_pretty(pg_database_size(current_database())) as database_size;
END;
$$ LANGUAGE plpgsql;

-- Function to validate database integrity
CREATE OR REPLACE FUNCTION validate_database_integrity()
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    details TEXT
) AS $$
DECLARE
    orphaned_bookings INTEGER;
    orphaned_expenses INTEGER;
    orphaned_inventory INTEGER;
    invalid_bookings INTEGER;
    negative_amounts INTEGER;
BEGIN
    -- Check for orphaned bookings (rooms that don't exist)
    SELECT COUNT(*) INTO orphaned_bookings
    FROM bookings b
    LEFT JOIN rooms r ON b.room_id = r.room_id
    WHERE r.room_id IS NULL;
    
    -- Check for orphaned expenses (buildings that don't exist)
    SELECT COUNT(*) INTO orphaned_expenses
    FROM expenses e
    LEFT JOIN buildings b ON e.building_id = b.building_id
    WHERE b.building_id IS NULL;
    
    -- Check for orphaned inventory (buildings that don't exist)
    SELECT COUNT(*) INTO orphaned_inventory
    FROM inventory_items i
    LEFT JOIN buildings b ON i.building_id = b.building_id
    WHERE b.building_id IS NULL;
    
    -- Check for invalid booking date ranges
    SELECT COUNT(*) INTO invalid_bookings
    FROM bookings
    WHERE end_date IS NOT NULL AND end_date <= start_date;
    
    -- Check for negative amounts
    SELECT COUNT(*) INTO negative_amounts
    FROM expenses
    WHERE amount < 0;
    
    -- Return results
    RETURN QUERY VALUES
        ('Orphaned Bookings', 
         CASE WHEN orphaned_bookings = 0 THEN 'PASS' ELSE 'FAIL' END,
         orphaned_bookings || ' bookings reference non-existent rooms'),
        
        ('Orphaned Expenses',
         CASE WHEN orphaned_expenses = 0 THEN 'PASS' ELSE 'FAIL' END,
         orphaned_expenses || ' expenses reference non-existent buildings'),
        
        ('Orphaned Inventory',
         CASE WHEN orphaned_inventory = 0 THEN 'PASS' ELSE 'FAIL' END,
         orphaned_inventory || ' inventory items reference non-existent buildings'),
        
        ('Invalid Booking Dates',
         CASE WHEN invalid_bookings = 0 THEN 'PASS' ELSE 'FAIL' END,
         invalid_bookings || ' bookings have invalid date ranges'),
        
        ('Negative Amounts',
         CASE WHEN negative_amounts = 0 THEN 'PASS' ELSE 'FAIL' END,
         negative_amounts || ' expenses have negative amounts');
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old audit logs
CREATE OR REPLACE FUNCTION cleanup_audit_logs(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_log
    WHERE changed_at < NOW() - (retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log the cleanup operation
    INSERT INTO audit_log (table_name, record_id, action, new_values)
    VALUES ('audit_log_cleanup', 0, 'DELETE', 
            json_build_object('deleted_count', deleted_count, 'retention_days', retention_days));
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to reset demo data
CREATE OR REPLACE FUNCTION reset_demo_data()
RETURNS TEXT AS $$
DECLARE
    result_message TEXT;
BEGIN
    -- This function should only be used in development/demo environments
    IF current_setting('server_version_num')::INTEGER < 130000 THEN
        RAISE EXCEPTION 'This function requires PostgreSQL 13 or higher';
    END IF;
    
    -- Disable triggers temporarily
    SET session_replication_role = replica;
    
    -- Clear all data in reverse dependency order
    DELETE FROM audit_log;
    DELETE FROM room_availability;
    DELETE FROM inventory_items;
    DELETE FROM expenses;
    DELETE FROM bookings;
    DELETE FROM tenants;
    DELETE FROM rooms;
    DELETE FROM user_building_roles;
    DELETE FROM users;
    DELETE FROM buildings;
    
    -- Reset sequences
    ALTER SEQUENCE buildings_building_id_seq RESTART WITH 1;
    ALTER SEQUENCE users_user_id_seq RESTART WITH 1;
    ALTER SEQUENCE rooms_room_id_seq RESTART WITH 1;
    ALTER SEQUENCE tenants_tenant_id_seq RESTART WITH 1;
    ALTER SEQUENCE bookings_booking_id_seq RESTART WITH 1;
    ALTER SEQUENCE expenses_expense_id_seq RESTART WITH 1;
    ALTER SEQUENCE inventory_items_item_id_seq RESTART WITH 1;
    ALTER SEQUENCE room_availability_availability_id_seq RESTART WITH 1;
    ALTER SEQUENCE audit_log_log_id_seq RESTART WITH 1;
    ALTER SEQUENCE user_building_roles_id_seq RESTART WITH 1;
    
    -- Re-enable triggers
    SET session_replication_role = DEFAULT;
    
    result_message := 'Demo data reset completed successfully. All tables cleared and sequences reset.';
    
    -- Log the reset operation
    INSERT INTO audit_log (table_name, record_id, action, new_values)
    VALUES ('demo_reset', 0, 'DELETE', 
            json_build_object('message', result_message, 'timestamp', NOW()));
    
    RETURN result_message;
END;
$$ LANGUAGE plpgsql;

-- Function to get database health status
CREATE OR REPLACE FUNCTION get_database_health()
RETURNS TABLE(
    metric_name TEXT,
    metric_value TEXT,
    status TEXT
) AS $$
DECLARE
    connection_count INTEGER;
    active_queries INTEGER;
    database_size_bytes BIGINT;
    oldest_transaction_age INTERVAL;
BEGIN
    -- Get connection count
    SELECT COUNT(*) INTO connection_count
    FROM pg_stat_activity
    WHERE datname = current_database();
    
    -- Get active query count
    SELECT COUNT(*) INTO active_queries
    FROM pg_stat_activity
    WHERE datname = current_database()
    AND state = 'active'
    AND query NOT LIKE '%pg_stat_activity%';
    
    -- Get database size
    SELECT pg_database_size(current_database()) INTO database_size_bytes;
    
    -- Get oldest transaction age
    SELECT COALESCE(MAX(NOW() - xact_start), INTERVAL '0') INTO oldest_transaction_age
    FROM pg_stat_activity
    WHERE datname = current_database()
    AND xact_start IS NOT NULL;
    
    -- Return health metrics
    RETURN QUERY VALUES
        ('Total Connections', connection_count::TEXT, 
         CASE WHEN connection_count < 50 THEN 'HEALTHY' 
              WHEN connection_count < 100 THEN 'WARNING' 
              ELSE 'CRITICAL' END),
        
        ('Active Queries', active_queries::TEXT,
         CASE WHEN active_queries < 10 THEN 'HEALTHY'
              WHEN active_queries < 25 THEN 'WARNING'
              ELSE 'CRITICAL' END),
        
        ('Database Size', pg_size_pretty(database_size_bytes),
         CASE WHEN database_size_bytes < 1073741824 THEN 'HEALTHY'  -- < 1GB
              WHEN database_size_bytes < 5368709120 THEN 'WARNING'  -- < 5GB
              ELSE 'CRITICAL' END),
        
        ('Oldest Transaction', oldest_transaction_age::TEXT,
         CASE WHEN oldest_transaction_age < INTERVAL '1 hour' THEN 'HEALTHY'
              WHEN oldest_transaction_age < INTERVAL '4 hours' THEN 'WARNING'
              ELSE 'CRITICAL' END);
END;
$$ LANGUAGE plpgsql;
