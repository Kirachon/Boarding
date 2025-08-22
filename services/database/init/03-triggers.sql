-- Real-time Triggers and Functions for Boarding House Monitor
-- Handles automatic updates and notifications

-- Function to update room availability when bookings change
CREATE OR REPLACE FUNCTION update_room_availability()
RETURNS TRIGGER AS $$
DECLARE
    room_record RECORD;
    availability_date DATE;
BEGIN
    -- Handle INSERT
    IF TG_OP = 'INSERT' THEN
        -- Update room status to occupied if booking is active
        IF NEW.status = 'active' THEN
            UPDATE rooms 
            SET status = 'occupied', updated_at = NOW()
            WHERE room_id = NEW.room_id AND status = 'available';
            
            -- Update availability tracking
            availability_date := NEW.start_date;
            WHILE availability_date <= COALESCE(NEW.end_date, NEW.start_date + INTERVAL '1 year') LOOP
                INSERT INTO room_availability (room_id, date, available_slots, booked_slots)
                VALUES (NEW.room_id, availability_date, 1, 1)
                ON CONFLICT (room_id, date) 
                DO UPDATE SET 
                    booked_slots = room_availability.booked_slots + 1,
                    available_slots = GREATEST(0, room_availability.available_slots - 1),
                    updated_at = NOW();
                
                availability_date := availability_date + INTERVAL '1 day';
            END LOOP;
        END IF;
        
        -- Send notification
        PERFORM pg_notify('room_availability_changed', 
                         json_build_object(
                             'room_id', NEW.room_id, 
                             'action', 'booking_created',
                             'booking_id', NEW.booking_id,
                             'status', NEW.status
                         )::text);
        
        RETURN NEW;
    END IF;
    
    -- Handle UPDATE
    IF TG_OP = 'UPDATE' THEN
        -- Status changed from active to something else
        IF OLD.status = 'active' AND NEW.status != 'active' THEN
            -- Check if room should become available
            IF NOT EXISTS (
                SELECT 1 FROM bookings 
                WHERE room_id = NEW.room_id 
                AND status = 'active' 
                AND booking_id != NEW.booking_id
            ) THEN
                UPDATE rooms 
                SET status = 'available', updated_at = NOW()
                WHERE room_id = NEW.room_id;
            END IF;
            
            -- Update availability tracking
            availability_date := OLD.start_date;
            WHILE availability_date <= COALESCE(OLD.end_date, OLD.start_date + INTERVAL '1 year') LOOP
                UPDATE room_availability 
                SET booked_slots = GREATEST(0, booked_slots - 1),
                    available_slots = available_slots + 1,
                    updated_at = NOW()
                WHERE room_id = OLD.room_id AND date = availability_date;
                
                availability_date := availability_date + INTERVAL '1 day';
            END LOOP;
        END IF;
        
        -- Status changed to active
        IF OLD.status != 'active' AND NEW.status = 'active' THEN
            UPDATE rooms 
            SET status = 'occupied', updated_at = NOW()
            WHERE room_id = NEW.room_id AND status = 'available';
            
            -- Update availability tracking
            availability_date := NEW.start_date;
            WHILE availability_date <= COALESCE(NEW.end_date, NEW.start_date + INTERVAL '1 year') LOOP
                INSERT INTO room_availability (room_id, date, available_slots, booked_slots)
                VALUES (NEW.room_id, availability_date, 1, 1)
                ON CONFLICT (room_id, date) 
                DO UPDATE SET 
                    booked_slots = room_availability.booked_slots + 1,
                    available_slots = GREATEST(0, room_availability.available_slots - 1),
                    updated_at = NOW();
                
                availability_date := availability_date + INTERVAL '1 day';
            END LOOP;
        END IF;
        
        -- Send notification
        PERFORM pg_notify('room_availability_changed', 
                         json_build_object(
                             'room_id', NEW.room_id, 
                             'action', 'booking_updated',
                             'booking_id', NEW.booking_id,
                             'old_status', OLD.status,
                             'new_status', NEW.status
                         )::text);
        
        RETURN NEW;
    END IF;
    
    -- Handle DELETE
    IF TG_OP = 'DELETE' THEN
        -- If deleting an active booking, update room status
        IF OLD.status = 'active' THEN
            -- Check if room should become available
            IF NOT EXISTS (
                SELECT 1 FROM bookings 
                WHERE room_id = OLD.room_id 
                AND status = 'active' 
                AND booking_id != OLD.booking_id
            ) THEN
                UPDATE rooms 
                SET status = 'available', updated_at = NOW()
                WHERE room_id = OLD.room_id;
            END IF;
            
            -- Update availability tracking
            availability_date := OLD.start_date;
            WHILE availability_date <= COALESCE(OLD.end_date, OLD.start_date + INTERVAL '1 year') LOOP
                UPDATE room_availability 
                SET booked_slots = GREATEST(0, booked_slots - 1),
                    available_slots = available_slots + 1,
                    updated_at = NOW()
                WHERE room_id = OLD.room_id AND date = availability_date;
                
                availability_date := availability_date + INTERVAL '1 day';
            END LOOP;
        END IF;
        
        -- Send notification
        PERFORM pg_notify('room_availability_changed', 
                         json_build_object(
                             'room_id', OLD.room_id, 
                             'action', 'booking_deleted',
                             'booking_id', OLD.booking_id
                         )::text);
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for room availability updates
CREATE TRIGGER room_booking_trigger
    AFTER INSERT OR UPDATE OR DELETE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_room_availability();

