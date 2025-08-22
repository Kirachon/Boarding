/**
 * Jest Setup Configuration
 * Global test setup and utilities
 */

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
  // Wait for a condition to be true
  waitFor: async (condition, timeout = 5000, interval = 100) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error(`Condition not met within ${timeout}ms`);
  },

  // Generate random test data
  generateTestData: {
    email: () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`,
    phone: () => `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
    roomNumber: () => `T${Math.floor(Math.random() * 900) + 100}`,
    buildingName: () => `Test Building ${Date.now()}`,
    tenantName: () => ({
      firstName: `TestFirst${Math.random().toString(36).substr(2, 5)}`,
      lastName: `TestLast${Math.random().toString(36).substr(2, 5)}`
    })
  },

  // API helpers
  api: {
    baseURL: process.env.API_URL || 'http://localhost:5000/api',
    
    // Create authenticated axios instance
    createAuthenticatedClient: (token) => {
      const axios = require('axios');
      return axios.create({
        baseURL: global.testUtils.api.baseURL,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
    },

    // Register and login test user
    createTestUser: async () => {
      const axios = require('axios');
      const userData = {
        email: global.testUtils.generateTestData.email(),
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User'
      };

      try {
        // Try to register
        const registerResponse = await axios.post(`${global.testUtils.api.baseURL}/auth/register`, userData);
        return {
          user: registerResponse.data.user,
          token: registerResponse.data.token,
          credentials: userData
        };
      } catch (registerError) {
        // If registration fails, try login (user might already exist)
        try {
          const loginResponse = await axios.post(`${global.testUtils.api.baseURL}/auth/login`, {
            email: userData.email,
            password: userData.password
          });
          return {
            user: loginResponse.data.user,
            token: loginResponse.data.token,
            credentials: userData
          };
        } catch (loginError) {
          throw new Error(`Failed to create test user: ${loginError.message}`);
        }
      }
    }
  },

  // Socket helpers
  socket: {
    url: process.env.SOCKET_URL || 'http://localhost:5000',
    
    // Create authenticated socket connection
    createConnection: (token) => {
      const { io } = require('socket.io-client');
      return io(global.testUtils.socket.url, {
        auth: { token },
        transports: ['websocket'],
        timeout: 10000
      });
    },

    // Wait for socket event
    waitForEvent: (socket, event, timeout = 5000) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Event '${event}' not received within ${timeout}ms`));
        }, timeout);

        socket.once(event, (data) => {
          clearTimeout(timer);
          resolve(data);
        });
      });
    }
  },

  // Database helpers
  db: {
    // Clean up test data
    cleanup: async (token) => {
      const client = global.testUtils.api.createAuthenticatedClient(token);
      
      try {
        // Get all test resources and delete them
        const [buildings, rooms, tenants, bookings] = await Promise.all([
          client.get('/buildings').catch(() => ({ data: { buildings: [] } })),
          client.get('/rooms').catch(() => ({ data: { rooms: [] } })),
          client.get('/tenants').catch(() => ({ data: { tenants: [] } })),
          client.get('/bookings').catch(() => ({ data: { bookings: [] } }))
        ]);

        // Delete in reverse dependency order
        for (const booking of bookings.data.bookings || []) {
          if (booking.booking_id) {
            await client.delete(`/bookings/${booking.booking_id}`).catch(() => {});
          }
        }

        for (const room of rooms.data.rooms || []) {
          if (room.room_id) {
            await client.delete(`/rooms/${room.room_id}`).catch(() => {});
          }
        }

        for (const tenant of tenants.data.tenants || []) {
          if (tenant.tenant_id) {
            await client.delete(`/tenants/${tenant.tenant_id}`).catch(() => {});
          }
        }

        for (const building of buildings.data.buildings || []) {
          if (building.building_id) {
            await client.delete(`/buildings/${building.building_id}`).catch(() => {});
          }
        }
      } catch (error) {
        console.warn('Cleanup warning:', error.message);
      }
    }
  }
};

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Console override for cleaner test output
const originalConsoleError = console.error;
console.error = (...args) => {
  // Filter out known non-critical errors
  const message = args.join(' ');
  if (
    message.includes('Warning: ReactDOM.render is deprecated') ||
    message.includes('Warning: componentWillReceiveProps has been renamed') ||
    message.includes('socket hang up') ||
    message.includes('ECONNRESET')
  ) {
    return;
  }
  originalConsoleError.apply(console, args);
};

// Test environment validation
beforeAll(async () => {
  // Check if required services are running
  const axios = require('axios');
  const apiUrl = process.env.API_URL || 'http://localhost:5000/api';
  
  try {
    await axios.get(`${apiUrl}/health`, { timeout: 5000 });
  } catch (error) {
    console.warn('Warning: API server may not be running. Some tests may fail.');
  }
});

// Global cleanup
afterAll(async () => {
  // Give time for async operations to complete
  await new Promise(resolve => setTimeout(resolve, 1000));
});
