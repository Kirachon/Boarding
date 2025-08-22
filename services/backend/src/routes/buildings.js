/**
 * Buildings Routes
 * CRUD operations for buildings management
 */

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const database = require('../config/database');
const auth = require('../middleware/auth');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * Get all buildings (with pagination)
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search;

    let query = `
      SELECT building_id, name, address, total_rooms, description, 
             amenities, contact_info, created_at, updated_at
      FROM buildings
    `;
    let countQuery = 'SELECT COUNT(*) FROM buildings';
    const params = [];
    let paramCount = 1;

    // Add search filter if provided
    if (search) {
      const searchCondition = ` WHERE name ILIKE $${paramCount} OR description ILIKE $${paramCount}`;
      query += searchCondition;
      countQuery += searchCondition;
      params.push(`%${search}%`);
      paramCount++;
    }

    // Filter by user's accessible buildings (unless super admin)
    const isSuperAdmin = req.user.roles.some(role => role.role === 'super_admin');
    if (!isSuperAdmin) {
      const accessCondition = search ? ' AND ' : ' WHERE ';
      query += `${accessCondition}building_id = ANY($${paramCount})`;
      countQuery += `${accessCondition}building_id = ANY($${paramCount})`;
      params.push(req.user.accessibleBuildings);
      paramCount++;
    }

    query += ` ORDER BY name LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const [buildingsResult, countResult] = await Promise.all([
      database.query(query, params),
      database.query(countQuery, params.slice(0, -2)) // Remove limit and offset for count
    ]);

    const buildings = buildingsResult.rows;
    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    res.json({
      buildings,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    throw error;
  }
});

/**
 * Get building by ID
 */
router.get('/:id', auth.authorize(['super_admin', 'house_owner', 'house_manager', 'house_viewer']), async (req, res) => {
  try {
    const buildingId = parseInt(req.params.id);
    
    const result = await database.query(`
      SELECT building_id, name, address, total_rooms, description, 
             amenities, contact_info, created_at, updated_at
      FROM buildings 
      WHERE building_id = $1
    `, [buildingId]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Building not found');
    }

    res.json({ building: result.rows[0] });
  } catch (error) {
    throw error;
  }
});

/**
 * Create new building
 */
router.post('/', [
  auth.authorize(['super_admin', 'house_owner'], false),
  body('name').trim().isLength({ min: 1, max: 100 }),
  body('address').isObject(),
  body('totalRooms').isInt({ min: 1 }),
  body('description').optional().trim(),
  body('amenities').optional().isArray(),
  body('contactInfo').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const { name, address, totalRooms, description, amenities, contactInfo } = req.body;

    const result = await database.query(`
      INSERT INTO buildings (name, address, total_rooms, description, amenities, contact_info)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING building_id, name, address, total_rooms, description, 
                amenities, contact_info, created_at
    `, [name, JSON.stringify(address), totalRooms, description, 
        JSON.stringify(amenities || []), JSON.stringify(contactInfo || {})]);

    const building = result.rows[0];

    res.status(201).json({
      message: 'Building created successfully',
      building
    });
  } catch (error) {
    throw error;
  }
});

/**
 * Update building
 */
router.put('/:id', [
  auth.authorize(['super_admin', 'house_owner']),
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  body('address').optional().isObject(),
  body('totalRooms').optional().isInt({ min: 1 }),
  body('description').optional().trim(),
  body('amenities').optional().isArray(),
  body('contactInfo').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const buildingId = parseInt(req.params.id);
    const updates = [];
    const values = [];
    let paramCount = 1;

    // Build dynamic update query
    Object.entries(req.body).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbField = key === 'totalRooms' ? 'total_rooms' : 
                       key === 'contactInfo' ? 'contact_info' : key;
        
        if (['address', 'amenities', 'contactInfo'].includes(key)) {
          updates.push(`${dbField} = $${paramCount++}`);
          values.push(JSON.stringify(value));
        } else {
          updates.push(`${dbField} = $${paramCount++}`);
          values.push(value);
        }
      }
    });

    if (updates.length === 0) {
      throw new ValidationError('No fields to update');
    }

    values.push(buildingId);

    const result = await database.query(`
      UPDATE buildings 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE building_id = $${paramCount}
      RETURNING building_id, name, address, total_rooms, description, 
                amenities, contact_info, updated_at
    `, values);

    if (result.rows.length === 0) {
      throw new NotFoundError('Building not found');
    }

    res.json({
      message: 'Building updated successfully',
      building: result.rows[0]
    });
  } catch (error) {
    throw error;
  }
});

/**
 * Delete building
 */
router.delete('/:id', auth.authorize(['super_admin']), async (req, res) => {
  try {
    const buildingId = parseInt(req.params.id);

    const result = await database.query(
      'DELETE FROM buildings WHERE building_id = $1 RETURNING building_id',
      [buildingId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Building not found');
    }

    res.json({
      message: 'Building deleted successfully'
    });
  } catch (error) {
    throw error;
  }
});

module.exports = router;
