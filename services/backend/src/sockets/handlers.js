/**
 * Socket.IO Event Handlers
 * Real-time communication handlers
 */

const jwt = require('jsonwebtoken');
const config = require('../config/config');
const logger = require('../config/logger');
const database = require('../config/database');

/**
 * Authenticate socket connection
 */
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.jwt.secret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience
    });

    // Get user info
    const userResult = await database.query(
      'SELECT user_id, email, first_name, last_name, is_active FROM users WHERE user_id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
      return next(new Error('Invalid or inactive user'));
    }

    const user = userResult.rows[0];

    // Get user's building roles
    const rolesResult = await database.query(`
      SELECT ubr.building_id, ubr.role, b.name as building_name
      FROM user_building_roles ubr
      JOIN buildings b ON ubr.building_id = b.building_id
      WHERE ubr.user_id = $1
    `, [user.user_id]);

    socket.user = {
      id: user.user_id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      roles: rolesResult.rows,
      accessibleBuildings: rolesResult.rows.map(role => role.building_id)
    };

    next();
  } catch (error) {
    logger.error('Socket authentication error:', error);
    next(new Error('Authentication failed'));
  }
};

/**
 * Handle socket connection
 */
const handleConnection = (socket, io) => {
  logger.info(`User connected via socket: ${socket.user.email} (${socket.id})`);

  // Join user to their accessible building rooms
  socket.user.accessibleBuildings.forEach(buildingId => {
    socket.join(`building:${buildingId}`);
  });

  // Join user to their personal room
  socket.join(`user:${socket.user.id}`);

  // Handle room subscription
  socket.on('subscribe:room', (roomId) => {
    try {
      // Verify user has access to this room's building
      // This would need to be implemented with proper room-building relationship check
      socket.join(`room:${roomId}`);
      logger.debug(`User ${socket.user.id} subscribed to room ${roomId}`);
    } catch (error) {
      logger.error('Room subscription error:', error);
      socket.emit('error', { message: 'Failed to subscribe to room updates' });
    }
  });

  // Handle room unsubscription
  socket.on('unsubscribe:room', (roomId) => {
    socket.leave(`room:${roomId}`);
    logger.debug(`User ${socket.user.id} unsubscribed from room ${roomId}`);
  });

  // Handle building subscription
  socket.on('subscribe:building', (buildingId) => {
    try {
      // Verify user has access to this building
      if (socket.user.accessibleBuildings.includes(parseInt(buildingId))) {
        socket.join(`building:${buildingId}`);
        logger.debug(`User ${socket.user.id} subscribed to building ${buildingId}`);
      } else {
        socket.emit('error', { message: 'Access denied to building' });
      }
    } catch (error) {
      logger.error('Building subscription error:', error);
      socket.emit('error', { message: 'Failed to subscribe to building updates' });
    }
  });

  // Handle ping for connection health
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    logger.info(`User disconnected: ${socket.user.email} (${socket.id}) - Reason: ${reason}`);
  });

  // Handle errors
  socket.on('error', (error) => {
    logger.error('Socket error:', error);
  });

  // Send welcome message
  socket.emit('connected', {
    message: 'Connected to Boarding House Monitor',
    user: {
      id: socket.user.id,
      email: socket.user.email,
      firstName: socket.user.firstName,
      lastName: socket.user.lastName
    },
    accessibleBuildings: socket.user.accessibleBuildings
  });
};

/**
 * Broadcast room availability update
 */
const broadcastRoomUpdate = (io, roomId, buildingId, updateData) => {
  try {
    const payload = {
      type: 'room_update',
      roomId,
      buildingId,
      data: updateData,
      timestamp: new Date().toISOString()
    };

    // Broadcast to room subscribers
    io.to(`room:${roomId}`).emit('room:updated', payload);
    
    // Broadcast to building subscribers
    io.to(`building:${buildingId}`).emit('building:room_updated', payload);

    logger.debug(`Room update broadcasted: Room ${roomId}, Building ${buildingId}`);
  } catch (error) {
    logger.error('Error broadcasting room update:', error);
  }
};

/**
 * Broadcast booking update
 */
const broadcastBookingUpdate = (io, bookingId, roomId, buildingId, updateData) => {
  try {
    const payload = {
      type: 'booking_update',
      bookingId,
      roomId,
      buildingId,
      data: updateData,
      timestamp: new Date().toISOString()
    };

    // Broadcast to room subscribers
    io.to(`room:${roomId}`).emit('booking:updated', payload);
    
    // Broadcast to building subscribers
    io.to(`building:${buildingId}`).emit('building:booking_updated', payload);

    logger.debug(`Booking update broadcasted: Booking ${bookingId}, Room ${roomId}`);
  } catch (error) {
    logger.error('Error broadcasting booking update:', error);
  }
};

/**
 * Broadcast inventory alert
 */
const broadcastInventoryAlert = (io, buildingId, alertData) => {
  try {
    const payload = {
      type: 'inventory_alert',
      buildingId,
      data: alertData,
      timestamp: new Date().toISOString()
    };

    // Broadcast to building subscribers
    io.to(`building:${buildingId}`).emit('inventory:alert', payload);

    logger.debug(`Inventory alert broadcasted: Building ${buildingId}`);
  } catch (error) {
    logger.error('Error broadcasting inventory alert:', error);
  }
};

/**
 * Send notification to specific user
 */
const sendUserNotification = (io, userId, notification) => {
  try {
    const payload = {
      type: 'notification',
      data: notification,
      timestamp: new Date().toISOString()
    };

    io.to(`user:${userId}`).emit('notification', payload);

    logger.debug(`Notification sent to user ${userId}`);
  } catch (error) {
    logger.error('Error sending user notification:', error);
  }
};

module.exports = {
  authenticateSocket,
  handleConnection,
  broadcastRoomUpdate,
  broadcastBookingUpdate,
  broadcastInventoryAlert,
  sendUserNotification
};
