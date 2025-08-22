/**
 * Request Logging Middleware
 * HTTP request/response logging with performance metrics
 */

const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const config = require('../config/config');

/**
 * Generate unique request ID
 */
const requestId = (req, res, next) => {
  req.requestId = uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
};

/**
 * Custom Morgan token for request ID
 */
morgan.token('requestId', (req) => req.requestId);

/**
 * Custom Morgan token for user ID
 */
morgan.token('userId', (req) => req.user ? req.user.id : 'anonymous');

/**
 * Custom Morgan token for response time in milliseconds
 */
morgan.token('responseTimeMs', (req, res) => {
  if (!req._startAt || !res._startAt) {
    return '';
  }
  
  const ms = (res._startAt[0] - req._startAt[0]) * 1000 +
             (res._startAt[1] - req._startAt[1]) * 1e-6;
  
  return ms.toFixed(3);
});

/**
 * Custom Morgan format for structured logging
 */
const logFormat = config.nodeEnv === 'production' 
  ? ':requestId :userId :method :url :status :res[content-length] - :responseTimeMs ms ":user-agent"'
  : ':method :url :status :res[content-length] - :response-time ms';

/**
 * Morgan stream that writes to Winston logger
 */
const morganStream = {
  write: (message) => {
    // Remove trailing newline
    const cleanMessage = message.trim();
    
    // Parse the log message to extract status code
    const statusMatch = cleanMessage.match(/\s(\d{3})\s/);
    const status = statusMatch ? parseInt(statusMatch[1]) : 200;
    
    // Log at appropriate level based on status code
    if (status >= 500) {
      logger.error(cleanMessage);
    } else if (status >= 400) {
      logger.warn(cleanMessage);
    } else {
      logger.info(cleanMessage);
    }
  }
};

/**
 * Request logging middleware
 */
const requestLogger = [
  requestId,
  morgan(logFormat, {
    stream: morganStream,
    skip: (req, res) => {
      // Skip health check endpoints in production
      if (config.nodeEnv === 'production' && req.url.includes('/health')) {
        return true;
      }
      return false;
    }
  })
];

/**
 * Detailed request logging for debugging
 */
const detailedLogger = (req, res, next) => {
  if (config.nodeEnv === 'development' || config.logging.level === 'debug') {
    const startTime = Date.now();
    
    // Log request details
    logger.debug('Incoming Request:', {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      query: req.query,
      body: req.method !== 'GET' ? req.body : undefined,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Override res.json to log response
    const originalJson = res.json;
    res.json = function(data) {
      const responseTime = Date.now() - startTime;
      
      logger.debug('Outgoing Response:', {
        requestId: req.requestId,
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        responseSize: JSON.stringify(data).length,
        data: res.statusCode >= 400 ? data : undefined // Only log error responses
      });
      
      return originalJson.call(this, data);
    };
  }
  
  next();
};

/**
 * Security logging middleware
 */
const securityLogger = (req, res, next) => {
  // Log suspicious activities
  const suspiciousPatterns = [
    /\.\./,  // Path traversal
    /<script/i,  // XSS attempts
    /union.*select/i,  // SQL injection
    /javascript:/i,  // JavaScript injection
    /eval\(/i,  // Code injection
    /exec\(/i   // Command injection
  ];

  const url = req.originalUrl.toLowerCase();
  const body = JSON.stringify(req.body || {}).toLowerCase();
  const query = JSON.stringify(req.query || {}).toLowerCase();

  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(url) || pattern.test(body) || pattern.test(query)
  );

  if (isSuspicious) {
    logger.logSecurity('suspicious_request', 'high', {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      body: req.body,
      query: req.query
    });
  }

  // Log failed authentication attempts
  res.on('finish', () => {
    if (req.url.includes('/auth/') && res.statusCode === 401) {
      logger.logSecurity('failed_authentication', 'medium', {
        requestId: req.requestId,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        email: req.body ? req.body.email : undefined
      });
    }
  });

  next();
};

/**
 * Performance monitoring middleware
 */
const performanceLogger = (req, res, next) => {
  const startTime = process.hrtime.bigint();
  
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    
    // Log slow requests
    if (duration > 2000) { // Requests taking more than 2 seconds
      logger.logPerformance('slow_request', duration, {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        userId: req.user ? req.user.id : null
      });
    }
    
    // Log to metrics if enabled
    if (config.features.enableMetrics) {
      // This would integrate with a metrics system like Prometheus
      // For now, we'll just log the metric
      logger.debug('Request Metric:', {
        metric: 'http_request_duration_ms',
        value: duration,
        labels: {
          method: req.method,
          route: req.route ? req.route.path : req.originalUrl,
          status_code: res.statusCode
        }
      });
    }
  });
  
  next();
};

module.exports = {
  requestLogger,
  detailedLogger,
  securityLogger,
  performanceLogger
};
