/**
 * Authentication and Authorization Middleware
 * JWT-based authentication with RBAC support
 */

const jwt = require('jsonwebtoken');
const config = require('../config/config');
const logger = require('../config/logger');
const database = require('../config/database');
const redis = require('../config/redis');

/**
 * Authenticate JWT token
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No valid authentication token provided'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Check if token is blacklisted
    const isBlacklisted = await redis.exists(`blacklist:${token}`);
    if (isBlacklisted) {
      logger.logSecurity('blacklisted_token_used', 'medium', { token: token.substring(0, 20) + '...' });
      return res.status(401).json({
        error: 'Token invalid',
        message: 'Authentication token has been revoked'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.jwt.secret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience
    });

    // Check if user still exists and is active
    const userResult = await database.query(
      'SELECT user_id, email, first_name, last_name, is_active FROM users WHERE user_id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      logger.logSecurity('token_for_nonexistent_user', 'high', { userId: decoded.userId });
      return res.status(401).json({
        error: 'User not found',
        message: 'Authentication token is invalid'
      });
    }

    const user = userResult.rows[0];
    if (!user.is_active) {
      logger.logSecurity('token_for_inactive_user', 'medium', { userId: user.user_id, email: user.email });
      return res.status(401).json({
        error: 'Account disabled',
        message: 'User account has been disabled'
      });
    }

    // Get user's building roles
    const rolesResult = await database.query(`
      SELECT ubr.building_id, ubr.role, b.name as building_name
      FROM user_building_roles ubr
      JOIN buildings b ON ubr.building_id = b.building_id
      WHERE ubr.user_id = $1
    `, [user.user_id]);

    // Attach user info to request
    req.user = {
      id: user.user_id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      roles: rolesResult.rows,
      token: token
    };

    // Update last activity
    await redis.set(`user:${user.user_id}:last_activity`, Date.now(), 3600); // 1 hour TTL

    logger.logAuth('token_validated', user.user_id, user.email, true, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      logger.logSecurity('invalid_jwt_token', 'medium', { 
        error: error.message,
        ip: req.ip 
      });
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Authentication token is malformed or invalid'
      });
    }

    if (error.name === 'TokenExpiredError') {
      logger.logAuth('token_expired', null, null, false, {
        ip: req.ip,
        expiredAt: error.expiredAt
      });
      return res.status(401).json({
        error: 'Token expired',
        message: 'Authentication token has expired'
      });
    }

    logger.error('Authentication error:', error);
    return res.status(500).json({
      error: 'Authentication error',
      message: 'An error occurred during authentication'
    });
  }
};

/**
 * Check if user has required role for a building
 * @param {Array<string>} requiredRoles - Required roles
 * @param {boolean} requireBuildingAccess - Whether building access is required
 */
const authorize = (requiredRoles = [], requireBuildingAccess = true) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'User not authenticated'
        });
      }

      // Super admin has access to everything
      const isSuperAdmin = req.user.roles.some(role => role.role === 'super_admin');
      if (isSuperAdmin) {
        req.user.hasAccess = true;
        req.user.accessibleBuildings = req.user.roles.map(role => role.building_id);
        return next();
      }

      // Check building access if required
      if (requireBuildingAccess) {
        const buildingId = parseInt(req.params.buildingId || req.body.buildingId || req.query.buildingId);
        
        if (!buildingId) {
          return res.status(400).json({
            error: 'Building ID required',
            message: 'Building ID must be provided for this operation'
          });
        }

        const buildingRole = req.user.roles.find(role => role.building_id === buildingId);
        if (!buildingRole) {
          logger.logSecurity('unauthorized_building_access', 'medium', {
            userId: req.user.id,
            buildingId: buildingId,
            ip: req.ip
          });
          return res.status(403).json({
            error: 'Access denied',
            message: 'You do not have access to this building'
          });
        }

        // Check role requirements
        if (requiredRoles.length > 0 && !requiredRoles.includes(buildingRole.role)) {
          logger.logSecurity('insufficient_role_permissions', 'medium', {
            userId: req.user.id,
            buildingId: buildingId,
            userRole: buildingRole.role,
            requiredRoles: requiredRoles,
            ip: req.ip
          });
          return res.status(403).json({
            error: 'Insufficient permissions',
            message: `This operation requires one of the following roles: ${requiredRoles.join(', ')}`
          });
        }

        req.user.currentBuildingId = buildingId;
        req.user.currentRole = buildingRole.role;
      }

      // Set accessible buildings for the user
      req.user.accessibleBuildings = req.user.roles.map(role => role.building_id);
      req.user.hasAccess = true;

      next();
    } catch (error) {
      logger.error('Authorization error:', error);
      return res.status(500).json({
        error: 'Authorization error',
        message: 'An error occurred during authorization'
      });
    }
  };
};

/**
 * Check if user has any of the specified roles
 * @param {Array<string>} roles - Allowed roles
 */
const hasRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
    }

    const userRoles = req.user.roles.map(role => role.role);
    const hasRequiredRole = roles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      logger.logSecurity('insufficient_role_permissions', 'medium', {
        userId: req.user.id,
        userRoles: userRoles,
        requiredRoles: roles,
        ip: req.ip
      });
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: `This operation requires one of the following roles: ${roles.join(', ')}`
      });
    }

    next();
  };
};

/**
 * Optional authentication - doesn't fail if no token provided
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(); // Continue without authentication
  }

  // If token is provided, validate it
  return authenticate(req, res, next);
};

/**
 * Rate limiting for authentication attempts
 */
const authRateLimit = async (req, res, next) => {
  try {
    const key = `auth_attempts:${req.ip}`;
    const attempts = await redis.get(key) || 0;

    if (attempts >= config.security.maxLoginAttempts) {
      const ttl = await redis.client.ttl(config.redis.keyPrefix + key);
      logger.logSecurity('rate_limit_exceeded', 'high', {
        ip: req.ip,
        attempts: attempts,
        ttl: ttl
      });
      
      return res.status(429).json({
        error: 'Too many attempts',
        message: 'Too many authentication attempts. Please try again later.',
        retryAfter: ttl > 0 ? ttl : config.security.lockoutDuration / 1000
      });
    }

    req.authAttempts = attempts;
    next();
  } catch (error) {
    logger.error('Auth rate limit error:', error);
    next(); // Continue on error to avoid blocking legitimate requests
  }
};

/**
 * Record failed authentication attempt
 */
const recordFailedAttempt = async (req) => {
  try {
    const key = `auth_attempts:${req.ip}`;
    const attempts = await redis.incr(key);
    
    if (attempts === 1) {
      await redis.expire(key, config.security.lockoutDuration / 1000);
    }

    logger.logSecurity('failed_auth_attempt', 'medium', {
      ip: req.ip,
      attempts: attempts,
      email: req.body.email
    });
  } catch (error) {
    logger.error('Failed to record auth attempt:', error);
  }
};

/**
 * Clear authentication attempts on successful login
 */
const clearAuthAttempts = async (req) => {
  try {
    const key = `auth_attempts:${req.ip}`;
    await redis.del(key);
  } catch (error) {
    logger.error('Failed to clear auth attempts:', error);
  }
};

module.exports = {
  authenticate,
  authorize,
  hasRole,
  optionalAuth,
  authRateLimit,
  recordFailedAttempt,
  clearAuthAttempts
};
