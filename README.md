# Boarding House Monitor

A comprehensive boarding house management system with real-time monitoring, expense tracking, and multi-tenant RBAC built with modern open-source technologies.

## 🏗️ Architecture

- **Backend**: Node.js v20.x LTS + Express.js v5.1.0
- **Frontend**: SvelteKit 2.0 + Vite 5.4.0
- **Database**: PostgreSQL 17 with JSONB support
- **Cache**: Redis 7.2 for session and data caching
- **Real-time**: Socket.IO 4.8.0 for WebSocket communication
- **Deployment**: Docker containerization with multi-stage builds

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js v20.x LTS (for local development)
- Git

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Kirachon/Boarding.git
   cd Boarding
   ```

2. **Set up environment variables**
   ```bash
   cp docker/.env.example docker/.env
   ```

3. **Generate secrets**
   ```bash
   mkdir -p secrets
   openssl rand -base64 32 > secrets/db_password.txt
   openssl rand -base64 64 > secrets/jwt_secret.txt
   ```

4. **Start development environment**
   ```bash
   docker compose -f docker/docker-compose.yml up -d
   ```

5. **Run database migrations**
   ```bash
   docker compose exec backend npm run migrate
   ```

6. **Access the application**
   - Application: http://localhost
   - API Documentation: http://localhost/api/docs

## 📁 Project Structure

```
boarding-house-monitor/
├── docker/                    # Docker configuration
├── services/
│   ├── frontend/             # SvelteKit application
│   ├── backend/              # Node.js/Express API
│   └── database/             # Database schemas and migrations
├── infrastructure/           # Infrastructure configuration
├── scripts/                  # Deployment and utility scripts
├── secrets/                  # Secrets and credentials
├── docs/                     # Documentation
└── backups/                  # Database backups
```

## 🔧 Development

### Backend Development
```bash
cd services/backend
npm install
npm run dev
```

### Frontend Development
```bash
cd services/frontend
npm install
npm run dev
```

## 📊 Features

- **Room Management**: Real-time room availability tracking
- **Tenant Management**: Complete tenant lifecycle management
- **Booking System**: Advanced booking with conflict detection
- **Expense Tracking**: Comprehensive expense management with reporting
- **Inventory Management**: Stock level tracking with alerts
- **Real-time Updates**: WebSocket-based live updates
- **Multi-tenant RBAC**: Building-level access control
- **Analytics Dashboard**: ECharts-powered data visualization

## 🛡️ Security

- JWT-based authentication with refresh tokens
- Role-based access control (RBAC)
- Container security hardening
- Secrets management with Docker secrets
- Row-level security in PostgreSQL

## 📈 Performance

- Expected throughput: 5,000-10,000 RPS with Redis caching
- Response times: <100ms cached, <500ms database queries
- Bundle size: <500KB initial load
- Memory usage: ~15MB (Svelte) vs ~45MB (React alternatives)

## 🚀 Deployment

### Production Deployment
```bash
./scripts/deploy.sh
```

### Health Checks
```bash
./scripts/health-check.sh
```

## 📚 Documentation

- [API Documentation](docs/api.md)
- [Deployment Guide](docs/deployment.md)
- [Architecture Overview](docs/architecture.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support, please open an issue on GitHub or contact the development team.