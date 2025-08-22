/**
 * Rooms Routes
 * CRUD operations for room management
 */

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const database = require('../config/database');
const auth = require('../middleware/auth');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');
const cacheService = require('../services/cacheService');
const realtimeService = require('../services/realtimeService');

const router = express.Router();

/**
 * Get all rooms with filtering and pagination
 */
router.get('/', [
  query('buildingId').optional().isInt({ min: 1 }),
  query('status').optional().isIn(['available', 'occupied', 'maintenance', 'reserved', 'out_of_order']),
  query('type').optional().isIn(['single', 'double', 'triple', 'quad', 'suite', 'studio']),
  query('minRate').optional().isFloat({ min: 0 }),
  query('maxRate').optional().isFloat({ min: 0 }),
  query('floor').optional().isInt({ min: 1 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const {
      buildingId, status, type, minRate, maxRate, floor,
      page = 1, limit = 10, search
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    let paramCount = 1;

    // Base query
    let query = `
      SELECT r.room_id, r.building_id, r.room_number, r.type, r.floor_number,
             r.size_sqft, r.amenities, r.status, r.monthly_rate, r.security_deposit,
             r.description, r.images, r.created_at, r.updated_at,
             b.name as building_name
      FROM rooms r
      JOIN buildings b ON r.building_id = b.building_id
    `;

    let countQuery = `
      SELECT COUNT(*)
      FROM rooms r
      JOIN buildings b ON r.building_id = b.building_id
    `;

    // Building filter
    if (buildingId) {
      conditions.push(`r.building_id = $${paramCount++}`);
      params.push(parseInt(buildingId));
    } else {
      // Filter by user's accessible buildings (unless super admin)
      const isSuperAdmin = req.user.roles.some(role => role.role === 'super_admin');
      if (!isSuperAdmin) {
        conditions.push(`r.building_id = ANY($${paramCount++})`);
        params.push(req.user.accessibleBuildings);
      }
    }

    // Status filter
    if (status) {
      conditions.push(`r.status = $${paramCount++}`);
      params.push(status);
    }

    // Type filter
    if (type) {
      conditions.push(`r.type = $${paramCount++}`);
      params.push(type);
    }

    // Rate range filter
    if (minRate) {
      conditions.push(`r.monthly_rate >= $${paramCount++}`);
      params.push(parseFloat(minRate));
    }
    if (maxRate) {
      conditions.push(`r.monthly_rate <= $${paramCount++}`);
      params.push(parseFloat(maxRate));
    }

    // Floor filter
    if (floor) {
      conditions.push(`r.floor_number = $${paramCount++}`);
      params.push(parseInt(floor));
    }

    // Search filter
    if (search) {
      conditions.push(`(r.room_number ILIKE $${paramCount} OR r.description ILIKE $${paramCount})`);
      params.push(`%${search}%`);
      paramCount++;
    }

    // Add WHERE clause if conditions exist
    if (conditions.length > 0) {
      const whereClause = ` WHERE ${conditions.join(' AND ')}`;
      query += whereClause;
      countQuery += whereClause;
    }

    // Add ordering and pagination
    query += ` ORDER BY b.name, r.room_number LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), offset);

    const [roomsResult, countResult] = await Promise.all([
      database.query(query, params),
      database.query(countQuery, params.slice(0, -2))
    ]);

    const rooms = roomsResult.rows;
    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      rooms,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    throw error;
  }
});

/**
 * Get room by ID
 */
router.get('/:id', auth.authorize(['super_admin', 'house_owner', 'house_manager', 'house_viewer']), async (req, res) => {
  try {
    const roomId = parseInt(req.params.id);

    const result = await database.query(`
      SELECT r.room_id, r.building_id, r.room_number, r.type, r.floor_number,
             r.size_sqft, r.amenities, r.status, r.monthly_rate, r.security_deposit,
             r.description, r.images, r.created_at, r.updated_at,
             b.name as building_name,
             CASE
               WHEN bk.booking_id IS NOT NULL THEN
                 json_build_object(
                   'bookingId', bk.booking_id,
                   'tenantName', t.first_name || ' ' || t.last_name,
                   'startDate', bk.start_date,
                   'endDate', bk.end_date,
                   'monthlyRent', bk.monthly_rent
                 )
               ELSE NULL
             END as current_booking
      FROM rooms r
      JOIN buildings b ON r.building_id = b.building_id
      LEFT JOIN bookings bk ON r.room_id = bk.room_id AND bk.status = 'active'
      LEFT JOIN tenants t ON bk.tenant_id = t.tenant_id
      WHERE r.room_id = $1
    `, [roomId]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Room not found');
    }

    res.json({ room: result.rows[0] });
  } catch (error) {
    throw error;
  }
});

/**
 * Create new room
 */
router.post('/', [
  auth.authorize(['super_admin', 'house_owner', 'house_manager']),
  body('buildingId').isInt({ min: 1 }),
  body('roomNumber').trim().isLength({ min: 1, max: 20 }),
  body('type').isIn(['single', 'double', 'triple', 'quad', 'suite', 'studio']),
  body('floorNumber').optional().isInt({ min: 1 }),
  body('sizeSqft').optional().isFloat({ min: 0 }),
  body('amenities').optional().isArray(),
  body('monthlyRate').isFloat({ min: 0 }),
  body('securityDeposit').optional().isFloat({ min: 0 }),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const {
      buildingId, roomNumber, type, floorNumber, sizeSqft,
      amenities, monthlyRate, securityDeposit, description
    } = req.body;

    const result = await database.query(`
      INSERT INTO rooms (
        building_id, room_number, type, floor_number, size_sqft,
        amenities, monthly_rate, security_deposit, description
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING room_id, building_id, room_number, type, floor_number,
                size_sqft, amenities, status, monthly_rate, security_deposit,
                description, created_at
    `, [
      buildingId, roomNumber, type, floorNumber, sizeSqft,
      JSON.stringify(amenities || []), monthlyRate, securityDeposit || 0, description
    ]);

    const room = result.rows[0];

    res.status(201).json({
      message: 'Room created successfully',
      room
    });
  } catch (error) {
    throw error;
  }
});

module.exports = router;