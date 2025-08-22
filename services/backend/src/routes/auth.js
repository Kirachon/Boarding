/**
 * Authentication Routes
 * User registration, login, and token management
 */

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const database = require('../config/database');
const redis = require('../config/redis');
const config = require('../config/config');
const logger = require('../config/logger');
const auth = require('../middleware/auth');
const { ValidationError, UnauthorizedError } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * User registration
 */
router.post('/register', [
  auth.authRateLimit,
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  body('firstName').trim().isLength({ min: 1, max: 50 }),
  body('lastName').trim().isLength({ min: 1, max: 50 }),
  body('phone').optional().isMobilePhone()
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await auth.recordFailedAttempt(req);
      throw new ValidationError('Validation failed', errors.array());
    }

    const { email, password, firstName, lastName, phone } = req.body;

    // Check if user already exists
    const existingUser = await database.query(
      'SELECT user_id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      await auth.recordFailedAttempt(req);
      throw new ValidationError('User already exists with this email');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, config.security.bcryptRounds);

    // Create user
    const result = await database.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, phone)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING user_id, email, first_name, last_name, created_at
    `, [email, passwordHash, firstName, lastName, phone]);

    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.user_id,
        email: user.email
      },
      config.jwt.secret,
      {
        expiresIn: config.jwt.expiresIn,
        issuer: config.jwt.issuer,
        audience: config.jwt.audience
      }
    );

    // Clear auth attempts on success
    await auth.clearAuthAttempts(req);

    logger.logAuth('user_registered', user.user_id, user.email, true, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.user_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        createdAt: user.created_at
      },
      token
    });
  } catch (error) {
    throw error;
  }
});

/**
 * User login
 */
router.post('/login', [
  auth.authRateLimit,
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await auth.recordFailedAttempt(req);
      throw new ValidationError('Validation failed', errors.array());
    }

    const { email, password } = req.body;

    // Find user
    const result = await database.query(
      'SELECT user_id, email, password_hash, first_name, last_name, is_active FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      await auth.recordFailedAttempt(req);
      logger.logAuth('login_failed', null, email, false, {
        reason: 'user_not_found',
        ip: req.ip
      });
      throw new UnauthorizedError('Invalid credentials');
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.is_active) {
      await auth.recordFailedAttempt(req);
      logger.logAuth('login_failed', user.user_id, email, false, {
        reason: 'account_disabled',
        ip: req.ip
      });
      throw new UnauthorizedError('Account has been disabled');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      await auth.recordFailedAttempt(req);
      logger.logAuth('login_failed', user.user_id, email, false, {
        reason: 'invalid_password',
        ip: req.ip
      });
      throw new UnauthorizedError('Invalid credentials');
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.user_id,
        email: user.email
      },
      config.jwt.secret,
      {
        expiresIn: config.jwt.expiresIn,
        issuer: config.jwt.issuer,
        audience: config.jwt.audience
      }
    );

    // Update last login
    await database.query(
      'UPDATE users SET last_login = NOW() WHERE user_id = $1',
      [user.user_id]
    );

    // Clear auth attempts on success
    await auth.clearAuthAttempts(req);

    logger.logAuth('login_success', user.user_id, email, true, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.user_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name
      },
      token
    });
  } catch (error) {
    throw error;
  }
});

/**
 * Logout (blacklist token)
 */
router.post('/logout', auth.authenticate, async (req, res) => {
  try {
    const token = req.user.token;
    
    // Decode token to get expiration
    const decoded = jwt.decode(token);
    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
    
    // Blacklist token in Redis
    if (expiresIn > 0) {
      await redis.set(`blacklist:${token}`, true, expiresIn);
    }

    logger.logAuth('logout', req.user.id, req.user.email, true, {
      ip: req.ip
    });

    res.json({
      message: 'Logout successful'
    });
  } catch (error) {
    throw error;
  }
});

/**
 * Get current user profile
 */
router.get('/profile', auth.authenticate, async (req, res) => {
  try {
    const result = await database.query(`
      SELECT u.user_id, u.email, u.first_name, u.last_name, u.phone, 
             u.created_at, u.last_login,
             json_agg(
               json_build_object(
                 'buildingId', ubr.building_id,
                 'buildingName', b.name,
                 'role', ubr.role,
                 'grantedAt', ubr.granted_at
               )
             ) as roles
      FROM users u
      LEFT JOIN user_building_roles ubr ON u.user_id = ubr.user_id
      LEFT JOIN buildings b ON ubr.building_id = b.building_id
      WHERE u.user_id = $1
      GROUP BY u.user_id
    `, [req.user.id]);

    if (result.rows.length === 0) {
      throw new UnauthorizedError('User not found');
    }

    const user = result.rows[0];

    res.json({
      user: {
        id: user.user_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        createdAt: user.created_at,
        lastLogin: user.last_login,
        roles: user.roles.filter(role => role.buildingId !== null)
      }
    });
  } catch (error) {
    throw error;
  }
});

/**
 * Update user profile
 */
router.put('/profile', [
  auth.authenticate,
  body('firstName').optional().trim().isLength({ min: 1, max: 50 }),
  body('lastName').optional().trim().isLength({ min: 1, max: 50 }),
  body('phone').optional().isMobilePhone()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const { firstName, lastName, phone } = req.body;
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (firstName !== undefined) {
      updates.push(`first_name = $${paramCount++}`);
      values.push(firstName);
    }
    if (lastName !== undefined) {
      updates.push(`last_name = $${paramCount++}`);
      values.push(lastName);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramCount++}`);
      values.push(phone);
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update');
    }

    values.push(req.user.id);

    const result = await database.query(`
      UPDATE users 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE user_id = $${paramCount}
      RETURNING user_id, email, first_name, last_name, phone, updated_at
    `, values);

    const user = result.rows[0];

    logger.logBusiness('profile_updated', 'user', user.user_id, req.user.id, {
      updatedFields: Object.keys(req.body)
    });

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.user_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        updatedAt: user.updated_at
      }
    });
  } catch (error) {
    throw error;
  }
});

/**
 * Change password
 */
router.put('/password', [
  auth.authenticate,
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const { currentPassword, newPassword } = req.body;

    // Get current password hash
    const result = await database.query(
      'SELECT password_hash FROM users WHERE user_id = $1',
      [req.user.id]
    );

    const user = result.rows[0];

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      logger.logSecurity('invalid_password_change_attempt', 'medium', {
        userId: req.user.id,
        ip: req.ip
      });
      throw new UnauthorizedError('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, config.security.bcryptRounds);

    // Update password
    await database.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2',
      [newPasswordHash, req.user.id]
    );

    logger.logSecurity('password_changed', 'low', {
      userId: req.user.id,
      ip: req.ip
    });

    res.json({
      message: 'Password changed successfully'
    });
  } catch (error) {
    throw error;
  }
});

module.exports = router;
