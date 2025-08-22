-- Utility Functions for Boarding House Monitor
-- Business logic functions for common operations

-- Function to get room occupancy rate for a building
CREATE OR REPLACE FUNCTION get_building_occupancy_rate(building_id_param INTEGER, date_param DATE DEFAULT CURRENT_DATE)
RETURNS DECIMAL(5,2) AS $$
DECLARE
    total_rooms INTEGER;
    occupied_rooms INTEGER;
    occupancy_rate DECIMAL(5,2);
BEGIN
    -- Get total rooms in building
    SELECT COUNT(*) INTO total_rooms
    FROM rooms
    WHERE building_id = building_id_param
    AND status != 'out_of_order';
    
    -- Get occupied rooms
    SELECT COUNT(*) INTO occupied_rooms
    FROM rooms r
    JOIN bookings b ON r.room_id = b.room_id
    WHERE r.building_id = building_id_param
    AND b.status = 'active'
    AND date_param BETWEEN b.start_date AND COALESCE(b.end_date, '2099-12-31'::date);
    
    -- Calculate occupancy rate
    IF total_rooms > 0 THEN
        occupancy_rate := (occupied_rooms::DECIMAL / total_rooms::DECIMAL) * 100;
    ELSE
        occupancy_rate := 0;
    END IF;
    
    RETURN occupancy_rate;
END;
$$ LANGUAGE plpgsql;

-- Function to get monthly revenue for a building
CREATE OR REPLACE FUNCTION get_monthly_revenue(building_id_param INTEGER, month_param DATE DEFAULT date_trunc('month', CURRENT_DATE))
RETURNS DECIMAL(12,2) AS $$
DECLARE
    total_revenue DECIMAL(12,2);
BEGIN
    SELECT COALESCE(SUM(b.monthly_rent), 0) INTO total_revenue
    FROM bookings b
    JOIN rooms r ON b.room_id = r.room_id
    WHERE r.building_id = building_id_param
    AND b.status = 'active'
    AND date_trunc('month', month_param) BETWEEN date_trunc('month', b.start_date) 
        AND date_trunc('month', COALESCE(b.end_date, '2099-12-31'::date));
    
    RETURN total_revenue;
END;
$$ LANGUAGE plpgsql;

-- Function to get monthly expenses for a building
CREATE OR REPLACE FUNCTION get_monthly_expenses(building_id_param INTEGER, month_param DATE DEFAULT date_trunc('month', CURRENT_DATE))
RETURNS DECIMAL(12,2) AS $$
DECLARE
    total_expenses DECIMAL(12,2);
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO total_expenses
    FROM expenses
    WHERE building_id = building_id_param
    AND date_trunc('month', expense_date) = date_trunc('month', month_param);
    
    RETURN total_expenses;
END;
$$ LANGUAGE plpgsql;

-- Function to get available rooms for a date range
CREATE OR REPLACE FUNCTION get_available_rooms(
    building_id_param INTEGER,
    start_date_param DATE,
    end_date_param DATE DEFAULT NULL,
    room_type_param room_type_enum DEFAULT NULL
)
RETURNS TABLE(
    room_id INTEGER,
    room_number VARCHAR(20),
    type room_type_enum,
    monthly_rate DECIMAL(10,2),
    floor_number INTEGER,
    size_sqft DECIMAL(8,2),
    amenities JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT r.room_id, r.room_number, r.type, r.monthly_rate, r.floor_number, r.size_sqft, r.amenities
    FROM rooms r
    WHERE r.building_id = building_id_param
    AND r.status = 'available'
    AND (room_type_param IS NULL OR r.type = room_type_param)
    AND NOT EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.room_id = r.room_id
        AND b.status IN ('active', 'pending')
        AND (
            (start_date_param BETWEEN b.start_date AND COALESCE(b.end_date, '2099-12-31'::date))
            OR
            (COALESCE(end_date_param, start_date_param) BETWEEN b.start_date AND COALESCE(b.end_date, '2099-12-31'::date))
            OR
            (b.start_date BETWEEN start_date_param AND COALESCE(end_date_param, start_date_param))
        )
    )
    ORDER BY r.monthly_rate, r.room_number;
END;
$$ LANGUAGE plpgsql;

