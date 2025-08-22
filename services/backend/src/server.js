/**
 * Boarding House Monitor - Backend Server
 * Node.js/Express.js API with PostgreSQL and Redis
 */

require('dotenv').config();
require('express-async-errors');

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Import configurations and middleware
const config = require('./config/config');
const logger = require('./config/logger');
const database = require('./config/database');
const redis = require('./config/redis');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const auth = require('./middleware/auth');

// Import routes
const authRoutes = require('./routes/auth');
const buildingRoutes = require('./routes/buildings');
const roomRoutes = require('./routes/rooms');
const tenantRoutes = require('./routes/tenants');
const bookingRoutes = require('./routes/bookings');
const expenseRoutes = require('./routes/expenses');
const inventoryRoutes = require('./routes/inventory');
const userRoutes = require('./routes/users');
const healthRoutes = require('./routes/health');

// Import socket handlers
const socketHandlers = require('./sockets/handlers');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: config.cors.origin,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(config.rateLimit.windowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// Stricter rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: 900
  },
  skipSuccessfulRequests: true
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Health check endpoint (before authentication)
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);

// API routes
app.use('/api/auth', authRoutes);

// Protected routes (require authentication)
app.use('/api/buildings', auth.authenticate, buildingRoutes);
app.use('/api/rooms', auth.authenticate, roomRoutes);
app.use('/api/tenants', auth.authenticate, tenantRoutes);
app.use('/api/bookings', auth.authenticate, bookingRoutes);
app.use('/api/expenses', auth.authenticate, expenseRoutes);
app.use('/api/inventory', auth.authenticate, inventoryRoutes);
app.use('/api/users', auth.authenticate, userRoutes);

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Boarding House Monitor API',
    version: '1.0.0',
    description: 'RESTful API for boarding house management',
    endpoints: {
      auth: '/api/auth',
      buildings: '/api/buildings',
      rooms: '/api/rooms',
      tenants: '/api/tenants',
      bookings: '/api/bookings',
      expenses: '/api/expenses',
      inventory: '/api/inventory',
      users: '/api/users',
      health: '/api/health'
    },
    documentation: '/api/docs'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    availableEndpoints: '/api'
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Socket.IO authentication middleware
io.use(socketHandlers.authenticateSocket);

// Socket.IO connection handling
io.on('connection', (socket) => {
  socketHandlers.handleConnection(socket, io);
});

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      // Close database connections
      await database.close();
      logger.info('Database connections closed');
      
      // Close Redis connection
      await redis.disconnect();
      logger.info('Redis connection closed');
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start server
const startServer = async () => {
  try {
    // Initialize database connection
    await database.initialize();
    logger.info('Database connected successfully');
    
    // Initialize Redis connection
    await redis.connect();
    logger.info('Redis connected successfully');
    
    // Start HTTP server
    const port = config.port;
    server.listen(port, '0.0.0.0', () => {
      logger.info(`🚀 Boarding House Monitor API server running on port ${port}`);
      logger.info(`📚 API documentation available at http://localhost:${port}/api`);
      logger.info(`🏥 Health check available at http://localhost:${port}/health`);
      logger.info(`🌍 Environment: ${config.nodeEnv}`);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

module.exports = { app, server, io };
