-- Seed Data for Boarding House Monitor Development
-- Sample data for testing and development

-- Insert sample buildings
INSERT INTO buildings (name, address, total_rooms, description, amenities, contact_info) VALUES
('Sunrise Boarding House', 
 '{"street": "123 Main Street", "city": "Downtown", "state": "CA", "zip": "90210", "country": "USA"}',
 20,
 'Modern boarding house in the heart of downtown with excellent amenities',
 '["wifi", "laundry", "parking", "security", "common_kitchen", "study_room"]',
 '{"phone": "+1-555-0123", "email": "info@sunriseboarding.com", "manager": "John Smith"}'
),
('Moonlight Residence', 
 '{"street": "456 Oak Avenue", "city": "Midtown", "state": "CA", "zip": "90211", "country": "USA"}',
 15,
 'Cozy boarding house perfect for students and young professionals',
 '["wifi", "laundry", "gym", "common_area", "bike_storage"]',
 '{"phone": "+1-555-0124", "email": "contact@moonlightres.com", "manager": "Sarah Johnson"}'
);

-- Insert sample users
INSERT INTO users (email, password_hash, first_name, last_name, phone, is_active, email_verified) VALUES
('admin@boardinghouse.com', '$2b$10$rOzJmZKz8qHqV7QGqNqOyOuX8VvJ9mZKz8qHqV7QGqNqOyOuX8VvJ9', 'Admin', 'User', '+1-555-0100', true, true),
('manager@sunriseboarding.com', '$2b$10$rOzJmZKz8qHqV7QGqNqOyOuX8VvJ9mZKz8qHqV7QGqNqOyOuX8VvJ9', 'John', 'Smith', '+1-555-0123', true, true),
('manager@moonlightres.com', '$2b$10$rOzJmZKz8qHqV7QGqNqOyOuX8VvJ9mZKz8qHqV7QGqNqOyOuX8VvJ9', 'Sarah', 'Johnson', '+1-555-0124', true, true);

-- Insert user building roles
INSERT INTO user_building_roles (user_id, building_id, role, granted_by) VALUES
(1, 1, 'super_admin', 1),
(1, 2, 'super_admin', 1),
(2, 1, 'house_manager', 1),
(3, 2, 'house_manager', 1);

-- Insert sample rooms for Sunrise Boarding House
INSERT INTO rooms (building_id, room_number, type, floor_number, size_sqft, amenities, status, monthly_rate, security_deposit, description) VALUES
-- Floor 1
(1, '101', 'single', 1, 120.00, '["private_bathroom", "desk", "closet", "window"]', 'available', 800.00, 400.00, 'Cozy single room with private bathroom on ground floor'),
(1, '102', 'double', 1, 180.00, '["shared_bathroom", "desk", "closet", "window"]', 'available', 600.00, 300.00, 'Shared double room with modern amenities'),
(1, '103', 'single', 1, 110.00, '["shared_bathroom", "desk", "closet"]', 'occupied', 750.00, 375.00, 'Compact single room, great value'),
(1, '104', 'triple', 1, 220.00, '["shared_bathroom", "desk", "closet", "balcony"]', 'available', 500.00, 250.00, 'Spacious triple room with balcony'),

-- Floor 2
(1, '201', 'suite', 2, 300.00, '["private_bathroom", "kitchenette", "living_area", "desk", "closet"]', 'available', 1200.00, 600.00, 'Luxury suite with kitchenette and living area'),
(1, '202', 'double', 2, 160.00, '["shared_bathroom", "desk", "closet", "window"]', 'maintenance', 650.00, 325.00, 'Double room currently under maintenance'),
(1, '203', 'single', 2, 125.00, '["private_bathroom", "desk", "closet", "window"]', 'available', 850.00, 425.00, 'Premium single room with private bathroom'),
(1, '204', 'studio', 2, 250.00, '["private_bathroom", "kitchenette", "desk", "closet"]', 'available', 1000.00, 500.00, 'Modern studio apartment style room');

-- Insert sample rooms for Moonlight Residence
INSERT INTO rooms (building_id, room_number, type, floor_number, size_sqft, amenities, status, monthly_rate, security_deposit, description) VALUES
-- Floor 1
(2, 'A1', 'single', 1, 100.00, '["shared_bathroom", "desk", "closet"]', 'available', 700.00, 350.00, 'Budget-friendly single room'),
(2, 'A2', 'double', 1, 150.00, '["shared_bathroom", "desk", "closet", "window"]', 'occupied', 550.00, 275.00, 'Comfortable double room'),
(2, 'A3', 'single', 1, 115.00, '["private_bathroom", "desk", "closet"]', 'available', 800.00, 400.00, 'Single room with private bathroom'),

-- Floor 2
(2, 'B1', 'triple', 2, 200.00, '["shared_bathroom", "desk", "closet", "study_area"]', 'available', 450.00, 225.00, 'Triple room with dedicated study area'),
(2, 'B2', 'suite', 2, 280.00, '["private_bathroom", "kitchenette", "desk", "closet"]', 'reserved', 1100.00, 550.00, 'Premium suite with modern amenities');

-- Insert sample tenants
INSERT INTO tenants (first_name, last_name, email, phone, date_of_birth, emergency_contact, identification, status) VALUES
('Alice', 'Johnson', 'alice.johnson@email.com', '+1-555-0201', '1995-03-15', 
 '{"name": "Mary Johnson", "relationship": "Mother", "phone": "+1-555-0301"}',
 '{"type": "drivers_license", "number": "DL123456789", "expiry": "2026-03-15"}', 'active'),

