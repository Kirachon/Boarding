-- Performance-Critical Indexes for Boarding House Monitor
-- Optimized for boarding house-specific queries

-- Buildings indexes
CREATE INDEX idx_buildings_name ON buildings USING btree (name);
CREATE INDEX idx_buildings_created_at ON buildings USING btree (created_at);

-- Users indexes
CREATE INDEX idx_users_email ON users USING btree (email);
CREATE INDEX idx_users_active ON users USING btree (is_active) WHERE is_active = true;
CREATE INDEX idx_users_last_login ON users USING btree (last_login);

-- User building roles indexes
CREATE INDEX idx_user_building_roles_user ON user_building_roles USING btree (user_id);
CREATE INDEX idx_user_building_roles_building ON user_building_roles USING btree (building_id);
CREATE INDEX idx_user_building_roles_role ON user_building_roles USING btree (role);

-- Rooms indexes - Critical for availability queries
CREATE INDEX idx_rooms_building_id ON rooms USING btree (building_id);
CREATE INDEX idx_rooms_status ON rooms USING btree (status);
CREATE INDEX idx_rooms_building_status ON rooms USING btree (building_id, status) 
    WHERE status IN ('available', 'maintenance');
CREATE INDEX idx_rooms_type ON rooms USING btree (type);
CREATE INDEX idx_rooms_rate ON rooms USING btree (monthly_rate);
CREATE INDEX idx_rooms_floor ON rooms USING btree (floor_number);

-- Composite index for room search queries
CREATE INDEX idx_rooms_search ON rooms USING btree (building_id, status, type, monthly_rate);

-- Tenants indexes
CREATE INDEX idx_tenants_email ON tenants USING btree (email);
CREATE INDEX idx_tenants_status ON tenants USING btree (status);
CREATE INDEX idx_tenants_name ON tenants USING btree (last_name, first_name);
CREATE INDEX idx_tenants_phone ON tenants USING btree (phone);

-- Bookings indexes - Critical for occupancy tracking
CREATE INDEX idx_bookings_room_id ON bookings USING btree (room_id);
CREATE INDEX idx_bookings_tenant_id ON bookings USING btree (tenant_id);
CREATE INDEX idx_bookings_status ON bookings USING btree (status);
CREATE INDEX idx_bookings_dates ON bookings USING btree (start_date, end_date);
CREATE INDEX idx_bookings_active ON bookings USING btree (room_id, status) 
    WHERE status = 'active';

-- Composite index for booking conflicts detection
CREATE INDEX idx_bookings_conflict_check ON bookings USING btree (room_id, start_date, end_date, status)
    WHERE status IN ('active', 'pending');

-- Date range queries for bookings
CREATE INDEX idx_bookings_start_date ON bookings USING btree (start_date);
CREATE INDEX idx_bookings_end_date ON bookings USING btree (end_date) WHERE end_date IS NOT NULL;

-- Expenses indexes - Critical for reporting
CREATE INDEX idx_expenses_building_id ON expenses USING btree (building_id);
CREATE INDEX idx_expenses_room_id ON expenses USING btree (room_id) WHERE room_id IS NOT NULL;
CREATE INDEX idx_expenses_category ON expenses USING btree (category);
CREATE INDEX idx_expenses_date ON expenses USING btree (expense_date);
CREATE INDEX idx_expenses_amount ON expenses USING btree (amount);

-- Composite index for expense reporting queries
CREATE INDEX idx_expenses_reporting ON expenses USING btree (building_id, expense_date DESC, category);

-- Monthly expense aggregation index
CREATE INDEX idx_expenses_monthly ON expenses USING btree (building_id, date_trunc('month', expense_date));

-- Inventory indexes
CREATE INDEX idx_inventory_building_id ON inventory_items USING btree (building_id);
CREATE INDEX idx_inventory_room_id ON inventory_items USING btree (room_id) WHERE room_id IS NOT NULL;
CREATE INDEX idx_inventory_category ON inventory_items USING btree (category);
CREATE INDEX idx_inventory_name ON inventory_items USING btree (item_name);

-- Low stock alerts index
CREATE INDEX idx_inventory_alerts ON inventory_items USING btree (building_id, category) 
    WHERE quantity <= min_threshold;

