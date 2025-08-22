/**
 * Cache Service
 * Redis-based caching with intelligent invalidation
 */

const redis = require('../config/redis');
const logger = require('../config/logger');

class CacheService {
  constructor() {
    this.defaultTTL = 3600; // 1 hour
    this.keyPrefixes = {
      room: 'room:',
      building: 'building:',
      tenant: 'tenant:',
      booking: 'booking:',
      availability: 'availability:',
      stats: 'stats:',
      user: 'user:'
    };
  }

  /**
   * Generate cache key with prefix
   */
  generateKey(prefix, identifier, suffix = '') {
    return `${prefix}${identifier}${suffix ? ':' + suffix : ''}`;
  }

  /**
   * Cache room data
   */
  async cacheRoom(roomId, roomData, ttl = this.defaultTTL) {
    try {
      const key = this.generateKey(this.keyPrefixes.room, roomId);
      await redis.set(key, roomData, ttl);
      logger.debug(`Room cached: ${key}`);
    } catch (error) {
      logger.error('Error caching room:', error);
    }
  }

  /**
   * Get cached room data
   */
  async getCachedRoom(roomId) {
    try {
      const key = this.generateKey(this.keyPrefixes.room, roomId);
      return await redis.get(key);
    } catch (error) {
      logger.error('Error getting cached room:', error);
      return null;
    }
  }

  /**
   * Cache room availability
   */
  async cacheRoomAvailability(roomId, dateRange, availabilityData, ttl = 1800) { // 30 minutes
    try {
      const key = this.generateKey(this.keyPrefixes.availability, roomId, dateRange);
      await redis.set(key, availabilityData, ttl);
      logger.debug(`Room availability cached: ${key}`);
    } catch (error) {
      logger.error('Error caching room availability:', error);
    }
  }

  /**
   * Get cached room availability
   */
  async getCachedRoomAvailability(roomId, dateRange) {
    try {
      const key = this.generateKey(this.keyPrefixes.availability, roomId, dateRange);
      return await redis.get(key);
    } catch (error) {
      logger.error('Error getting cached room availability:', error);
      return null;
    }
  }

  /**
   * Cache building statistics
   */
  async cacheBuildingStats(buildingId, statsData, ttl = 900) { // 15 minutes
    try {
      const key = this.generateKey(this.keyPrefixes.stats, buildingId);
      await redis.set(key, statsData, ttl);
      logger.debug(`Building stats cached: ${key}`);
    } catch (error) {
      logger.error('Error caching building stats:', error);
    }
  }

  /**
   * Get cached building statistics
   */
  async getCachedBuildingStats(buildingId) {
    try {
      const key = this.generateKey(this.keyPrefixes.stats, buildingId);
      return await redis.get(key);
    } catch (error) {
      logger.error('Error getting cached building stats:', error);
      return null;
    }
  }

  /**
   * Cache user session data
   */
  async cacheUserSession(userId, sessionData, ttl = 86400) { // 24 hours
    try {
      const key = this.generateKey(this.keyPrefixes.user, userId, 'session');
      await redis.set(key, sessionData, ttl);
      logger.debug(`User session cached: ${key}`);
    } catch (error) {
      logger.error('Error caching user session:', error);
    }
  }

  /**
   * Get cached user session
   */
  async getCachedUserSession(userId) {
    try {
      const key = this.generateKey(this.keyPrefixes.user, userId, 'session');
      return await redis.get(key);
    } catch (error) {
      logger.error('Error getting cached user session:', error);
      return null;
    }
  }

  /**
   * Invalidate room-related caches
   */
  async invalidateRoomCache(roomId, buildingId = null) {
    try {
      const patterns = [
        this.generateKey(this.keyPrefixes.room, roomId) + '*',
        this.generateKey(this.keyPrefixes.availability, roomId) + '*'
      ];

      if (buildingId) {
        patterns.push(this.generateKey(this.keyPrefixes.building, buildingId) + '*');
        patterns.push(this.generateKey(this.keyPrefixes.stats, buildingId) + '*');
      }

      for (const pattern of patterns) {
        const keys = await redis.client.keys(redis.client.options.keyPrefix + pattern);
        if (keys.length > 0) {
          await redis.client.del(keys);
          logger.debug(`Invalidated cache pattern: ${pattern} (${keys.length} keys)`);
        }
      }
    } catch (error) {
      logger.error('Error invalidating room cache:', error);
    }
  }

