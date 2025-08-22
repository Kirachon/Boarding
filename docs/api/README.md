# API Documentation

## Overview

The Boarding House Management System provides a comprehensive RESTful API built with Node.js and Express.js. The API follows OpenAPI 3.0 specifications and includes real-time WebSocket capabilities.

## Base URL

- **Development**: `http://localhost:5000/api`
- **Production**: `https://api.boardinghouse.com/api`

## Authentication

All API endpoints require JWT authentication except for public health checks and authentication endpoints.

### Getting a Token

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "roles": [
        {
          "buildingId": 1,
          "buildingName": "Main Building",
          "role": "house_manager"
        }
      ]
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Using the Token

Include the JWT token in the Authorization header:

```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Refresh

```bash
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## Core Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/login` | User login |
| POST | `/register` | User registration |
| POST | `/logout` | User logout |
| POST | `/refresh` | Refresh JWT token |
| GET | `/profile` | Get user profile |
| PUT | `/profile` | Update user profile |
| PUT | `/password` | Change password |

### Buildings (`/api/buildings`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all buildings |
| POST | `/` | Create new building |
| GET | `/:id` | Get building by ID |
| PUT | `/:id` | Update building |
| DELETE | `/:id` | Delete building |
| GET | `/:id/stats` | Get building statistics |

### Rooms (`/api/rooms`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all rooms |
| POST | `/` | Create new room |
| GET | `/:id` | Get room by ID |
| PUT | `/:id` | Update room |
| DELETE | `/:id` | Delete room |
| GET | `/:id/availability` | Get room availability |
| PUT | `/:id/status` | Update room status |

### Tenants (`/api/tenants`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all tenants |
| POST | `/` | Create new tenant |
| GET | `/:id` | Get tenant by ID |
| PUT | `/:id` | Update tenant |
| DELETE | `/:id` | Delete tenant |
| POST | `/:id/documents` | Upload tenant document |
| GET | `/:id/documents` | Get tenant documents |

### Bookings (`/api/bookings`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all bookings |
| POST | `/` | Create new booking |
| GET | `/:id` | Get booking by ID |
| PUT | `/:id` | Update booking |
| DELETE | `/:id` | Cancel booking |
| POST | `/:id/checkin` | Check-in tenant |
| POST | `/:id/checkout` | Check-out tenant |

### Expenses (`/api/expenses`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all expenses |
| POST | `/` | Create new expense |
| GET | `/:id` | Get expense by ID |
| PUT | `/:id` | Update expense |
| DELETE | `/:id` | Delete expense |
| GET | `/categories` | Get expense categories |
| GET | `/reports` | Get expense reports |

### Inventory (`/api/inventory`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all inventory items |
| POST | `/` | Create new inventory item |
| GET | `/:id` | Get inventory item by ID |
| PUT | `/:id` | Update inventory item |
| DELETE | `/:id` | Delete inventory item |
| POST | `/:id/stock` | Update stock levels |
| GET | `/alerts` | Get low stock alerts |

## Query Parameters

### Pagination

All list endpoints support pagination:

```bash
GET /api/rooms?page=1&limit=10
```

Parameters:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

### Sorting

```bash
GET /api/rooms?sort=roomNumber&order=asc
```

Parameters:
- `sort`: Field to sort by
- `order`: Sort order (`asc` or `desc`)

### Filtering

```bash
GET /api/rooms?status=available&type=single&buildingId=1
```

### Search

```bash
GET /api/tenants?search=john
```

Full-text search across relevant fields.

### Date Ranges

```bash
GET /api/bookings?startDate=2024-01-01&endDate=2024-12-31
```

## Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      }
    ]
  }
}
```

## HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 400 | Bad Request - Invalid request data |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource already exists |
| 422 | Unprocessable Entity - Validation failed |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |

## Rate Limiting

API requests are rate-limited to prevent abuse:

- **General API**: 100 requests per 15 minutes per IP
- **Authentication**: 5 requests per 15 minutes per IP
- **File uploads**: 10 requests per hour per user

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset time (Unix timestamp)

## WebSocket API

### Connection

```javascript
import { io } from 'socket.io-client';

const socket = io('ws://localhost:5000', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Events

#### Client to Server

| Event | Description | Payload |
|-------|-------------|---------|
| `subscribe:room` | Subscribe to room updates | `roomId` |
| `unsubscribe:room` | Unsubscribe from room updates | `roomId` |
| `subscribe:building` | Subscribe to building updates | `buildingId` |
| `ping` | Ping server | - |

#### Server to Client

| Event | Description | Payload |
|-------|-------------|---------|
| `connected` | Connection established | `{ user, accessibleBuildings }` |
| `room:updated` | Room data updated | `{ roomId, data }` |
| `room:availability_changed` | Room availability changed | `{ roomId, status }` |
| `booking:updated` | Booking updated | `{ bookingId, data }` |
| `inventory:low_stock_alert` | Low stock alert | `{ itemId, currentStock, minStock }` |
| `notification` | System notification | `{ title, message, type }` |
| `pong` | Ping response | `{ timestamp }` |

### Example Usage

```javascript
// Subscribe to room updates
socket.emit('subscribe:room', 123);

// Listen for room updates
socket.on('room:updated', (data) => {
  console.log('Room updated:', data);
  updateRoomInUI(data.roomId, data.data);
});

// Listen for notifications
socket.on('notification', (notification) => {
  showNotification(notification.title, notification.message);
});
```

## Error Handling

### Common Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `AUTHENTICATION_FAILED` | Invalid credentials |
| `AUTHORIZATION_FAILED` | Insufficient permissions |
| `RESOURCE_NOT_FOUND` | Requested resource not found |
| `RESOURCE_CONFLICT` | Resource already exists |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `SERVER_ERROR` | Internal server error |

### Handling Errors

```javascript
try {
  const response = await fetch('/api/rooms', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error.message);
  }
  
  return data.data;
} catch (error) {
  console.error('API Error:', error.message);
  // Handle error appropriately
}
```

## Testing the API

### Using cURL

```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@boardinghouse.com","password":"admin123"}'

# Get rooms
curl -X GET http://localhost:5000/api/rooms \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create room
curl -X POST http://localhost:5000/api/rooms \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "buildingId": 1,
    "roomNumber": "101",
    "type": "single",
    "monthlyRate": 500
  }'
```

### Using Postman

1. Import the OpenAPI specification from `/api/docs/json`
2. Set up environment variables for base URL and token
3. Use the pre-configured requests

## OpenAPI Specification

The complete OpenAPI 3.0 specification is available at:
- **JSON**: `/api/docs/json`
- **YAML**: `/api/docs/yaml`
- **Interactive UI**: `/api/docs`

## SDK and Client Libraries

Official client libraries are available for:
- **JavaScript/TypeScript**: `@boarding-house/api-client`
- **Python**: `boarding-house-client`
- **PHP**: `boarding-house/api-client`

## Support

For API support:
- **Documentation**: [API Docs](https://api.boardinghouse.com/docs)
- **Issues**: [GitHub Issues](https://github.com/Kirachon/Boarding/issues)
- **Email**: api-support@boardinghouse.com