-- Inventory value tracking
CREATE INDEX idx_inventory_value ON inventory_items USING btree (building_id, total_value DESC);

-- Room availability indexes - Critical for real-time updates
CREATE INDEX idx_room_availability_room_date ON room_availability USING btree (room_id, date);
CREATE INDEX idx_room_availability_date ON room_availability USING btree (date);

-- Available rooms lookup index
CREATE INDEX idx_room_availability_lookup ON room_availability USING btree (room_id, date) 
    WHERE available_slots > booked_slots;

-- Future availability index
CREATE INDEX idx_room_availability_future ON room_availability USING btree (date, room_id) 
    WHERE date >= CURRENT_DATE;

-- Audit log indexes
CREATE INDEX idx_audit_log_table_record ON audit_log USING btree (table_name, record_id);
CREATE INDEX idx_audit_log_changed_by ON audit_log USING btree (changed_by);
CREATE INDEX idx_audit_log_changed_at ON audit_log USING btree (changed_at);
CREATE INDEX idx_audit_log_action ON audit_log USING btree (action);

-- JSONB indexes for flexible queries
CREATE INDEX idx_buildings_address_gin ON buildings USING gin (address);
CREATE INDEX idx_buildings_amenities_gin ON buildings USING gin (amenities);
CREATE INDEX idx_rooms_amenities_gin ON rooms USING gin (amenities);
CREATE INDEX idx_tenants_emergency_contact_gin ON tenants USING gin (emergency_contact);
CREATE INDEX idx_tenants_identification_gin ON tenants USING gin (identification);
CREATE INDEX idx_bookings_contract_terms_gin ON bookings USING gin (contract_terms);
CREATE INDEX idx_expenses_vendor_info_gin ON expenses USING gin (vendor_info);
CREATE INDEX idx_inventory_supplier_info_gin ON inventory_items USING gin (supplier_info);

-- Partial indexes for common filtered queries
CREATE INDEX idx_active_bookings ON bookings USING btree (room_id, start_date) 
    WHERE status = 'active';

CREATE INDEX idx_available_rooms ON rooms USING btree (building_id, monthly_rate) 
    WHERE status = 'available';

CREATE INDEX idx_occupied_rooms ON rooms USING btree (building_id) 
    WHERE status = 'occupied';

CREATE INDEX idx_pending_bookings ON bookings USING btree (created_at) 
    WHERE status = 'pending';

CREATE INDEX idx_recent_expenses ON expenses USING btree (building_id, expense_date DESC) 
    WHERE expense_date >= CURRENT_DATE - INTERVAL '30 days';

-- Text search indexes for names and descriptions
CREATE INDEX idx_rooms_description_text ON rooms USING gin (to_tsvector('english', description))
    WHERE description IS NOT NULL;

CREATE INDEX idx_tenants_name_text ON tenants USING gin (to_tsvector('english', first_name || ' ' || last_name));

CREATE INDEX idx_expenses_description_text ON expenses USING gin (to_tsvector('english', description));

-- Statistics and analytics indexes
CREATE INDEX idx_bookings_monthly_stats ON bookings USING btree (
    date_trunc('month', start_date), 
    status
) WHERE status IN ('active', 'completed');

CREATE INDEX idx_revenue_tracking ON bookings USING btree (
    date_trunc('month', start_date),
    monthly_rent
) WHERE status IN ('active', 'completed');

-- Constraint indexes (automatically created but listed for completeness)
-- These are created automatically by PostgreSQL for PRIMARY KEY and UNIQUE constraints:
-- - buildings_pkey on buildings(building_id)
-- - users_pkey on users(user_id)
-- - users_email_key on users(email)
-- - rooms_pkey on rooms(room_id)
-- - rooms_building_id_room_number_key on rooms(building_id, room_number)
-- - tenants_pkey on tenants(tenant_id)
-- - tenants_email_key on tenants(email)
-- - bookings_pkey on bookings(booking_id)
-- - expenses_pkey on expenses(expense_id)
-- - inventory_items_pkey on inventory_items(item_id)
-- - room_availability_pkey on room_availability(availability_id)
-- - room_availability_room_id_date_key on room_availability(room_id, date)
-- - audit_log_pkey on audit_log(log_id)
