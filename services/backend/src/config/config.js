/**
 * Application Configuration
 * Centralized configuration management with environment variable support
 */

const fs = require('fs');
const path = require('path');

// Helper function to read secrets from files
const readSecret = (secretPath) => {
  try {
    if (fs.existsSync(secretPath)) {
      return fs.readFileSync(secretPath, 'utf8').trim();
    }
    return null;
  } catch (error) {
    console.warn(`Warning: Could not read secret from ${secretPath}:`, error.message);
    return null;
  }
};

// Environment variables with defaults
const config = {
  // Application settings
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 8000,
  apiVersion: process.env.API_VERSION || 'v1',
  
  // Database configuration
  database: {
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || 'boarding_house',
    username: process.env.DB_USER || 'app_user',
    password: process.env.DB_PASSWORD || 
              readSecret(process.env.DB_PASSWORD_FILE) || 
              readSecret('/run/secrets/db_password') ||
              'dev_password_123',
    ssl: process.env.DB_SSL === 'true',
    pool: {
      min: parseInt(process.env.DB_POOL_MIN, 10) || 2,
      max: parseInt(process.env.DB_POOL_MAX, 10) || 20,
      acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT, 10) || 60000,
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT, 10) || 30000
    }
  },
  
  // Redis configuration
  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || null,
    db: parseInt(process.env.REDIS_DB, 10) || 0,
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'boarding:',
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true
  },
  
  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 
            readSecret(process.env.JWT_SECRET_FILE) || 
            readSecret('/run/secrets/jwt_secret') ||
            'dev_jwt_secret_very_long_string_for_development_only',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: process.env.JWT_ISSUER || 'boarding-house-monitor',
    audience: process.env.JWT_AUDIENCE || 'boarding-house-users'
  },
  
  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN ? 
            process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()) : 
            ['http://localhost:3000', 'http://localhost'],
    credentials: true
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100 // requests per window
  },
  
  // File upload configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    uploadPath: process.env.UPLOAD_PATH || '/uploads',
    tempPath: process.env.TEMP_PATH || '/tmp'
  },
  
  // Email configuration (optional)
  email: {
    enabled: process.env.EMAIL_ENABLED === 'true',
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    },
    from: process.env.SMTP_FROM || 'noreply@boardinghouse.com'
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
    file: {
      enabled: process.env.LOG_FILE_ENABLED === 'true',
      filename: process.env.LOG_FILE || 'logs/app.log',
      maxSize: process.env.LOG_MAX_SIZE || '10m',
      maxFiles: parseInt(process.env.LOG_MAX_FILES, 10) || 5
    }
  },
  
  // Security settings
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT, 10) || 24 * 60 * 60 * 1000, // 24 hours
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS, 10) || 5,
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION, 10) || 15 * 60 * 1000 // 15 minutes
  },
  
  // Feature flags
  features: {
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    enableAuditLog: process.env.ENABLE_AUDIT_LOG !== 'false', // enabled by default
    enableRealTimeUpdates: process.env.ENABLE_REALTIME !== 'false', // enabled by default
    enableFileUploads: process.env.ENABLE_FILE_UPLOADS !== 'false' // enabled by default
  },
  
  // Development settings
  development: {
    enableDebugRoutes: process.env.NODE_ENV === 'development',
    enableSeedData: process.env.ENABLE_SEED_DATA === 'true',
    mockExternalServices: process.env.MOCK_EXTERNAL_SERVICES === 'true'
  }
};

// Validation
const validateConfig = () => {
  const required = [
    'database.password',
    'jwt.secret'
  ];
  
  const missing = [];
  
  required.forEach(key => {
    const value = key.split('.').reduce((obj, prop) => obj && obj[prop], config);
    if (!value) {
      missing.push(key);
    }
  });
  
  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }
  
  // Validate JWT secret strength in production
  if (config.nodeEnv === 'production' && config.jwt.secret.length < 32) {
    throw new Error('JWT secret must be at least 32 characters in production');
  }
  
  // Validate database password strength in production
  if (config.nodeEnv === 'production' && config.database.password.length < 12) {
    throw new Error('Database password must be at least 12 characters in production');
  }
};

// Validate configuration on load
try {
  validateConfig();
} catch (error) {
  console.error('Configuration validation failed:', error.message);
  if (config.nodeEnv === 'production') {
    process.exit(1);
  }
}

module.exports = config;
