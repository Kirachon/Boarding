/**
 * Redis Configuration and Connection Management
 * Redis client for caching and session management
 */

const { createClient } = require('redis');
const config = require('./config');
const logger = require('./logger');

class RedisManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  /**
   * Initialize Redis connection
   */
  async connect() {
    try {
      // Create Redis client
      this.client = createClient({
        socket: {
          host: config.redis.host,
          port: config.redis.port,
          connectTimeout: 10000,
          lazyConnect: config.redis.lazyConnect
        },
        password: config.redis.password,
        database: config.redis.db,
        retryDelayOnFailover: config.redis.retryDelayOnFailover,
        maxRetriesPerRequest: config.redis.maxRetriesPerRequest
      });

      // Set up event handlers
      this.setupEventHandlers();

      // Connect to Redis
      await this.client.connect();
      
      this.isConnected = true;
      logger.info('Redis connection established successfully');
      logger.info(`Redis server info: ${config.redis.host}:${config.redis.port}, DB: ${config.redis.db}`);

      return this.client;
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  /**
   * Set up Redis event handlers
   */
  setupEventHandlers() {
    this.client.on('connect', () => {
      logger.debug('Redis client connected');
    });

    this.client.on('ready', () => {
      logger.debug('Redis client ready');
      this.isConnected = true;
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error:', error);
      this.isConnected = false;
    });

    this.client.on('end', () => {
      logger.debug('Redis client connection ended');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });
  }

  /**
   * Set a key-value pair with optional expiration
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<string>} Redis response
   */
  async set(key, value, ttl = null) {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const serializedValue = JSON.stringify(value);
      const fullKey = config.redis.keyPrefix + key;
      
      if (ttl) {
        return await this.client.setEx(fullKey, ttl, serializedValue);
      } else {
        return await this.client.set(fullKey, serializedValue);
      }
    } catch (error) {
      logger.error('Redis SET error:', error);
      throw error;
    }
  }

  /**
   * Get a value by key
   * @param {string} key - Cache key
   * @returns {Promise<any>} Cached value or null
   */
  async get(key) {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const fullKey = config.redis.keyPrefix + key;
      const value = await this.client.get(fullKey);
      
      if (value === null) {
        return null;
      }
      
      return JSON.parse(value);
    } catch (error) {
      logger.error('Redis GET error:', error);
      throw error;
    }
  }

  /**
   * Delete a key
   * @param {string} key - Cache key
   * @returns {Promise<number>} Number of keys deleted
   */
  async del(key) {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const fullKey = config.redis.keyPrefix + key;
      return await this.client.del(fullKey);
    } catch (error) {
      logger.error('Redis DEL error:', error);
      throw error;
    }
  }

  /**
   * Check if a key exists
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} True if key exists
   */
  async exists(key) {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const fullKey = config.redis.keyPrefix + key;
      const result = await this.client.exists(fullKey);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS error:', error);
      throw error;
    }
  }

  /**
   * Set expiration for a key
   * @param {string} key - Cache key
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>} True if expiration was set
   */
  async expire(key, ttl) {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const fullKey = config.redis.keyPrefix + key;
      const result = await this.client.expire(fullKey, ttl);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXPIRE error:', error);
      throw error;
    }
  }

  /**
   * Increment a numeric value
   * @param {string} key - Cache key
   * @param {number} increment - Increment value (default: 1)
   * @returns {Promise<number>} New value after increment
   */
  async incr(key, increment = 1) {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const fullKey = config.redis.keyPrefix + key;
      if (increment === 1) {
        return await this.client.incr(fullKey);
      } else {
        return await this.client.incrBy(fullKey, increment);
      }
    } catch (error) {
      logger.error('Redis INCR error:', error);
      throw error;
    }
  }

  /**
   * Get multiple keys
   * @param {Array<string>} keys - Array of cache keys
   * @returns {Promise<Array>} Array of values
   */
  async mget(keys) {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const fullKeys = keys.map(key => config.redis.keyPrefix + key);
      const values = await this.client.mGet(fullKeys);
      
      return values.map(value => {
        if (value === null) return null;
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      });
    } catch (error) {
      logger.error('Redis MGET error:', error);
      throw error;
    }
  }

  /**
   * Set multiple key-value pairs
   * @param {Object} keyValuePairs - Object with key-value pairs
   * @param {number} ttl - Optional TTL for all keys
   * @returns {Promise<string>} Redis response
   */
  async mset(keyValuePairs, ttl = null) {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const pipeline = this.client.multi();
      
      Object.entries(keyValuePairs).forEach(([key, value]) => {
        const fullKey = config.redis.keyPrefix + key;
        const serializedValue = JSON.stringify(value);
        
        if (ttl) {
          pipeline.setEx(fullKey, ttl, serializedValue);
        } else {
          pipeline.set(fullKey, serializedValue);
        }
      });
      
      return await pipeline.exec();
    } catch (error) {
      logger.error('Redis MSET error:', error);
      throw error;
    }
  }

  /**
   * Clear all keys with the configured prefix
   * @returns {Promise<number>} Number of keys deleted
   */
  async clear() {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const pattern = config.redis.keyPrefix + '*';
      const keys = await this.client.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      return await this.client.del(keys);
    } catch (error) {
      logger.error('Redis CLEAR error:', error);
      throw error;
    }
  }

  /**
   * Get Redis server info
   * @returns {Promise<Object>} Server information
   */
  async info() {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const info = await this.client.info();
      return this.parseInfo(info);
    } catch (error) {
      logger.error('Redis INFO error:', error);
      throw error;
    }
  }

  /**
   * Parse Redis INFO response
   * @param {string} infoString - Raw info string
   * @returns {Object} Parsed info object
   */
  parseInfo(infoString) {
    const info = {};
    const lines = infoString.split('\r\n');
    
    lines.forEach(line => {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          info[key] = value;
        }
      }
    });
    
    return info;
  }

  /**
   * Health check for Redis connection
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      if (!this.isConnected) {
        return {
          status: 'unhealthy',
          message: 'Redis not connected'
        };
      }

      const start = Date.now();
      await this.client.ping();
      const responseTime = Date.now() - start;

      const info = await this.info();

      return {
        status: 'healthy',
        responseTime: `${responseTime}ms`,
        version: info.redis_version,
        uptime: info.uptime_in_seconds,
        connected_clients: info.connected_clients,
        used_memory: info.used_memory_human,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis connection closed');
    }
  }
}

// Create singleton instance
const redis = new RedisManager();

module.exports = redis;
