/**
 * Real-time Service
 * Manages WebSocket events and database notifications
 */

const database = require('../config/database');
const logger = require('../config/logger');
const cacheService = require('./cacheService');

class RealtimeService {
  constructor() {
    this.io = null;
    this.pgClient = null;
    this.isListening = false;
  }

  /**
   * Initialize real-time service with Socket.IO instance
   */
  initialize(io) {
    this.io = io;
    this.setupDatabaseNotifications();
    logger.info('Real-time service initialized');
  }

  /**
   * Set up PostgreSQL LISTEN/NOTIFY for real-time updates
   */
  async setupDatabaseNotifications() {
    try {
      this.pgClient = await database.getClient();
      
      // Listen for room availability changes
      await this.pgClient.query('LISTEN room_availability_changed');
      
      // Listen for low stock alerts
      await this.pgClient.query('LISTEN low_stock_alert');
      
      // Set up notification handlers
      this.pgClient.on('notification', (msg) => {
        this.handleDatabaseNotification(msg);
      });

      this.isListening = true;
      logger.info('Database notifications setup complete');
    } catch (error) {
      logger.error('Error setting up database notifications:', error);
    }
  }

  /**
   * Handle database notifications
   */
  handleDatabaseNotification(msg) {
    try {
      const { channel, payload } = msg;
      const data = JSON.parse(payload);

      switch (channel) {
        case 'room_availability_changed':
          this.handleRoomAvailabilityChange(data);
          break;
        case 'low_stock_alert':
          this.handleLowStockAlert(data);
          break;
        default:
          logger.debug(`Unhandled notification channel: ${channel}`);
      }
    } catch (error) {
      logger.error('Error handling database notification:', error);
    }
  }

  /**
   * Handle room availability changes
   */
  async handleRoomAvailabilityChange(data) {
    try {
      const { room_id, action, booking_id, status } = data;
      
      // Get room and building information
      const roomResult = await database.query(
        'SELECT r.*, b.building_id, b.name as building_name FROM rooms r JOIN buildings b ON r.building_id = b.building_id WHERE r.room_id = $1',
        [room_id]
      );

      if (roomResult.rows.length === 0) {
        return;
      }

      const room = roomResult.rows[0];
      const buildingId = room.building_id;

      // Invalidate related caches
      await cacheService.invalidateRoomCache(room_id, buildingId);

      // Prepare real-time update payload
      const updatePayload = {
        type: 'room_availability_changed',
        roomId: room_id,
        buildingId: buildingId,
        action: action,
        bookingId: booking_id,
        status: status,
        room: {
          roomNumber: room.room_number,
          type: room.type,
          status: room.status,
          monthlyRate: room.monthly_rate
        },
        timestamp: new Date().toISOString()
      };

      // Broadcast to room subscribers
      this.io.to(`room:${room_id}`).emit('room:availability_changed', updatePayload);
      
      // Broadcast to building subscribers
      this.io.to(`building:${buildingId}`).emit('building:room_availability_changed', updatePayload);

      logger.debug(`Room availability change broadcasted: Room ${room_id}, Action: ${action}`);
    } catch (error) {
      logger.error('Error handling room availability change:', error);
    }
  }

  /**
   * Handle low stock alerts
   */
  async handleLowStockAlert(data) {
    try {
      const { item_id, item_name, building_id, current_quantity, min_threshold } = data;

      // Invalidate building cache
      await cacheService.invalidateBuildingCache(building_id);

      // Prepare alert payload
      const alertPayload = {
        type: 'low_stock_alert',
        itemId: item_id,
        itemName: item_name,
        buildingId: building_id,
        currentQuantity: current_quantity,
        minThreshold: min_threshold,
        shortage: min_threshold - current_quantity,
        timestamp: new Date().toISOString()
      };

      // Broadcast to building subscribers
      this.io.to(`building:${building_id}`).emit('inventory:low_stock_alert', alertPayload);

      logger.debug(`Low stock alert broadcasted: Item ${item_name} in building ${building_id}`);
    } catch (error) {
      logger.error('Error handling low stock alert:', error);
    }
  }

