/**
 * Tenants Routes
 * CRUD operations for tenant management
 */

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const database = require('../config/database');
const auth = require('../middleware/auth');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * Get all tenants with filtering and pagination
 */
router.get('/', [
  query('status').optional().isIn(['active', 'inactive', 'pending', 'terminated']),
  query('buildingId').optional().isInt({ min: 1 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const { status, buildingId, page = 1, limit = 10, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    let paramCount = 1;

    let query = `
      SELECT DISTINCT t.tenant_id, t.first_name, t.last_name, t.email, t.phone,
             t.date_of_birth, t.emergency_contact, t.identification, t.status,
             t.notes, t.created_at, t.updated_at,
             CASE
               WHEN b.booking_id IS NOT NULL THEN
                 json_build_object(
                   'bookingId', b.booking_id,
                   'roomNumber', r.room_number,
                   'buildingName', bld.name,
                   'monthlyRent', b.monthly_rent,
                   'startDate', b.start_date,
                   'endDate', b.end_date
                 )
               ELSE NULL
             END as current_booking
      FROM tenants t
      LEFT JOIN bookings b ON t.tenant_id = b.tenant_id AND b.status = 'active'
      LEFT JOIN rooms r ON b.room_id = r.room_id
      LEFT JOIN buildings bld ON r.building_id = bld.building_id
    `;

    let countQuery = `
      SELECT COUNT(DISTINCT t.tenant_id)
      FROM tenants t
      LEFT JOIN bookings b ON t.tenant_id = b.tenant_id AND b.status = 'active'
      LEFT JOIN rooms r ON b.room_id = r.room_id
      LEFT JOIN buildings bld ON r.building_id = bld.building_id
    `;

    // Status filter
    if (status) {
      conditions.push(`t.status = $${paramCount++}`);
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
        conditions.push(`(bld.building_id = ANY($${paramCount++}) OR bld.building_id IS NULL)`);
        params.push(req.user.accessibleBuildings);
      }
    }

    // Search filter
    if (search) {
      conditions.push(`(t.first_name ILIKE $${paramCount} OR t.last_name ILIKE $${paramCount} OR t.email ILIKE $${paramCount})`);
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
    query += ` ORDER BY t.last_name, t.first_name LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), offset);

    const [tenantsResult, countResult] = await Promise.all([
      database.query(query, params),
      database.query(countQuery, params.slice(0, -2))
    ]);

    const tenants = tenantsResult.rows;
    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      tenants,
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
 * Get tenant by ID
 */
router.get('/:id', auth.authorize(['super_admin', 'house_owner', 'house_manager', 'house_viewer']), async (req, res) => {
  try {
    const tenantId = parseInt(req.params.id);

    const result = await database.query(`
      SELECT t.tenant_id, t.first_name, t.last_name, t.email, t.phone,
             t.date_of_birth, t.emergency_contact, t.identification, t.status,
             t.notes, t.created_at, t.updated_at,
             json_agg(
               CASE
                 WHEN b.booking_id IS NOT NULL THEN
                   json_build_object(
                     'bookingId', b.booking_id,
                     'roomNumber', r.room_number,
                     'buildingName', bld.name,
                     'monthlyRent', b.monthly_rent,
                     'startDate', b.start_date,
                     'endDate', b.end_date,
                     'status', b.status
                   )
                 ELSE NULL
               END
             ) FILTER (WHERE b.booking_id IS NOT NULL) as bookings
      FROM tenants t
      LEFT JOIN bookings b ON t.tenant_id = b.tenant_id
      LEFT JOIN rooms r ON b.room_id = r.room_id
      LEFT JOIN buildings bld ON r.building_id = bld.building_id
      WHERE t.tenant_id = $1
      GROUP BY t.tenant_id
    `, [tenantId]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Tenant not found');
    }

    res.json({ tenant: result.rows[0] });
  } catch (error) {
    throw error;
  }
});

/**
 * Create new tenant
 */
router.post('/', [
  auth.authorize(['super_admin', 'house_owner', 'house_manager']),
  body('firstName').trim().isLength({ min: 1, max: 50 }),
  body('lastName').trim().isLength({ min: 1, max: 50 }),
  body('email').isEmail().normalizeEmail(),
  body('phone').optional().isMobilePhone(),
  body('dateOfBirth').optional().isISO8601(),
  body('emergencyContact').optional().isObject(),
  body('identification').optional().isObject(),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const {
      firstName, lastName, email, phone, dateOfBirth,
      emergencyContact, identification, notes
    } = req.body;

    const result = await database.query(`
      INSERT INTO tenants (
        first_name, last_name, email, phone, date_of_birth,
        emergency_contact, identification, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING tenant_id, first_name, last_name, email, phone,
                date_of_birth, emergency_contact, identification,
                status, notes, created_at
    `, [
      firstName, lastName, email, phone, dateOfBirth,
      JSON.stringify(emergencyContact || {}), JSON.stringify(identification || {}), notes
    ]);

    const tenant = result.rows[0];

    res.status(201).json({
      message: 'Tenant created successfully',
      tenant
    });
  } catch (error) {
    throw error;
  }
});

module.exports = router;
