/**
 * Database Configuration and Connection Management
 * PostgreSQL connection with connection pooling
 */

const { Pool } = require('pg');
const config = require('./config');
const logger = require('./logger');

class Database {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  /**
   * Initialize database connection pool
   */
  async initialize() {
    try {
      // Create connection pool
      this.pool = new Pool({
        host: config.database.host,
        port: config.database.port,
        database: config.database.database,
        user: config.database.username,
        password: config.database.password,
        ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
        min: config.database.pool.min,
        max: config.database.pool.max,
        acquireTimeoutMillis: config.database.pool.acquireTimeoutMillis,
        idleTimeoutMillis: config.database.pool.idleTimeoutMillis,
        connectionTimeoutMillis: 10000,
        query_timeout: 30000,
        statement_timeout: 30000
      });

      // Test connection
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW() as current_time, version() as version');
      client.release();

      this.isConnected = true;
      logger.info('Database connection established successfully');
      logger.info(`PostgreSQL version: ${result.rows[0].version.split(' ')[1]}`);
      logger.info(`Connection pool: min=${config.database.pool.min}, max=${config.database.pool.max}`);

      // Set up connection pool event handlers
      this.setupEventHandlers();

      return this.pool;
    } catch (error) {
      logger.error('Failed to initialize database connection:', error);
      throw error;
    }
  }

  /**
   * Set up connection pool event handlers
   */
  setupEventHandlers() {
    this.pool.on('connect', (client) => {
      logger.debug('New database client connected');
    });

    this.pool.on('acquire', (client) => {
      logger.debug('Client acquired from pool');
    });

    this.pool.on('remove', (client) => {
      logger.debug('Client removed from pool');
    });

    this.pool.on('error', (error, client) => {
      logger.error('Database pool error:', error);
      this.isConnected = false;
    });
  }

  /**
   * Execute a query with automatic connection management
   * @param {string} text - SQL query text
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} Query result
   */
  async query(text, params = []) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      if (duration > 1000) {
        logger.warn(`Slow query detected (${duration}ms):`, text.substring(0, 100));
      }
      
      logger.debug(`Query executed in ${duration}ms`);
      return result;
    } catch (error) {
      logger.error('Database query error:', {
        error: error.message,
        query: text.substring(0, 100),
        params: params
      });
      throw error;
    }
  }

  /**
   * Execute a transaction
   * @param {Function} callback - Transaction callback function
   * @returns {Promise<any>} Transaction result
   */
  async transaction(callback) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction rolled back:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a client from the pool for manual transaction management
   * @returns {Promise<Object>} Database client
   */
  async getClient() {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    return await this.pool.connect();
  }

  /**
   * Get connection pool status
   * @returns {Object} Pool status information
   */
  getPoolStatus() {
    if (!this.pool) {
      return { connected: false };
    }

    return {
      connected: this.isConnected,
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };
  }

  /**
   * Health check for database connection
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      if (!this.isConnected) {
        return {
          status: 'unhealthy',
          message: 'Database not connected'
        };
      }

      const start = Date.now();
      const result = await this.query('SELECT 1 as health_check');
      const responseTime = Date.now() - start;

      const poolStatus = this.getPoolStatus();

      return {
        status: 'healthy',
        responseTime: `${responseTime}ms`,
        pool: poolStatus,
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
   * Execute database migrations
   * @returns {Promise<void>}
   */
  async runMigrations() {
    try {
      logger.info('Running database migrations...');
      
      // Create migrations table if it doesn't exist
      await this.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          description TEXT
        )
      `);

      // Get applied migrations
      const appliedResult = await this.query(
        'SELECT version FROM schema_migrations ORDER BY version'
      );
      const appliedVersions = appliedResult.rows.map(row => row.version);

      logger.info(`Applied migrations: ${appliedVersions.join(', ') || 'none'}`);
      
      // For now, we'll assume migrations are handled by the init scripts
      // In a production system, you would implement proper migration logic here
      
      logger.info('Database migrations completed');
    } catch (error) {
      logger.error('Migration failed:', error);
      throw error;
    }
  }

  /**
   * Close database connection pool
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database connection pool closed');
    }
  }
}

// Create singleton instance
const database = new Database();

module.exports = database;
