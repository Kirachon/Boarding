/**
 * Bookings Routes
 * CRUD operations for booking management
 */

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const database = require('../config/database');
const auth = require('../middleware/auth');
const { ValidationError, NotFoundError, ConflictError } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * Get all bookings with filtering and pagination
 */
router.get('/', [
  query('status').optional().isIn(['active', 'pending', 'completed', 'cancelled', 'expired']),
  query('buildingId').optional().isInt({ min: 1 }),
  query('roomId').optional().isInt({ min: 1 }),
  query('tenantId').optional().isInt({ min: 1 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const {
      status, buildingId, roomId, tenantId, startDate, endDate,
      page = 1, limit = 10
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    let paramCount = 1;

    let query = `
      SELECT b.booking_id, b.room_id, b.tenant_id, b.start_date, b.end_date,
             b.monthly_rent, b.security_deposit, b.deposit_paid, b.status,
             b.contract_terms, b.notes, b.created_at, b.updated_at,
             r.room_number, r.type as room_type, bld.name as building_name,
             t.first_name || ' ' || t.last_name as tenant_name, t.email as tenant_email
      FROM bookings b
      JOIN rooms r ON b.room_id = r.room_id
      JOIN buildings bld ON r.building_id = bld.building_id
      JOIN tenants t ON b.tenant_id = t.tenant_id
    `;

    let countQuery = `
      SELECT COUNT(*)
      FROM bookings b
      JOIN rooms r ON b.room_id = r.room_id
      JOIN buildings bld ON r.building_id = bld.building_id
      JOIN tenants t ON b.tenant_id = t.tenant_id
    `;

    // Status filter
    if (status) {
      conditions.push(`b.status = $${paramCount++}`);
      params.push(status);
    }

    // Building filter
    if (buildingId) {
      conditions.push(`bld.building_id = $${paramCount++}`);
      params.push(parseInt(buildingId));
    } else {
      // Filter by user's accessible buildings (unless super admin)
      const isSuperAdmin = req.user.roles.some(role => role.role === 'super_admin');
      if (!isSuperAdmin) {
        conditions.push(`bld.building_id = ANY($${paramCount++})`);
        params.push(req.user.accessibleBuildings);
      }
    }

    // Room filter
    if (roomId) {
      conditions.push(`b.room_id = $${paramCount++}`);
      params.push(parseInt(roomId));
    }

    // Tenant filter
    if (tenantId) {
      conditions.push(`b.tenant_id = $${paramCount++}`);
      params.push(parseInt(tenantId));
    }

    // Date range filters
    if (startDate) {
      conditions.push(`b.start_date >= $${paramCount++}`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`(b.end_date IS NULL OR b.end_date <= $${paramCount++})`);
      params.push(endDate);
    }

    // Add WHERE clause if conditions exist
    if (conditions.length > 0) {
      const whereClause = ` WHERE ${conditions.join(' AND ')}`;
      query += whereClause;
      countQuery += whereClause;
    }

    // Add ordering and pagination
    query += ` ORDER BY b.start_date DESC, b.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), offset);

    const [bookingsResult, countResult] = await Promise.all([
      database.query(query, params),
      database.query(countQuery, params.slice(0, -2))
    ]);

    const bookings = bookingsResult.rows;
    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      bookings,
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
 * Create new booking
 */
router.post('/', [
  auth.authorize(['super_admin', 'house_owner', 'house_manager']),
  body('roomId').isInt({ min: 1 }),
  body('tenantId').isInt({ min: 1 }),
  body('startDate').isISO8601(),
  body('endDate').optional().isISO8601(),
  body('monthlyRent').isFloat({ min: 0 }),
  body('securityDeposit').optional().isFloat({ min: 0 }),
  body('depositPaid').optional().isFloat({ min: 0 }),
  body('contractTerms').optional().isObject(),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const {
      roomId, tenantId, startDate, endDate, monthlyRent,
      securityDeposit, depositPaid, contractTerms, notes
    } = req.body;

    // Check for booking conflicts using the database function
    const conflictCheck = await database.query(
      'SELECT * FROM check_room_booking_conflicts($1, $2, $3)',
      [roomId, startDate, endDate]
    );

    if (conflictCheck.rows.length > 0) {
      throw new ConflictError('Room is not available for the selected dates');
    }

    const result = await database.query(`
      INSERT INTO bookings (
        room_id, tenant_id, start_date, end_date, monthly_rent,
        security_deposit, deposit_paid, contract_terms, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING booking_id, room_id, tenant_id, start_date, end_date,
                monthly_rent, security_deposit, deposit_paid, status,
                contract_terms, notes, created_at
    `, [
      roomId, tenantId, startDate, endDate, monthlyRent,
      securityDeposit || 0, depositPaid || 0,
      JSON.stringify(contractTerms || {}), notes
    ]);

    const booking = result.rows[0];

    res.status(201).json({
      message: 'Booking created successfully',
      booking
    });
  } catch (error) {
    throw error;
  }
});

module.exports = router;