-- Function to get tenant payment history
CREATE OR REPLACE FUNCTION get_tenant_payment_summary(tenant_id_param INTEGER)
RETURNS TABLE(
    total_bookings INTEGER,
    total_rent_paid DECIMAL(12,2),
    total_deposits_paid DECIMAL(12,2),
    current_booking_id INTEGER,
    current_monthly_rent DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_bookings,
        COALESCE(SUM(monthly_rent), 0) as total_rent_paid,
        COALESCE(SUM(deposit_paid), 0) as total_deposits_paid,
        (SELECT booking_id FROM bookings WHERE tenant_id = tenant_id_param AND status = 'active' LIMIT 1) as current_booking_id,
        (SELECT monthly_rent FROM bookings WHERE tenant_id = tenant_id_param AND status = 'active' LIMIT 1) as current_monthly_rent
    FROM bookings
    WHERE tenant_id = tenant_id_param
    AND status IN ('active', 'completed');
END;
$$ LANGUAGE plpgsql;

-- Function to get low stock items
CREATE OR REPLACE FUNCTION get_low_stock_items(building_id_param INTEGER DEFAULT NULL)
RETURNS TABLE(
    item_id INTEGER,
    building_id INTEGER,
    item_name VARCHAR(100),
    category inventory_category_enum,
    current_quantity INTEGER,
    min_threshold INTEGER,
    shortage INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.item_id,
        i.building_id,
        i.item_name,
        i.category,
        i.quantity as current_quantity,
        i.min_threshold,
        (i.min_threshold - i.quantity) as shortage
    FROM inventory_items i
    WHERE (building_id_param IS NULL OR i.building_id = building_id_param)
    AND i.quantity <= i.min_threshold
    ORDER BY (i.min_threshold - i.quantity) DESC, i.item_name;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate building profitability
CREATE OR REPLACE FUNCTION get_building_profitability(
    building_id_param INTEGER,
    start_date_param DATE DEFAULT date_trunc('month', CURRENT_DATE - INTERVAL '1 month'),
    end_date_param DATE DEFAULT date_trunc('month', CURRENT_DATE) - INTERVAL '1 day'
)
RETURNS TABLE(
    period_start DATE,
    period_end DATE,
    total_revenue DECIMAL(12,2),
    total_expenses DECIMAL(12,2),
    net_profit DECIMAL(12,2),
    profit_margin DECIMAL(5,2)
) AS $$
DECLARE
    revenue DECIMAL(12,2);
    expenses DECIMAL(12,2);
    profit DECIMAL(12,2);
    margin DECIMAL(5,2);
BEGIN
    -- Calculate revenue for the period
    SELECT COALESCE(SUM(b.monthly_rent * 
        EXTRACT(days FROM LEAST(COALESCE(b.end_date, end_date_param), end_date_param) - 
                         GREATEST(b.start_date, start_date_param) + 1) / 30.0), 0)
    INTO revenue
    FROM bookings b
    JOIN rooms r ON b.room_id = r.room_id
    WHERE r.building_id = building_id_param
    AND b.status IN ('active', 'completed')
    AND b.start_date <= end_date_param
    AND COALESCE(b.end_date, '2099-12-31'::date) >= start_date_param;
    
    -- Calculate expenses for the period
    SELECT COALESCE(SUM(amount), 0)
    INTO expenses
    FROM expenses e
    WHERE e.building_id = building_id_param
    AND e.expense_date BETWEEN start_date_param AND end_date_param;
    
    -- Calculate profit and margin
    profit := revenue - expenses;
    
    IF revenue > 0 THEN
        margin := (profit / revenue) * 100;
    ELSE
        margin := 0;
    END IF;
    
    RETURN QUERY
    SELECT start_date_param, end_date_param, revenue, expenses, profit, margin;
END;
$$ LANGUAGE plpgsql;

-- Function to get room maintenance history
CREATE OR REPLACE FUNCTION get_room_maintenance_history(room_id_param INTEGER)
RETURNS TABLE(
    expense_id INTEGER,
    expense_date DATE,
    amount DECIMAL(10,2),
    description TEXT,
    vendor_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.expense_id,
        e.expense_date,
        e.amount,
        e.description,
        COALESCE(e.vendor_info->>'vendor', 'Unknown') as vendor_name
    FROM expenses e
    WHERE e.room_id = room_id_param
    AND e.category = 'maintenance'
    ORDER BY e.expense_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get booking conflicts
CREATE OR REPLACE FUNCTION check_room_booking_conflicts(
    room_id_param INTEGER,
    start_date_param DATE,
    end_date_param DATE DEFAULT NULL,
    exclude_booking_id INTEGER DEFAULT NULL
)
RETURNS TABLE(
    booking_id INTEGER,
    tenant_name TEXT,
    start_date DATE,
    end_date DATE,
    status booking_status_enum
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.booking_id,
        t.first_name || ' ' || t.last_name as tenant_name,
        b.start_date,
        b.end_date,
        b.status
    FROM bookings b
    JOIN tenants t ON b.tenant_id = t.tenant_id
    WHERE b.room_id = room_id_param
    AND (exclude_booking_id IS NULL OR b.booking_id != exclude_booking_id)
    AND b.status IN ('active', 'pending')
    AND (
        (start_date_param BETWEEN b.start_date AND COALESCE(b.end_date, '2099-12-31'::date))
        OR
        (COALESCE(end_date_param, start_date_param) BETWEEN b.start_date AND COALESCE(b.end_date, '2099-12-31'::date))
        OR
        (b.start_date BETWEEN start_date_param AND COALESCE(end_date_param, start_date_param))
    )
    ORDER BY b.start_date;
END;
$$ LANGUAGE plpgsql;

-- Function to generate occupancy report
CREATE OR REPLACE FUNCTION generate_occupancy_report(
    building_id_param INTEGER,
    report_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
    room_number VARCHAR(20),
    room_type room_type_enum,
    room_status room_status_enum,
    tenant_name TEXT,
    booking_start DATE,
    booking_end DATE,
    monthly_rent DECIMAL(10,2),
    days_occupied INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.room_number,
        r.type as room_type,
        r.status as room_status,
        CASE 
            WHEN b.booking_id IS NOT NULL THEN t.first_name || ' ' || t.last_name
            ELSE NULL
        END as tenant_name,
        b.start_date as booking_start,
        b.end_date as booking_end,
        b.monthly_rent,
        CASE 
            WHEN b.booking_id IS NOT NULL THEN 
                EXTRACT(days FROM report_date - b.start_date + 1)::INTEGER
            ELSE 0
        END as days_occupied
    FROM rooms r
    LEFT JOIN bookings b ON r.room_id = b.room_id 
        AND b.status = 'active'
        AND report_date BETWEEN b.start_date AND COALESCE(b.end_date, '2099-12-31'::date)
    LEFT JOIN tenants t ON b.tenant_id = t.tenant_id
    WHERE r.building_id = building_id_param
    ORDER BY r.room_number;
END;
$$ LANGUAGE plpgsql;
