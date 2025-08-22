/**
 * Full-Stack Integration Tests
 * Tests complete frontend-backend integration workflows
 */

const axios = require('axios');
const { io } = require('socket.io-client');

// Test configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:5000/api';
const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:5000';
const TEST_TIMEOUT = 30000;

// Test data
const testUser = {
  email: 'test@boardinghouse.com',
  password: 'TestPassword123!',
  firstName: 'Test',
  lastName: 'User'
};

const testBuilding = {
  name: 'Test Building',
  address: {
    street: '123 Test Street',
    city: 'Test City',
    state: 'TS',
    zipCode: '12345',
    country: 'Test Country'
  },
  totalRooms: 10,
  description: 'Test building for integration testing'
};

const testRoom = {
  roomNumber: 'T101',
  type: 'single',
  floorNumber: 1,
  sizeSqft: 150,
  monthlyRate: 500,
  securityDeposit: 250,
  description: 'Test room for integration testing'
};

const testTenant = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  phone: '+1234567890',
  dateOfBirth: '1990-01-01'
};

let authToken = null;
let testBuildingId = null;
let testRoomId = null;
let testTenantId = null;
let testBookingId = null;
let socket = null;

describe('Full-Stack Integration Tests', () => {
  beforeAll(async () => {
    // Set test timeout
    jest.setTimeout(TEST_TIMEOUT);
  });

  afterAll(async () => {
    // Cleanup: disconnect socket
    if (socket) {
      socket.disconnect();
    }
  });

  describe('Authentication Flow', () => {
    test('should register a new user', async () => {
      const response = await axios.post(`${API_BASE_URL}/auth/register`, testUser);
      
      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('token');
      expect(response.data).toHaveProperty('user');
      expect(response.data.user.email).toBe(testUser.email);
      
      authToken = response.data.token;
    });

    test('should login with valid credentials', async () => {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: testUser.email,
        password: testUser.password
      });
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('token');
      expect(response.data).toHaveProperty('user');
      
      authToken = response.data.token;
    });

    test('should get user profile with valid token', async () => {
      const response = await axios.get(`${API_BASE_URL}/auth/profile`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      expect(response.status).toBe(200);
      expect(response.data.user.email).toBe(testUser.email);
    });

    test('should reject requests with invalid token', async () => {
      try {
        await axios.get(`${API_BASE_URL}/auth/profile`, {
          headers: { Authorization: 'Bearer invalid-token' }
        });
      } catch (error) {
        expect(error.response.status).toBe(401);
      }
    });
  });

  describe('Buildings Management', () => {
    test('should create a new building', async () => {
      const response = await axios.post(`${API_BASE_URL}/buildings`, testBuilding, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('building');
      expect(response.data.building.name).toBe(testBuilding.name);
      
      testBuildingId = response.data.building.building_id;
    });

    test('should get buildings list', async () => {
      const response = await axios.get(`${API_BASE_URL}/buildings`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('buildings');
      expect(Array.isArray(response.data.buildings)).toBe(true);
    });

    test('should get building by ID', async () => {
      const response = await axios.get(`${API_BASE_URL}/buildings/${testBuildingId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      expect(response.status).toBe(200);
      expect(response.data.building.building_id).toBe(testBuildingId);
    });

    test('should update building', async () => {
      const updateData = { description: 'Updated test building description' };
      
      const response = await axios.put(`${API_BASE_URL}/buildings/${testBuildingId}`, updateData, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      expect(response.status).toBe(200);
      expect(response.data.building.description).toBe(updateData.description);
    });
  });

  describe('Rooms Management', () => {
    test('should create a new room', async () => {
      const roomData = { ...testRoom, buildingId: testBuildingId };
      
      const response = await axios.post(`${API_BASE_URL}/rooms`, roomData, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('room');
      expect(response.data.room.room_number).toBe(testRoom.roomNumber);
      
      testRoomId = response.data.room.room_id;
    });

    test('should get rooms list with filters', async () => {
      const response = await axios.get(`${API_BASE_URL}/rooms?buildingId=${testBuildingId}&status=available`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('rooms');
      expect(response.data).toHaveProperty('pagination');
    });

    test('should get room availability', async () => {
      const response = await axios.get(`${API_BASE_URL}/rooms/${testRoomId}/availability`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('availability');
    });
  });

  describe('Tenants Management', () => {
    test('should create a new tenant', async () => {
      const response = await axios.post(`${API_BASE_URL}/tenants`, testTenant, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('tenant');
      expect(response.data.tenant.email).toBe(testTenant.email);
      
      testTenantId = response.data.tenant.tenant_id;
    });

    test('should get tenants list', async () => {
      const response = await axios.get(`${API_BASE_URL}/tenants`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('tenants');
    });

    test('should search tenants', async () => {
      const response = await axios.get(`${API_BASE_URL}/tenants?search=john`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      expect(response.status).toBe(200);
      expect(response.data.tenants.length).toBeGreaterThan(0);
    });
  });

  describe('Bookings Management', () => {
    test('should create a new booking', async () => {
      const bookingData = {
        roomId: testRoomId,
        tenantId: testTenantId,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        monthlyRent: 500,
        securityDeposit: 250
      };
      
      const response = await axios.post(`${API_BASE_URL}/bookings`, bookingData, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('booking');
      expect(response.data.booking.room_id).toBe(testRoomId);
      
      testBookingId = response.data.booking.booking_id;
    });

    test('should get bookings list', async () => {
      const response = await axios.get(`${API_BASE_URL}/bookings`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('bookings');
    });

    test('should filter bookings by date range', async () => {
      const response = await axios.get(`${API_BASE_URL}/bookings?startDate=2024-01-01&endDate=2024-12-31`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      expect(response.status).toBe(200);
      expect(response.data.bookings.length).toBeGreaterThan(0);
    });
  });

  describe('Real-time Features', () => {
    test('should establish WebSocket connection', (done) => {
      socket = io(SOCKET_URL, {
        auth: { token: authToken },
        transports: ['websocket']
      });
      
      socket.on('connect', () => {
        expect(socket.connected).toBe(true);
        done();
      });
      
      socket.on('connect_error', (error) => {
        done(error);
      });
    });

    test('should receive welcome message', (done) => {
      socket.on('connected', (data) => {
        expect(data).toHaveProperty('message');
        expect(data).toHaveProperty('user');
        done();
      });
    });

    test('should subscribe to room updates', (done) => {
      socket.emit('subscribe:room', testRoomId);
      
      // Listen for room updates
      socket.on('room:updated', (data) => {
        expect(data).toHaveProperty('roomId');
        expect(data.roomId).toBe(testRoomId);
        done();
      });
      
      // Trigger a room update
      setTimeout(async () => {
        await axios.put(`${API_BASE_URL}/rooms/${testRoomId}`, {
          description: 'Updated via real-time test'
        }, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
      }, 1000);
    });

    test('should subscribe to building updates', (done) => {
      socket.emit('subscribe:building', testBuildingId);
      
      socket.on('building:room_updated', (data) => {
        expect(data).toHaveProperty('buildingId');
        expect(data.buildingId).toBe(testBuildingId);
        done();
      });
      
      // Trigger a building-related update
      setTimeout(async () => {
        await axios.put(`${API_BASE_URL}/rooms/${testRoomId}`, {
          status: 'maintenance'
        }, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
      }, 1000);
    });
  });

  describe('Health and Monitoring', () => {
    test('should get basic health status', async () => {
      const response = await axios.get(`${API_BASE_URL}/health`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status');
      expect(response.data.status).toBe('healthy');
    });

    test('should get detailed health status', async () => {
      const response = await axios.get(`${API_BASE_URL}/health/detailed`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('checks');
      expect(response.data.checks).toHaveProperty('database');
      expect(response.data.checks).toHaveProperty('redis');
    });

    test('should get real-time status', async () => {
      const response = await axios.get(`${API_BASE_URL}/health/realtime`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('connected');
    });

    test('should get system metrics', async () => {
      const response = await axios.get(`${API_BASE_URL}/health/metrics`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('memory');
      expect(response.data).toHaveProperty('uptime');
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 for non-existent resources', async () => {
      try {
        await axios.get(`${API_BASE_URL}/buildings/99999`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
      } catch (error) {
        expect(error.response.status).toBe(404);
        expect(error.response.data).toHaveProperty('error');
      }
    });

    test('should handle validation errors', async () => {
      try {
        await axios.post(`${API_BASE_URL}/rooms`, {
          // Missing required fields
          roomNumber: ''
        }, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
      } catch (error) {
        expect(error.response.status).toBe(400);
        expect(error.response.data).toHaveProperty('error');
      }
    });

    test('should handle authorization errors', async () => {
      try {
        await axios.delete(`${API_BASE_URL}/buildings/${testBuildingId}`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
      } catch (error) {
        expect(error.response.status).toBe(403);
      }
    });
  });

  describe('Cleanup', () => {
    test('should delete test booking', async () => {
      const response = await axios.delete(`${API_BASE_URL}/bookings/${testBookingId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      expect(response.status).toBe(200);
    });

    test('should delete test room', async () => {
      const response = await axios.delete(`${API_BASE_URL}/rooms/${testRoomId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      expect(response.status).toBe(200);
    });

    test('should delete test tenant', async () => {
      const response = await axios.delete(`${API_BASE_URL}/tenants/${testTenantId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      expect(response.status).toBe(200);
    });

    test('should delete test building', async () => {
      const response = await axios.delete(`${API_BASE_URL}/buildings/${testBuildingId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      expect(response.status).toBe(200);
    });

    test('should logout user', async () => {
      const response = await axios.post(`${API_BASE_URL}/auth/logout`, {}, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      expect(response.status).toBe(200);
    });
  });
});
