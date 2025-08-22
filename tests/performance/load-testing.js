/**
 * Load Testing Script
 * Performance testing for the boarding house management system
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:5000/api';
const CONCURRENT_USERS = parseInt(process.env.CONCURRENT_USERS) || 10;
const TEST_DURATION = parseInt(process.env.TEST_DURATION) || 60; // seconds
const RAMP_UP_TIME = parseInt(process.env.RAMP_UP_TIME) || 10; // seconds

class LoadTester {
  constructor() {
    this.results = {
      requests: [],
      errors: [],
      summary: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        requestsPerSecond: 0,
        errorRate: 0
      }
    };
    this.authTokens = [];
    this.testData = {
      buildings: [],
      rooms: [],
      tenants: []
    };
  }

  async setupTestData() {
    console.log('🔧 Setting up test data...');
    
    // Create test users and get auth tokens
    for (let i = 0; i < Math.min(CONCURRENT_USERS, 5); i++) {
      try {
        const userData = {
          email: `loadtest-${Date.now()}-${i}@example.com`,
          password: 'LoadTest123!',
          firstName: 'Load',
          lastName: `Test${i}`
        };
        
        const response = await axios.post(`${API_BASE_URL}/auth/register`, userData);
        this.authTokens.push(response.data.token);
      } catch (error) {
        console.warn(`Failed to create test user ${i}:`, error.message);
      }
    }
    
    if (this.authTokens.length === 0) {
      throw new Error('No auth tokens available for testing');
    }
    
    // Create test buildings
    const token = this.authTokens[0];
    for (let i = 0; i < 3; i++) {
      try {
        const buildingData = {
          name: `Load Test Building ${i}`,
          address: {
            street: `${100 + i} Test Street`,
            city: 'Load Test City',
            state: 'LT',
            zipCode: `1234${i}`,
            country: 'Test Country'
          },
          totalRooms: 20,
          description: `Building for load testing ${i}`
        };
        
        const response = await axios.post(`${API_BASE_URL}/buildings`, buildingData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        this.testData.buildings.push(response.data.building);
      } catch (error) {
        console.warn(`Failed to create test building ${i}:`, error.message);
      }
    }
    
    // Create test rooms
    for (const building of this.testData.buildings) {
      for (let i = 0; i < 5; i++) {
        try {
          const roomData = {
            buildingId: building.building_id,
            roomNumber: `LT${i + 1}`,
            type: ['single', 'double', 'suite'][i % 3],
            floorNumber: Math.floor(i / 2) + 1,
            monthlyRate: 500 + (i * 50),
            description: `Load test room ${i}`
          };
          
          const response = await axios.post(`${API_BASE_URL}/rooms`, roomData, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          this.testData.rooms.push(response.data.room);
        } catch (error) {
          console.warn(`Failed to create test room ${i}:`, error.message);
        }
      }
    }
    
    console.log(`✅ Test data created: ${this.testData.buildings.length} buildings, ${this.testData.rooms.length} rooms`);
  }

  async makeRequest(method, endpoint, data = null, token = null) {
    const startTime = performance.now();
    const requestId = Math.random().toString(36).substr(2, 9);
    
    try {
      const config = {
        method,
        url: `${API_BASE_URL}${endpoint}`,
        timeout: 10000
      };
      
      if (token) {
        config.headers = { Authorization: `Bearer ${token}` };
      }
      
      if (data) {
        config.data = data;
      }
      
      const response = await axios(config);
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      this.results.requests.push({
        id: requestId,
        method,
        endpoint,
        status: response.status,
        responseTime,
        timestamp: new Date().toISOString(),
        success: true
      });
      
      return response;
    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      this.results.errors.push({
        id: requestId,
        method,
        endpoint,
        error: error.message,
        status: error.response?.status || 0,
        responseTime,
        timestamp: new Date().toISOString()
      });
      
      this.results.requests.push({
        id: requestId,
        method,
        endpoint,
        status: error.response?.status || 0,
        responseTime,
        timestamp: new Date().toISOString(),
        success: false
      });
      
      throw error;
    }
  }

  async simulateUserSession(userId, duration) {
    const token = this.authTokens[userId % this.authTokens.length];
    const endTime = Date.now() + (duration * 1000);
    
    while (Date.now() < endTime) {
      try {
        // Simulate typical user workflow
        const actions = [
          // Dashboard access
          () => this.makeRequest('GET', '/health', null, token),
          
          // List buildings
          () => this.makeRequest('GET', '/buildings', null, token),
          
          // List rooms with filters
          () => this.makeRequest('GET', '/rooms?page=1&limit=10', null, token),
          
          // Get specific room
          () => {
            if (this.testData.rooms.length > 0) {
              const room = this.testData.rooms[Math.floor(Math.random() * this.testData.rooms.length)];
              return this.makeRequest('GET', `/rooms/${room.room_id}`, null, token);
            }
          },
          
          // Search rooms
          () => this.makeRequest('GET', '/rooms?search=test&status=available', null, token),
          
          // List tenants
          () => this.makeRequest('GET', '/tenants', null, token),
          
          // List bookings
          () => this.makeRequest('GET', '/bookings', null, token),
          
          // Update room (write operation)
          () => {
            if (this.testData.rooms.length > 0) {
              const room = this.testData.rooms[Math.floor(Math.random() * this.testData.rooms.length)];
              return this.makeRequest('PUT', `/rooms/${room.room_id}`, {
                description: `Updated by load test at ${Date.now()}`
              }, token);
            }
          }
        ];
        
        // Execute random action
        const action = actions[Math.floor(Math.random() * actions.length)];
        if (action) {
          await action();
        }
        
        // Wait between requests (simulate user think time)
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
        
      } catch (error) {
        // Continue testing even if individual requests fail
        continue;
      }
    }
  }

  async runLoadTest() {
    console.log(`🚀 Starting load test with ${CONCURRENT_USERS} concurrent users for ${TEST_DURATION} seconds...`);
    
    const startTime = Date.now();
    const promises = [];
    
    // Ramp up users gradually
    for (let i = 0; i < CONCURRENT_USERS; i++) {
      const delay = (i / CONCURRENT_USERS) * RAMP_UP_TIME * 1000;
      
      promises.push(
        new Promise(resolve => {
          setTimeout(async () => {
            try {
              await this.simulateUserSession(i, TEST_DURATION - (delay / 1000));
            } catch (error) {
              console.warn(`User ${i} session error:`, error.message);
            }
            resolve();
          }, delay);
        })
      );
    }
    
    // Wait for all user sessions to complete
    await Promise.all(promises);
    
    const endTime = Date.now();
    const actualDuration = (endTime - startTime) / 1000;
    
    this.calculateSummary(actualDuration);
    this.generateReport();
  }

  calculateSummary(duration) {
    const { requests } = this.results;
    
    this.results.summary.totalRequests = requests.length;
    this.results.summary.successfulRequests = requests.filter(r => r.success).length;
    this.results.summary.failedRequests = requests.filter(r => !r.success).length;
    
    if (requests.length > 0) {
      const responseTimes = requests.map(r => r.responseTime);
      this.results.summary.averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      this.results.summary.minResponseTime = Math.min(...responseTimes);
      this.results.summary.maxResponseTime = Math.max(...responseTimes);
      this.results.summary.requestsPerSecond = requests.length / duration;
      this.results.summary.errorRate = (this.results.summary.failedRequests / this.results.summary.totalRequests) * 100;
    }
  }

  generateReport() {
    const { summary } = this.results;
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 LOAD TEST REPORT');
    console.log('='.repeat(50));
    console.log(`📈 Total Requests: ${summary.totalRequests}`);
    console.log(`✅ Successful: ${summary.successfulRequests}`);
    console.log(`❌ Failed: ${summary.failedRequests}`);
    console.log(`📊 Error Rate: ${summary.errorRate.toFixed(2)}%`);
    console.log(`⚡ Requests/Second: ${summary.requestsPerSecond.toFixed(2)}`);
    console.log(`⏱️  Average Response Time: ${summary.averageResponseTime.toFixed(2)}ms`);
    console.log(`🏃 Min Response Time: ${summary.minResponseTime.toFixed(2)}ms`);
    console.log(`🐌 Max Response Time: ${summary.maxResponseTime.toFixed(2)}ms`);
    
    // Performance thresholds
    const thresholds = {
      averageResponseTime: 1000, // 1 second
      errorRate: 5, // 5%
      requestsPerSecond: 10 // minimum RPS
    };
    
    console.log('\n📋 PERFORMANCE ANALYSIS:');
    
    if (summary.averageResponseTime <= thresholds.averageResponseTime) {
      console.log('✅ Average response time within acceptable limits');
    } else {
      console.log(`❌ Average response time too high (>${thresholds.averageResponseTime}ms)`);
    }
    
    if (summary.errorRate <= thresholds.errorRate) {
      console.log('✅ Error rate within acceptable limits');
    } else {
      console.log(`❌ Error rate too high (>${thresholds.errorRate}%)`);
    }
    
    if (summary.requestsPerSecond >= thresholds.requestsPerSecond) {
      console.log('✅ Throughput meets minimum requirements');
    } else {
      console.log(`❌ Throughput below minimum (${thresholds.requestsPerSecond} RPS)`);
    }
    
    // Response time percentiles
    const responseTimes = this.results.requests.map(r => r.responseTime).sort((a, b) => a - b);
    if (responseTimes.length > 0) {
      const p50 = responseTimes[Math.floor(responseTimes.length * 0.5)];
      const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];
      const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)];
      
      console.log('\n📊 RESPONSE TIME PERCENTILES:');
      console.log(`50th percentile: ${p50.toFixed(2)}ms`);
      console.log(`95th percentile: ${p95.toFixed(2)}ms`);
      console.log(`99th percentile: ${p99.toFixed(2)}ms`);
    }
    
    // Top errors
    if (this.results.errors.length > 0) {
      console.log('\n❌ TOP ERRORS:');
      const errorCounts = {};
      this.results.errors.forEach(error => {
        const key = `${error.status} - ${error.error}`;
        errorCounts[key] = (errorCounts[key] || 0) + 1;
      });
      
      Object.entries(errorCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .forEach(([error, count]) => {
          console.log(`  ${count}x ${error}`);
        });
    }
  }

  async cleanup() {
    console.log('🧹 Cleaning up test data...');
    
    const token = this.authTokens[0];
    if (!token) return;
    
    // Delete test rooms
    for (const room of this.testData.rooms) {
      try {
        await axios.delete(`${API_BASE_URL}/rooms/${room.room_id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    // Delete test buildings
    for (const building of this.testData.buildings) {
      try {
        await axios.delete(`${API_BASE_URL}/buildings/${building.building_id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    console.log('✅ Cleanup completed');
  }

  async run() {
    try {
      await this.setupTestData();
      await this.runLoadTest();
    } catch (error) {
      console.error('Load test failed:', error);
    } finally {
      await this.cleanup();
    }
  }
}

// Run load test if called directly
if (require.main === module) {
  const tester = new LoadTester();
  tester.run().catch(console.error);
}

module.exports = LoadTester;
