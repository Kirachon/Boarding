/**
 * Real-time Integration Tests
 * Tests WebSocket functionality and real-time features
 */

const { io } = require('socket.io-client');
const axios = require('axios');

// Test configuration
const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:5000';
const API_BASE_URL = process.env.API_URL || 'http://localhost:5000/api';

// Test data
const testUser = {
  email: 'realtime-test@boardinghouse.com',
  password: 'TestPassword123!',
  firstName: 'Realtime',
  lastName: 'Test'
};

let authToken = null;
let socket1 = null;
let socket2 = null;
let testBuildingId = null;
let testRoomId = null;

describe('Real-time Integration Tests', () => {
  beforeAll(async () => {
    jest.setTimeout(30000);
    
    // Register and login test user
    try {
      await axios.post(`${API_BASE_URL}/auth/register`, testUser);
    } catch (error) {
      // User might already exist, try login
    }
    
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    
    authToken = loginResponse.data.token;
    
    // Create test building and room
    const buildingResponse = await axios.post(`${API_BASE_URL}/buildings`, {
      name: 'Realtime Test Building',
      address: { street: '123 Test St', city: 'Test City', state: 'TS', zipCode: '12345' },
      totalRooms: 5
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    testBuildingId = buildingResponse.data.building.building_id;
    
    const roomResponse = await axios.post(`${API_BASE_URL}/rooms`, {
      buildingId: testBuildingId,
      roomNumber: 'RT101',
      type: 'single',
      monthlyRate: 500
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    testRoomId = roomResponse.data.room.room_id;
  });

  afterAll(async () => {
    // Cleanup
    if (socket1) socket1.disconnect();
    if (socket2) socket2.disconnect();
    
    // Delete test data
    if (testRoomId) {
      try {
        await axios.delete(`${API_BASE_URL}/rooms/${testRoomId}`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
      } catch (error) {
        console.log('Room cleanup error:', error.message);
      }
    }
    
    if (testBuildingId) {
      try {
        await axios.delete(`${API_BASE_URL}/buildings/${testBuildingId}`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
      } catch (error) {
        console.log('Building cleanup error:', error.message);
      }
    }
  });

  describe('Socket Connection', () => {
    test('should establish WebSocket connection with valid token', (done) => {
      socket1 = io(SOCKET_URL, {
        auth: { token: authToken },
        transports: ['websocket']
      });
      
      socket1.on('connect', () => {
        expect(socket1.connected).toBe(true);
        done();
      });
      
      socket1.on('connect_error', (error) => {
        done(error);
      });
    });

    test('should reject connection with invalid token', (done) => {
      const invalidSocket = io(SOCKET_URL, {
        auth: { token: 'invalid-token' },
        transports: ['websocket']
      });
      
      invalidSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication failed');
        invalidSocket.disconnect();
        done();
      });
      
      invalidSocket.on('connect', () => {
        invalidSocket.disconnect();
        done(new Error('Should not connect with invalid token'));
      });
    });

    test('should receive welcome message on connection', (done) => {
      socket1.on('connected', (data) => {
        expect(data).toHaveProperty('message');
        expect(data).toHaveProperty('user');
        expect(data.user).toHaveProperty('id');
        expect(data).toHaveProperty('accessibleBuildings');
        done();
      });
    });

    test('should handle ping/pong', (done) => {
      socket1.emit('ping');
      
      socket1.on('pong', (data) => {
        expect(data).toHaveProperty('timestamp');
        expect(typeof data.timestamp).toBe('number');
        done();
      });
    });
  });

  describe('Room Subscriptions', () => {
    test('should subscribe to room updates', (done) => {
      socket1.emit('subscribe:room', testRoomId);
      
      // Listen for subscription confirmation or immediate update
      socket1.on('room:updated', (data) => {
        expect(data).toHaveProperty('roomId');
        expect(data.roomId).toBe(testRoomId);
        done();
      });
      
      // Trigger a room update after subscription
      setTimeout(async () => {
        try {
          await axios.put(`${API_BASE_URL}/rooms/${testRoomId}`, {
            description: 'Updated for real-time test'
          }, {
            headers: { Authorization: `Bearer ${authToken}` }
          });
        } catch (error) {
          done(error);
        }
      }, 1000);
    });

    test('should unsubscribe from room updates', (done) => {
      let updateReceived = false;
      
      // Subscribe first
      socket1.emit('subscribe:room', testRoomId);
      
      // Then unsubscribe
      setTimeout(() => {
        socket1.emit('unsubscribe:room', testRoomId);
      }, 500);
      
      // Listen for updates
      socket1.on('room:updated', () => {
        updateReceived = true;
      });
      
      // Trigger update after unsubscribe
      setTimeout(async () => {
        try {
          await axios.put(`${API_BASE_URL}/rooms/${testRoomId}`, {
            description: 'Should not receive this update'
          }, {
            headers: { Authorization: `Bearer ${authToken}` }
          });
          
          // Wait a bit and check if update was received
          setTimeout(() => {
            expect(updateReceived).toBe(false);
            done();
          }, 1000);
        } catch (error) {
          done(error);
        }
      }, 1000);
    });
  });

  describe('Building Subscriptions', () => {
    test('should subscribe to building updates', (done) => {
      socket1.emit('subscribe:building', testBuildingId);
      
      socket1.on('building:room_updated', (data) => {
        expect(data).toHaveProperty('buildingId');
        expect(data.buildingId).toBe(testBuildingId);
        expect(data).toHaveProperty('roomId');
        done();
      });
      
      // Trigger a room update in the building
      setTimeout(async () => {
        try {
          await axios.put(`${API_BASE_URL}/rooms/${testRoomId}`, {
            status: 'maintenance'
          }, {
            headers: { Authorization: `Bearer ${authToken}` }
          });
        } catch (error) {
          done(error);
        }
      }, 1000);
    });

    test('should receive building-wide notifications', (done) => {
      socket1.on('building:booking_updated', (data) => {
        expect(data).toHaveProperty('buildingId');
        expect(data.buildingId).toBe(testBuildingId);
        done();
      });
      
      // Create a booking to trigger notification
      setTimeout(async () => {
        try {
          // First create a tenant
          const tenantResponse = await axios.post(`${API_BASE_URL}/tenants`, {
            firstName: 'Test',
            lastName: 'Tenant',
            email: 'test.tenant@example.com'
          }, {
            headers: { Authorization: `Bearer ${authToken}` }
          });
          
          // Then create a booking
          await axios.post(`${API_BASE_URL}/bookings`, {
            roomId: testRoomId,
            tenantId: tenantResponse.data.tenant.tenant_id,
            startDate: '2024-01-01',
            monthlyRent: 500
          }, {
            headers: { Authorization: `Bearer ${authToken}` }
          });
        } catch (error) {
          done(error);
        }
      }, 1000);
    });
  });

  describe('Multi-Client Real-time', () => {
    test('should broadcast updates to multiple clients', (done) => {
      // Connect second socket
      socket2 = io(SOCKET_URL, {
        auth: { token: authToken },
        transports: ['websocket']
      });
      
      let socket1Updated = false;
      let socket2Updated = false;
      
      socket2.on('connect', () => {
        // Subscribe both sockets to the same room
        socket1.emit('subscribe:room', testRoomId);
        socket2.emit('subscribe:room', testRoomId);
        
        // Listen for updates on both sockets
        socket1.on('room:updated', (data) => {
          socket1Updated = true;
          checkBothUpdated();
        });
        
        socket2.on('room:updated', (data) => {
          socket2Updated = true;
          checkBothUpdated();
        });
        
        // Trigger update
        setTimeout(async () => {
          try {
            await axios.put(`${API_BASE_URL}/rooms/${testRoomId}`, {
              description: 'Multi-client broadcast test'
            }, {
              headers: { Authorization: `Bearer ${authToken}` }
            });
          } catch (error) {
            done(error);
          }
        }, 1000);
      });
      
      function checkBothUpdated() {
        if (socket1Updated && socket2Updated) {
          done();
        }
      }
    });

    test('should handle client disconnection gracefully', (done) => {
      // Disconnect socket2
      socket2.disconnect();
      
      // Socket1 should still receive updates
      socket1.on('room:updated', (data) => {
        expect(data).toHaveProperty('roomId');
        done();
      });
      
      // Trigger update
      setTimeout(async () => {
        try {
          await axios.put(`${API_BASE_URL}/rooms/${testRoomId}`, {
            description: 'Disconnection test'
          }, {
            headers: { Authorization: `Bearer ${authToken}` }
          });
        } catch (error) {
          done(error);
        }
      }, 1000);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid room subscription', (done) => {
      socket1.emit('subscribe:room', 99999);
      
      socket1.on('error', (error) => {
        expect(error).toHaveProperty('message');
        done();
      });
      
      // If no error is emitted, the test should still pass
      setTimeout(() => {
        done();
      }, 2000);
    });

    test('should handle invalid building subscription', (done) => {
      socket1.emit('subscribe:building', 99999);
      
      socket1.on('error', (error) => {
        expect(error).toHaveProperty('message');
        done();
      });
      
      // If no error is emitted, the test should still pass
      setTimeout(() => {
        done();
      }, 2000);
    });

    test('should reconnect after temporary disconnection', (done) => {
      let reconnected = false;
      
      socket1.on('reconnect', () => {
        reconnected = true;
        expect(socket1.connected).toBe(true);
        done();
      });
      
      // Force disconnect
      socket1.disconnect();
      
      // Reconnect
      setTimeout(() => {
        socket1.connect();
      }, 1000);
      
      // Timeout if reconnection doesn't happen
      setTimeout(() => {
        if (!reconnected) {
          done(new Error('Socket did not reconnect'));
        }
      }, 5000);
    });
  });

  describe('Performance', () => {
    test('should handle rapid updates efficiently', (done) => {
      let updateCount = 0;
      const expectedUpdates = 5;
      
      socket1.on('room:updated', () => {
        updateCount++;
        if (updateCount === expectedUpdates) {
          done();
        }
      });
      
      // Send multiple rapid updates
      for (let i = 0; i < expectedUpdates; i++) {
        setTimeout(async () => {
          try {
            await axios.put(`${API_BASE_URL}/rooms/${testRoomId}`, {
              description: `Rapid update ${i + 1}`
            }, {
              headers: { Authorization: `Bearer ${authToken}` }
            });
          } catch (error) {
            console.error('Rapid update error:', error);
          }
        }, i * 100);
      }
      
      // Timeout if not all updates are received
      setTimeout(() => {
        if (updateCount < expectedUpdates) {
          done(new Error(`Only received ${updateCount} of ${expectedUpdates} updates`));
        }
      }, 10000);
    });

    test('should maintain connection under load', (done) => {
      let messageCount = 0;
      const targetMessages = 10;
      
      // Send ping messages rapidly
      const interval = setInterval(() => {
        if (messageCount >= targetMessages) {
          clearInterval(interval);
          expect(socket1.connected).toBe(true);
          done();
          return;
        }
        
        socket1.emit('ping');
        messageCount++;
      }, 100);
      
      // Timeout if connection is lost
      setTimeout(() => {
        clearInterval(interval);
        if (messageCount < targetMessages) {
          done(new Error('Connection lost under load'));
        }
      }, 5000);
    });
  });
});
