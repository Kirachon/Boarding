/**
 * Performance Monitoring Script
 * Continuous performance monitoring and alerting
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:5000/api';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const MONITORING_INTERVAL = parseInt(process.env.MONITORING_INTERVAL) || 30; // seconds
const ALERT_THRESHOLDS = {
  responseTime: 2000, // 2 seconds
  errorRate: 5, // 5%
  memoryUsage: 80, // 80%
  cpuUsage: 80 // 80%
};

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      responseTime: [],
      errorRate: [],
      throughput: [],
      systemMetrics: []
    };
    this.alerts = [];
    this.isRunning = false;
  }

  async checkAPIHealth() {
    const startTime = performance.now();
    
    try {
      const response = await axios.get(`${API_BASE_URL}/health/detailed`, {
        timeout: 10000
      });
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      return {
        success: true,
        responseTime,
        status: response.status,
        data: response.data
      };
    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      return {
        success: false,
        responseTime,
        status: error.response?.status || 0,
        error: error.message
      };
    }
  }

  async checkFrontendHealth() {
    const startTime = performance.now();
    
    try {
      const response = await axios.get(FRONTEND_URL, {
        timeout: 10000
      });
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      return {
        success: true,
        responseTime,
        status: response.status
      };
    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      return {
        success: false,
        responseTime,
        status: error.response?.status || 0,
        error: error.message
      };
    }
  }

  async checkDatabasePerformance() {
    try {
      const startTime = performance.now();
      
      // Test database query performance
      const response = await axios.get(`${API_BASE_URL}/health/detailed`);
      
      const endTime = performance.now();
      const queryTime = endTime - startTime;
      
      const dbStatus = response.data.checks?.database;
      
      return {
        success: dbStatus?.status === 'healthy',
        queryTime,
        connectionPool: dbStatus?.details?.connectionPool || {},
        activeConnections: dbStatus?.details?.activeConnections || 0
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async checkCachePerformance() {
    try {
      const response = await axios.get(`${API_BASE_URL}/health/metrics`);
      const cacheStats = response.data.cache;
      
      if (cacheStats) {
        return {
          success: true,
          hitRate: cacheStats.hitRate || 0,
          usedMemory: cacheStats.usedMemory,
          connectedClients: cacheStats.connectedClients || 0
        };
      }
      
      return { success: false, error: 'Cache stats not available' };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async performLoadTest() {
    const testEndpoints = [
      '/health',
      '/buildings',
      '/rooms?page=1&limit=10',
      '/tenants?page=1&limit=10'
    ];
    
    const results = [];
    const concurrentRequests = 5;
    
    for (const endpoint of testEndpoints) {
      const promises = [];
      
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(this.makeTimedRequest(endpoint));
      }
      
      const endpointResults = await Promise.all(promises);
      results.push({
        endpoint,
        results: endpointResults,
        averageTime: endpointResults.reduce((sum, r) => sum + r.responseTime, 0) / endpointResults.length,
        successRate: (endpointResults.filter(r => r.success).length / endpointResults.length) * 100
      });
    }
    
    return results;
  }

  async makeTimedRequest(endpoint) {
    const startTime = performance.now();
    
    try {
      const response = await axios.get(`${API_BASE_URL}${endpoint}`, {
        timeout: 5000
      });
      
      const endTime = performance.now();
      
      return {
        success: true,
        responseTime: endTime - startTime,
        status: response.status
      };
    } catch (error) {
      const endTime = performance.now();
      
      return {
        success: false,
        responseTime: endTime - startTime,
        status: error.response?.status || 0,
        error: error.message
      };
    }
  }

  async collectMetrics() {
    const timestamp = new Date().toISOString();
    
    console.log(`📊 Collecting metrics at ${timestamp}`);
    
    // API Health Check
    const apiHealth = await this.checkAPIHealth();
    console.log(`🔗 API Health: ${apiHealth.success ? '✅' : '❌'} (${apiHealth.responseTime.toFixed(2)}ms)`);
    
    // Frontend Health Check
    const frontendHealth = await this.checkFrontendHealth();
    console.log(`🌐 Frontend Health: ${frontendHealth.success ? '✅' : '❌'} (${frontendHealth.responseTime.toFixed(2)}ms)`);
    
    // Database Performance
    const dbPerf = await this.checkDatabasePerformance();
    console.log(`🗄️  Database: ${dbPerf.success ? '✅' : '❌'} (${dbPerf.queryTime?.toFixed(2) || 'N/A'}ms)`);
    
    // Cache Performance
    const cachePerf = await this.checkCachePerformance();
    console.log(`⚡ Cache Hit Rate: ${cachePerf.hitRate?.toFixed(2) || 'N/A'}%`);
    
    // Load Test
    const loadTestResults = await this.performLoadTest();
    const avgResponseTime = loadTestResults.reduce((sum, r) => sum + r.averageTime, 0) / loadTestResults.length;
    const avgSuccessRate = loadTestResults.reduce((sum, r) => sum + r.successRate, 0) / loadTestResults.length;
    
    console.log(`🚀 Load Test - Avg Response: ${avgResponseTime.toFixed(2)}ms, Success Rate: ${avgSuccessRate.toFixed(2)}%`);
    
    // Store metrics
    const metrics = {
      timestamp,
      api: apiHealth,
      frontend: frontendHealth,
      database: dbPerf,
      cache: cachePerf,
      loadTest: {
        averageResponseTime: avgResponseTime,
        successRate: avgSuccessRate,
        results: loadTestResults
      }
    };
    
    this.metrics.responseTime.push({
      timestamp,
      api: apiHealth.responseTime,
      frontend: frontendHealth.responseTime,
      database: dbPerf.queryTime || 0,
      loadTest: avgResponseTime
    });
    
    this.metrics.errorRate.push({
      timestamp,
      api: apiHealth.success ? 0 : 100,
      frontend: frontendHealth.success ? 0 : 100,
      loadTest: 100 - avgSuccessRate
    });
    
    // Check for alerts
    this.checkAlerts(metrics);
    
    return metrics;
  }

  checkAlerts(metrics) {
    const alerts = [];
    
    // Response time alerts
    if (metrics.api.responseTime > ALERT_THRESHOLDS.responseTime) {
      alerts.push({
        type: 'HIGH_RESPONSE_TIME',
        service: 'API',
        value: metrics.api.responseTime,
        threshold: ALERT_THRESHOLDS.responseTime,
        message: `API response time (${metrics.api.responseTime.toFixed(2)}ms) exceeds threshold`
      });
    }
    
    if (metrics.frontend.responseTime > ALERT_THRESHOLDS.responseTime) {
      alerts.push({
        type: 'HIGH_RESPONSE_TIME',
        service: 'Frontend',
        value: metrics.frontend.responseTime,
        threshold: ALERT_THRESHOLDS.responseTime,
        message: `Frontend response time (${metrics.frontend.responseTime.toFixed(2)}ms) exceeds threshold`
      });
    }
    
    // Error rate alerts
    if (metrics.loadTest.successRate < (100 - ALERT_THRESHOLDS.errorRate)) {
      alerts.push({
        type: 'HIGH_ERROR_RATE',
        service: 'Load Test',
        value: 100 - metrics.loadTest.successRate,
        threshold: ALERT_THRESHOLDS.errorRate,
        message: `Error rate (${(100 - metrics.loadTest.successRate).toFixed(2)}%) exceeds threshold`
      });
    }
    
    // Service availability alerts
    if (!metrics.api.success) {
      alerts.push({
        type: 'SERVICE_DOWN',
        service: 'API',
        message: 'API service is not responding'
      });
    }
    
    if (!metrics.frontend.success) {
      alerts.push({
        type: 'SERVICE_DOWN',
        service: 'Frontend',
        message: 'Frontend service is not responding'
      });
    }
    
    if (!metrics.database.success) {
      alerts.push({
        type: 'SERVICE_DOWN',
        service: 'Database',
        message: 'Database is not responding'
      });
    }
    
    // Cache performance alerts
    if (metrics.cache.success && metrics.cache.hitRate < 50) {
      alerts.push({
        type: 'LOW_CACHE_HIT_RATE',
        service: 'Cache',
        value: metrics.cache.hitRate,
        threshold: 50,
        message: `Cache hit rate (${metrics.cache.hitRate.toFixed(2)}%) is low`
      });
    }
    
    // Log alerts
    alerts.forEach(alert => {
      console.log(`🚨 ALERT: ${alert.message}`);
      this.alerts.push({
        ...alert,
        timestamp: new Date().toISOString()
      });
    });
    
    return alerts;
  }

  generateReport() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    // Filter recent metrics
    const recentMetrics = this.metrics.responseTime.filter(m => 
      new Date(m.timestamp) > oneHourAgo
    );
    
    const recentAlerts = this.alerts.filter(a => 
      new Date(a.timestamp) > oneHourAgo
    );
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 PERFORMANCE MONITORING REPORT');
    console.log('='.repeat(50));
    
    if (recentMetrics.length > 0) {
      const avgApiResponse = recentMetrics.reduce((sum, m) => sum + m.api, 0) / recentMetrics.length;
      const avgFrontendResponse = recentMetrics.reduce((sum, m) => sum + m.frontend, 0) / recentMetrics.length;
      const avgDbResponse = recentMetrics.reduce((sum, m) => sum + m.database, 0) / recentMetrics.length;
      
      console.log(`📈 Average Response Times (Last Hour):`);
      console.log(`  API: ${avgApiResponse.toFixed(2)}ms`);
      console.log(`  Frontend: ${avgFrontendResponse.toFixed(2)}ms`);
      console.log(`  Database: ${avgDbResponse.toFixed(2)}ms`);
    }
    
    console.log(`🚨 Alerts in Last Hour: ${recentAlerts.length}`);
    
    if (recentAlerts.length > 0) {
      console.log('\nRecent Alerts:');
      recentAlerts.slice(-5).forEach(alert => {
        console.log(`  - ${alert.type}: ${alert.message}`);
      });
    }
    
    // Performance score
    const criticalAlerts = recentAlerts.filter(a => 
      a.type === 'SERVICE_DOWN' || a.type === 'HIGH_ERROR_RATE'
    ).length;
    
    let score = 100;
    score -= criticalAlerts * 20;
    score -= Math.max(0, recentAlerts.length - criticalAlerts) * 5;
    score = Math.max(0, score);
    
    console.log(`\n🎯 Performance Score: ${score}%`);
    
    if (score >= 90) {
      console.log('🎉 Excellent performance!');
    } else if (score >= 70) {
      console.log('✅ Good performance');
    } else if (score >= 50) {
      console.log('⚠️  Performance needs attention');
    } else {
      console.log('🚨 Critical performance issues');
    }
  }

  async start() {
    console.log(`🚀 Starting performance monitoring (interval: ${MONITORING_INTERVAL}s)`);
    this.isRunning = true;
    
    while (this.isRunning) {
      try {
        await this.collectMetrics();
        
        // Generate report every 10 cycles
        if (this.metrics.responseTime.length % 10 === 0) {
          this.generateReport();
        }
        
        console.log('---');
        
      } catch (error) {
        console.error('❌ Monitoring error:', error.message);
      }
      
      // Wait for next interval
      await new Promise(resolve => setTimeout(resolve, MONITORING_INTERVAL * 1000));
    }
  }

  stop() {
    console.log('🛑 Stopping performance monitoring');
    this.isRunning = false;
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

// Run monitor if called directly
if (require.main === module) {
  const monitor = new PerformanceMonitor();
  monitor.start().catch(console.error);
}

module.exports = PerformanceMonitor;