('Bob', 'Smith', 'bob.smith@email.com', '+1-555-0202', '1993-07-22',
 '{"name": "Robert Smith Sr.", "relationship": "Father", "phone": "+1-555-0302"}',
 '{"type": "passport", "number": "P987654321", "expiry": "2027-07-22"}', 'active'),

('Carol', 'Davis', 'carol.davis@email.com', '+1-555-0203', '1996-11-08',
 '{"name": "David Davis", "relationship": "Brother", "phone": "+1-555-0303"}',
 '{"type": "drivers_license", "number": "DL987654321", "expiry": "2025-11-08"}', 'active'),

('David', 'Wilson', 'david.wilson@email.com', '+1-555-0204', '1994-05-30',
 '{"name": "Linda Wilson", "relationship": "Mother", "phone": "+1-555-0304"}',
 '{"type": "state_id", "number": "ID456789123", "expiry": "2026-05-30"}', 'active');

-- Insert sample bookings
INSERT INTO bookings (room_id, tenant_id, start_date, end_date, monthly_rent, security_deposit, deposit_paid, status, contract_terms) VALUES
-- Active bookings
(3, 1, '2024-01-01', '2024-12-31', 750.00, 375.00, 375.00, 'active', 
 '{"lease_term": "12 months", "utilities_included": true, "pets_allowed": false}'),

(10, 2, '2024-02-01', '2024-08-31', 550.00, 275.00, 275.00, 'active',
 '{"lease_term": "6 months", "utilities_included": false, "pets_allowed": false}'),

-- Pending booking
(13, 3, '2024-09-01', '2025-02-28', 1100.00, 550.00, 0.00, 'pending',
 '{"lease_term": "6 months", "utilities_included": true, "pets_allowed": true}');

-- Insert sample expenses
INSERT INTO expenses (building_id, room_id, category, amount, description, expense_date, vendor_info, created_by) VALUES
(1, NULL, 'utilities', 450.00, 'Monthly electricity bill', '2024-07-01', 
 '{"vendor": "City Electric", "account": "ACC123456"}', 2),

(1, 3, 'maintenance', 150.00, 'Plumbing repair in room 103', '2024-07-15',
 '{"vendor": "Quick Fix Plumbing", "technician": "Mike Johnson"}', 2),

(1, NULL, 'supplies', 75.00, 'Cleaning supplies for common areas', '2024-07-20',
 '{"vendor": "Clean Supply Co", "items": ["detergent", "paper_towels", "disinfectant"]}', 2),

(2, NULL, 'utilities', 320.00, 'Monthly water and sewer bill', '2024-07-01',
 '{"vendor": "City Water Dept", "account": "WAT789012"}', 3),

(2, 10, 'maintenance', 200.00, 'Air conditioning repair', '2024-07-18',
 '{"vendor": "Cool Air HVAC", "technician": "Sarah Lee"}', 3);

-- Insert sample inventory items
INSERT INTO inventory_items (building_id, room_id, item_name, category, quantity, unit_cost, min_threshold, supplier_info, purchase_date, condition, location) VALUES
-- Sunrise Boarding House inventory
(1, NULL, 'Bed Sheets (Twin)', 'linens', 25, 15.00, 10, 
 '{"supplier": "Linen World", "contact": "+1-555-0401"}', '2024-01-15', 'good', 'Storage Room A'),

(1, NULL, 'Pillows', 'linens', 30, 12.00, 15,
 '{"supplier": "Comfort Plus", "contact": "+1-555-0402"}', '2024-01-15', 'good', 'Storage Room A'),

(1, NULL, 'Desk Chairs', 'furniture', 8, 85.00, 5,
 '{"supplier": "Office Furniture Co", "contact": "+1-555-0403"}', '2024-02-01', 'good', 'Storage Room B'),

(1, NULL, 'Vacuum Cleaner', 'appliances', 2, 150.00, 1,
 '{"supplier": "Clean Machine Inc", "contact": "+1-555-0404"}', '2024-03-01', 'excellent', 'Utility Closet'),

(1, NULL, 'All-Purpose Cleaner', 'cleaning', 12, 8.00, 5,
 '{"supplier": "Clean Supply Co", "contact": "+1-555-0405"}', '2024-07-01', 'new', 'Cleaning Closet'),

-- Moonlight Residence inventory
(2, NULL, 'Bed Sheets (Double)', 'linens', 15, 18.00, 8,
 '{"supplier": "Linen World", "contact": "+1-555-0401"}', '2024-01-20', 'good', 'Storage Area'),

(2, NULL, 'Microwave Ovens', 'appliances', 3, 120.00, 2,
 '{"supplier": "Kitchen Appliances Ltd", "contact": "+1-555-0406"}', '2024-02-15', 'good', 'Common Kitchen'),

(2, NULL, 'Toilet Paper', 'supplies', 48, 2.50, 20,
 '{"supplier": "Bulk Supply Co", "contact": "+1-555-0407"}', '2024-07-10', 'new', 'Storage Area');

-- Update room availability based on active bookings
-- This will be handled automatically by the triggers, but we can verify the data

-- Add some historical data for testing
INSERT INTO room_availability (room_id, date, available_slots, booked_slots) VALUES
-- Room 103 (occupied)
(3, CURRENT_DATE, 1, 1),
(3, CURRENT_DATE + INTERVAL '1 day', 1, 1),
(3, CURRENT_DATE + INTERVAL '2 days', 1, 1),

-- Room A2 (occupied)  
(10, CURRENT_DATE, 2, 2),
(10, CURRENT_DATE + INTERVAL '1 day', 2, 2),
(10, CURRENT_DATE + INTERVAL '2 days', 2, 2);

-- Commit the transaction
COMMIT;
