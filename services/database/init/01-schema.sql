-- Boarding House Monitor Database Schema
-- PostgreSQL 17 with JSONB support

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE room_type_enum AS ENUM ('single', 'double', 'triple', 'quad', 'suite', 'studio');
CREATE TYPE room_status_enum AS ENUM ('available', 'occupied', 'maintenance', 'reserved', 'out_of_order');
CREATE TYPE tenant_status_enum AS ENUM ('active', 'inactive', 'pending', 'terminated');
CREATE TYPE booking_status_enum AS ENUM ('active', 'pending', 'completed', 'cancelled', 'expired');
CREATE TYPE expense_category_enum AS ENUM ('maintenance', 'utilities', 'supplies', 'marketing', 'insurance', 'taxes', 'other');
CREATE TYPE inventory_category_enum AS ENUM ('furniture', 'appliances', 'linens', 'cleaning', 'maintenance', 'electronics', 'other');
CREATE TYPE user_role_enum AS ENUM ('super_admin', 'house_owner', 'house_manager', 'house_viewer');

-- Buildings table
CREATE TABLE buildings (
    building_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address JSONB NOT NULL,
    total_rooms INTEGER NOT NULL CHECK (total_rooms > 0),
    description TEXT,
    amenities JSONB DEFAULT '[]',
    contact_info JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table for authentication and RBAC
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User roles and permissions
CREATE TABLE user_building_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    building_id INTEGER REFERENCES buildings(building_id) ON DELETE CASCADE,
    role user_role_enum NOT NULL,
    granted_by INTEGER REFERENCES users(user_id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, building_id)
);

-- Rooms table
CREATE TABLE rooms (
    room_id SERIAL PRIMARY KEY,
    building_id INTEGER REFERENCES buildings(building_id) ON DELETE CASCADE,
    room_number VARCHAR(20) NOT NULL,
    type room_type_enum NOT NULL,
    floor_number INTEGER,
    size_sqft DECIMAL(8,2),
    amenities JSONB DEFAULT '[]',
    status room_status_enum DEFAULT 'available',
    monthly_rate DECIMAL(10,2) NOT NULL CHECK (monthly_rate >= 0),
    security_deposit DECIMAL(10,2) DEFAULT 0,
    description TEXT,
    images JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(building_id, room_number)
);

-- Tenants table
CREATE TABLE tenants (
    tenant_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    date_of_birth DATE,
    emergency_contact JSONB,
    identification JSONB,
    status tenant_status_enum DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bookings table
CREATE TABLE bookings (
    booking_id SERIAL PRIMARY KEY,
    room_id INTEGER REFERENCES rooms(room_id) ON DELETE CASCADE,
    tenant_id INTEGER REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE,
    monthly_rent DECIMAL(10,2) NOT NULL CHECK (monthly_rent >= 0),
    security_deposit DECIMAL(10,2) DEFAULT 0,
    deposit_paid DECIMAL(10,2) DEFAULT 0,
    status booking_status_enum DEFAULT 'active',
    contract_terms JSONB DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (end_date IS NULL OR end_date > start_date)
);

-- Expenses table
CREATE TABLE expenses (
    expense_id SERIAL PRIMARY KEY,
    building_id INTEGER REFERENCES buildings(building_id) ON DELETE CASCADE,
    room_id INTEGER REFERENCES rooms(room_id) ON DELETE SET NULL,
    category expense_category_enum NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    description TEXT NOT NULL,
    expense_date DATE NOT NULL,
    receipt_url TEXT,
    vendor_info JSONB DEFAULT '{}',
    approved_by INTEGER REFERENCES users(user_id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_by INTEGER REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory items table
CREATE TABLE inventory_items (
    item_id SERIAL PRIMARY KEY,
    building_id INTEGER REFERENCES buildings(building_id) ON DELETE CASCADE,
    room_id INTEGER REFERENCES rooms(room_id) ON DELETE SET NULL,
    item_name VARCHAR(100) NOT NULL,
    category inventory_category_enum NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    unit_cost DECIMAL(10,2),
    total_value DECIMAL(10,2) GENERATED ALWAYS AS (quantity * COALESCE(unit_cost, 0)) STORED,
    min_threshold INTEGER DEFAULT 0,
    supplier_info JSONB DEFAULT '{}',
    purchase_date DATE,
    warranty_expiry DATE,
    condition VARCHAR(50) DEFAULT 'good',
    location VARCHAR(100),
    notes TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Room availability tracking table for real-time updates
CREATE TABLE room_availability (
    availability_id SERIAL PRIMARY KEY,
    room_id INTEGER REFERENCES rooms(room_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    available_slots INTEGER NOT NULL DEFAULT 1,
    booked_slots INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(room_id, date),
    CHECK (available_slots >= 0),
    CHECK (booked_slots >= 0),
    CHECK (booked_slots <= available_slots)
);

-- Audit log table for tracking changes
CREATE TABLE audit_log (
    log_id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values JSONB,
    new_values JSONB,
    changed_by INTEGER REFERENCES users(user_id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers to relevant tables
CREATE TRIGGER update_buildings_updated_at BEFORE UPDATE ON buildings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_room_availability_updated_at BEFORE UPDATE ON room_availability
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