-- Function to create audit log entries
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (table_name, record_id, action, new_values)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (table_name, record_id, action, old_values, new_values)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (table_name, record_id, action, old_values)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to check booking conflicts
CREATE OR REPLACE FUNCTION check_booking_conflicts()
RETURNS TRIGGER AS $$
DECLARE
    conflict_count INTEGER;
BEGIN
    -- Only check for active and pending bookings
    IF NEW.status NOT IN ('active', 'pending') THEN
        RETURN NEW;
    END IF;
    
    -- Check for overlapping bookings
    SELECT COUNT(*) INTO conflict_count
    FROM bookings
    WHERE room_id = NEW.room_id
    AND booking_id != COALESCE(NEW.booking_id, -1)
    AND status IN ('active', 'pending')
    AND (
        (NEW.start_date BETWEEN start_date AND COALESCE(end_date, '2099-12-31'::date))
        OR
        (COALESCE(NEW.end_date, '2099-12-31'::date) BETWEEN start_date AND COALESCE(end_date, '2099-12-31'::date))
        OR
        (start_date BETWEEN NEW.start_date AND COALESCE(NEW.end_date, '2099-12-31'::date))
    );
    
    IF conflict_count > 0 THEN
        RAISE EXCEPTION 'Booking conflict detected for room % between % and %', 
            NEW.room_id, NEW.start_date, COALESCE(NEW.end_date, 'indefinite');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for booking conflict checking
CREATE TRIGGER check_booking_conflicts_trigger
    BEFORE INSERT OR UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION check_booking_conflicts();

-- Function to update inventory last_updated timestamp
CREATE OR REPLACE FUNCTION update_inventory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for inventory timestamp updates
CREATE TRIGGER update_inventory_timestamp_trigger
    BEFORE UPDATE ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION update_inventory_timestamp();

-- Function to send low stock notifications
CREATE OR REPLACE FUNCTION check_inventory_threshold()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if quantity dropped below threshold
    IF NEW.quantity <= NEW.min_threshold AND (OLD IS NULL OR OLD.quantity > OLD.min_threshold) THEN
        PERFORM pg_notify('low_stock_alert', 
                         json_build_object(
                             'item_id', NEW.item_id,
                             'item_name', NEW.item_name,
                             'building_id', NEW.building_id,
                             'current_quantity', NEW.quantity,
                             'min_threshold', NEW.min_threshold
                         )::text);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for low stock alerts
CREATE TRIGGER inventory_threshold_trigger
    AFTER INSERT OR UPDATE ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION check_inventory_threshold();

-- Function to validate room capacity
CREATE OR REPLACE FUNCTION validate_room_capacity()
RETURNS TRIGGER AS $$
DECLARE
    room_type_capacity INTEGER;
BEGIN
    -- Set capacity based on room type
    CASE NEW.type
        WHEN 'single' THEN room_type_capacity := 1;
        WHEN 'double' THEN room_type_capacity := 2;
        WHEN 'triple' THEN room_type_capacity := 3;
        WHEN 'quad' THEN room_type_capacity := 4;
        WHEN 'suite' THEN room_type_capacity := 4;
        WHEN 'studio' THEN room_type_capacity := 2;
        ELSE room_type_capacity := 1;
    END CASE;
    
    -- Initialize availability for new rooms
    INSERT INTO room_availability (room_id, date, available_slots, booked_slots)
    SELECT NEW.room_id, generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year', '1 day'::interval)::date, room_type_capacity, 0
    ON CONFLICT (room_id, date) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for room capacity validation
CREATE TRIGGER validate_room_capacity_trigger
    AFTER INSERT ON rooms
    FOR EACH ROW EXECUTE FUNCTION validate_room_capacity();
