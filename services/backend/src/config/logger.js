/**
 * Logging Configuration
 * Winston-based logging with multiple transports
 */

const winston = require('winston');
const path = require('path');
const config = require('./config');

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    let log = `${timestamp} ${level}: ${message}`;
    if (stack) {
      log += `\n${stack}`;
    }
    return log;
  })
);

// Create transports array
const transports = [
  // Console transport
  new winston.transports.Console({
    level: config.logging.level,
    format: config.nodeEnv === 'development' ? consoleFormat : logFormat,
    handleExceptions: true,
    handleRejections: true
  })
];

// Add file transport if enabled
if (config.logging.file.enabled) {
  // Ensure logs directory exists
  const fs = require('fs');
  const logDir = path.dirname(config.logging.file.filename);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  transports.push(
    new winston.transports.File({
      filename: config.logging.file.filename,
      level: config.logging.level,
      format: logFormat,
      maxsize: config.logging.file.maxSize,
      maxFiles: config.logging.file.maxFiles,
      handleExceptions: true,
      handleRejections: true
    })
  );

  // Separate error log file
  transports.push(
    new winston.transports.File({
      filename: config.logging.file.filename.replace('.log', '.error.log'),
      level: 'error',
      format: logFormat,
      maxsize: config.logging.file.maxSize,
      maxFiles: config.logging.file.maxFiles,
      handleExceptions: true,
      handleRejections: true
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: {
    service: 'boarding-house-api',
    environment: config.nodeEnv
  },
  transports,
  exitOnError: false
});

// Add request logging helper
logger.logRequest = (req, res, responseTime) => {
  const logData = {
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    userId: req.user ? req.user.id : null
  };

  if (res.statusCode >= 400) {
    logger.warn('HTTP Request', logData);
  } else {
    logger.info('HTTP Request', logData);
  }
};

// Add database query logging helper
logger.logQuery = (query, params, duration, error = null) => {
  const logData = {
    query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
    params: params ? params.slice(0, 5) : [], // Limit params for security
    duration: `${duration}ms`
  };

  if (error) {
    logger.error('Database Query Error', { ...logData, error: error.message });
  } else if (duration > 1000) {
    logger.warn('Slow Database Query', logData);
  } else {
    logger.debug('Database Query', logData);
  }
};

// Add authentication logging helper
logger.logAuth = (action, userId, email, success, details = {}) => {
  const logData = {
    action,
    userId,
    email,
    success,
    timestamp: new Date().toISOString(),
    ...details
  };

  if (success) {
    logger.info('Authentication Success', logData);
  } else {
    logger.warn('Authentication Failure', logData);
  }
};

// Add security event logging helper
logger.logSecurity = (event, severity, details = {}) => {
  const logData = {
    event,
    severity,
    timestamp: new Date().toISOString(),
    ...details
  };

  if (severity === 'high' || severity === 'critical') {
    logger.error('Security Event', logData);
  } else {
    logger.warn('Security Event', logData);
  }
};

// Add business event logging helper
logger.logBusiness = (event, entityType, entityId, userId, details = {}) => {
  const logData = {
    event,
    entityType,
    entityId,
    userId,
    timestamp: new Date().toISOString(),
    ...details
  };

  logger.info('Business Event', logData);
};

// Add performance monitoring helper
logger.logPerformance = (operation, duration, details = {}) => {
  const logData = {
    operation,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
    ...details
  };

  if (duration > 5000) {
    logger.error('Performance Issue - Very Slow Operation', logData);
  } else if (duration > 2000) {
    logger.warn('Performance Issue - Slow Operation', logData);
  } else {
    logger.debug('Performance Metric', logData);
  }
};

// Handle uncaught exceptions and unhandled rejections
if (config.nodeEnv === 'production') {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { 
      reason: reason instanceof Error ? reason.message : reason,
      stack: reason instanceof Error ? reason.stack : undefined,
      promise: promise.toString()
    });
  });
}

module.exports = logger;