  /**
   * Broadcast room update
   */
  async broadcastRoomUpdate(roomId, buildingId, updateData) {
    try {
      if (!this.io) {
        logger.warn('Socket.IO not initialized, cannot broadcast room update');
        return;
      }

      // Invalidate room cache
      await cacheService.invalidateRoomCache(roomId, buildingId);

      const payload = {
        type: 'room_updated',
        roomId,
        buildingId,
        data: updateData,
        timestamp: new Date().toISOString()
      };

      // Broadcast to room subscribers
      this.io.to(`room:${roomId}`).emit('room:updated', payload);
      
      // Broadcast to building subscribers
      this.io.to(`building:${buildingId}`).emit('building:room_updated', payload);

      logger.debug(`Room update broadcasted: Room ${roomId}`);
    } catch (error) {
      logger.error('Error broadcasting room update:', error);
    }
  }

  /**
   * Broadcast booking update
   */
  async broadcastBookingUpdate(bookingId, roomId, buildingId, updateData) {
    try {
      if (!this.io) {
        logger.warn('Socket.IO not initialized, cannot broadcast booking update');
        return;
      }

      // Invalidate booking-related caches
      await cacheService.invalidateBookingCache(bookingId, roomId, buildingId);

      const payload = {
        type: 'booking_updated',
        bookingId,
        roomId,
        buildingId,
        data: updateData,
        timestamp: new Date().toISOString()
      };

      // Broadcast to room subscribers
      this.io.to(`room:${roomId}`).emit('booking:updated', payload);
      
      // Broadcast to building subscribers
      this.io.to(`building:${buildingId}`).emit('building:booking_updated', payload);

      logger.debug(`Booking update broadcasted: Booking ${bookingId}`);
    } catch (error) {
      logger.error('Error broadcasting booking update:', error);
    }
  }

  /**
   * Send notification to specific user
   */
  async sendUserNotification(userId, notification) {
    try {
      if (!this.io) {
        logger.warn('Socket.IO not initialized, cannot send user notification');
        return;
      }

      const payload = {
        type: 'notification',
        data: notification,
        timestamp: new Date().toISOString()
      };

      this.io.to(`user:${userId}`).emit('notification', payload);

      logger.debug(`Notification sent to user ${userId}: ${notification.title}`);
    } catch (error) {
      logger.error('Error sending user notification:', error);
    }
  }

  /**
   * Broadcast system announcement
   */
  async broadcastSystemAnnouncement(buildingId, announcement) {
    try {
      if (!this.io) {
        logger.warn('Socket.IO not initialized, cannot broadcast announcement');
        return;
      }

      const payload = {
        type: 'system_announcement',
        buildingId,
        data: announcement,
        timestamp: new Date().toISOString()
      };

      if (buildingId) {
        // Broadcast to specific building
        this.io.to(`building:${buildingId}`).emit('system:announcement', payload);
      } else {
        // Broadcast to all connected users
        this.io.emit('system:announcement', payload);
      }

      logger.info(`System announcement broadcasted: ${announcement.title}`);
    } catch (error) {
      logger.error('Error broadcasting system announcement:', error);
    }
  }

  /**
   * Get real-time statistics
   */
  getRealtimeStats() {
    if (!this.io) {
      return { connected: false };
    }

    const sockets = this.io.sockets.sockets;
    const connectedUsers = Array.from(sockets.values())
      .filter(socket => socket.user)
      .map(socket => ({
        userId: socket.user.id,
        email: socket.user.email,
        connectedAt: socket.handshake.time
      }));

    return {
      connected: true,
      totalConnections: sockets.size,
      authenticatedUsers: connectedUsers.length,
      databaseNotifications: this.isListening,
      connectedUsers: connectedUsers
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      if (this.pgClient) {
        this.pgClient.release();
        this.pgClient = null;
      }
      this.isListening = false;
      logger.info('Real-time service cleanup completed');
    } catch (error) {
      logger.error('Error during real-time service cleanup:', error);
    }
  }
}

// Create singleton instance
const realtimeService = new RealtimeService();

module.exports = realtimeService;