  /**
   * Invalidate booking-related caches
   */
  async invalidateBookingCache(bookingId, roomId, buildingId) {
    try {
      const patterns = [
        this.generateKey(this.keyPrefixes.booking, bookingId) + '*',
        this.generateKey(this.keyPrefixes.room, roomId) + '*',
        this.generateKey(this.keyPrefixes.availability, roomId) + '*',
        this.generateKey(this.keyPrefixes.building, buildingId) + '*',
        this.generateKey(this.keyPrefixes.stats, buildingId) + '*'
      ];

      for (const pattern of patterns) {
        const keys = await redis.client.keys(redis.client.options.keyPrefix + pattern);
        if (keys.length > 0) {
          await redis.client.del(keys);
          logger.debug(`Invalidated cache pattern: ${pattern} (${keys.length} keys)`);
        }
      }
    } catch (error) {
      logger.error('Error invalidating booking cache:', error);
    }
  }

  /**
   * Invalidate building-related caches
   */
  async invalidateBuildingCache(buildingId) {
    try {
      const patterns = [
        this.generateKey(this.keyPrefixes.building, buildingId) + '*',
        this.generateKey(this.keyPrefixes.stats, buildingId) + '*'
      ];

      for (const pattern of patterns) {
        const keys = await redis.client.keys(redis.client.options.keyPrefix + pattern);
        if (keys.length > 0) {
          await redis.client.del(keys);
          logger.debug(`Invalidated cache pattern: ${pattern} (${keys.length} keys)`);
        }
      }
    } catch (error) {
      logger.error('Error invalidating building cache:', error);
    }
  }

  /**
   * Cache with automatic invalidation
   */
  async cacheWithInvalidation(key, data, ttl, invalidationKeys = []) {
    try {
      await redis.set(key, data, ttl);
      
      // Store invalidation mapping
      for (const invKey of invalidationKeys) {
        const mappingKey = `invalidation:${invKey}`;
        const existingKeys = await redis.get(mappingKey) || [];
        existingKeys.push(key);
        await redis.set(mappingKey, existingKeys, ttl);
      }
      
      logger.debug(`Data cached with invalidation: ${key}`);
    } catch (error) {
      logger.error('Error caching with invalidation:', error);
    }
  }

  /**
   * Bulk cache operations
   */
  async bulkSet(keyValuePairs, ttl = this.defaultTTL) {
    try {
      await redis.mset(keyValuePairs, ttl);
      logger.debug(`Bulk cached ${Object.keys(keyValuePairs).length} items`);
    } catch (error) {
      logger.error('Error in bulk cache set:', error);
    }
  }

  /**
   * Bulk cache retrieval
   */
  async bulkGet(keys) {
    try {
      return await redis.mget(keys);
    } catch (error) {
      logger.error('Error in bulk cache get:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Clear all cache
   */
  async clearAll() {
    try {
      await redis.clear();
      logger.info('All cache cleared');
    } catch (error) {
      logger.error('Error clearing all cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    try {
      const info = await redis.info();
      return {
        connected: redis.isConnected,
        version: info.redis_version,
        usedMemory: info.used_memory_human,
        connectedClients: info.connected_clients,
        keyspaceHits: info.keyspace_hits,
        keyspaceMisses: info.keyspace_misses,
        hitRate: info.keyspace_hits / (parseInt(info.keyspace_hits) + parseInt(info.keyspace_misses)) * 100
      };
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      return null;
    }
  }
}

// Create singleton instance
const cacheService = new CacheService();

module.exports = cacheService;
