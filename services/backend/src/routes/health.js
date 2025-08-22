/**
 * Health Check Routes
 * System health monitoring endpoints
 */

const express = require('express');
const database = require('../config/database');
const redis = require('../config/redis');
const config = require('../config/config');
const logger = require('../config/logger');

const router = express.Router();

/**
 * Basic health check
 */
router.get('/', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.nodeEnv,
      version: '1.0.0'
    };

    res.json(health);
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * Detailed health check with dependencies
 */
router.get('/detailed', async (req, res) => {
  try {
    const checks = {};
    let overallStatus = 'healthy';

    // Database health check
    try {
      const dbHealth = await database.healthCheck();
      checks.database = dbHealth;
      if (dbHealth.status !== 'healthy') {
        overallStatus = 'unhealthy';
      }
    } catch (error) {
      checks.database = {
        status: 'unhealthy',
        message: error.message
      };
      overallStatus = 'unhealthy';
    }

    // Redis health check
    try {
      const redisHealth = await redis.healthCheck();
      checks.redis = redisHealth;
      if (redisHealth.status !== 'healthy') {
        overallStatus = 'degraded';
      }
    } catch (error) {
      checks.redis = {
        status: 'unhealthy',
        message: error.message
      };
      if (overallStatus === 'healthy') {
        overallStatus = 'degraded';
      }
    }

    // Memory usage
    const memUsage = process.memoryUsage();
    checks.memory = {
      status: memUsage.heapUsed < 500 * 1024 * 1024 ? 'healthy' : 'warning', // 500MB threshold
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`
    };

    // CPU usage (approximate)
    const cpuUsage = process.cpuUsage();
    checks.cpu = {
      status: 'healthy',
      user: cpuUsage.user,
      system: cpuUsage.system
    };

    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.nodeEnv,
      version: '1.0.0',
      checks
    };

    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;

    res.status(statusCode).json(response);
  } catch (error) {
    logger.error('Detailed health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * Readiness probe for Kubernetes
 */
router.get('/ready', async (req, res) => {
  try {
    // Check if essential services are ready
    const dbReady = await database.healthCheck();
    
    if (dbReady.status === 'healthy') {
      res.json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        reason: 'Database not ready'
      });
    }
  } catch (error) {
    logger.error('Readiness check error:', error);
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * Liveness probe for Kubernetes
 */
router.get('/live', (req, res) => {
  // Simple liveness check - if we can respond, we're alive
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * Database-specific health check
 */
router.get('/database', async (req, res) => {
  try {
    const dbHealth = await database.healthCheck();
    const statusCode = dbHealth.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(dbHealth);
  } catch (error) {
    logger.error('Database health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * Redis-specific health check
 */
router.get('/redis', async (req, res) => {
  try {
    const redisHealth = await redis.healthCheck();
    const statusCode = redisHealth.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(redisHealth);
  } catch (error) {
    logger.error('Redis health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * System metrics endpoint
 */
router.get('/metrics', (req, res) => {
  try {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      eventLoop: {
        delay: 0 // Would need additional library for accurate measurement
      }
    };

    res.json(metrics);
  } catch (error) {
    logger.error('Metrics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
