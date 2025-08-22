# Boarding House Monitor - Makefile
# Common commands for development and deployment

.PHONY: help setup dev build test clean deploy health logs backup

# Default target
help:
	@echo "Boarding House Monitor - Available Commands:"
	@echo ""
	@echo "Development:"
	@echo "  setup     - Initial project setup with secrets generation"
	@echo "  dev       - Start development environment"
	@echo "  build     - Build all Docker images"
	@echo "  test      - Run all tests"
	@echo "  clean     - Clean up containers and volumes"
	@echo ""
	@echo "Production:"
	@echo "  deploy    - Deploy to production"
	@echo "  health    - Check application health"
	@echo "  logs      - View application logs"
	@echo "  backup    - Create database backup"
	@echo ""

# Initial setup
setup:
	@echo "🚀 Setting up Boarding House Monitor..."
	@mkdir -p secrets
	@if [ ! -f secrets/db_password.txt ]; then \
		echo "Generating database password..."; \
		openssl rand -base64 32 > secrets/db_password.txt; \
	fi
	@if [ ! -f secrets/jwt_secret.txt ]; then \
		echo "Generating JWT secret..."; \
		openssl rand -base64 64 > secrets/jwt_secret.txt; \
	fi
	@if [ ! -f docker/.env ]; then \
		echo "Creating environment file..."; \
		cp docker/.env.example docker/.env; \
	fi
	@echo "✅ Setup complete!"

# Development environment
dev: setup
	@echo "🔧 Starting development environment..."
	docker compose -f docker/docker-compose.yml up -d
	@echo "⏳ Waiting for services to be ready..."
	@sleep 10
	@echo "🗄️ Running database migrations..."
	docker compose -f docker/docker-compose.yml exec backend npm run migrate || true
	@echo "✅ Development environment ready!"
	@echo "📱 Application: http://localhost"
	@echo "📚 API Docs: http://localhost/api/docs"

# Build all images
build:
	@echo "🏗️ Building Docker images..."
	docker compose -f docker/docker-compose.yml build --no-cache

# Run tests
test:
	@echo "🧪 Running tests..."
	docker compose -f docker/docker-compose.yml exec backend npm test
	docker compose -f docker/docker-compose.yml exec frontend npm test

# Clean up
clean:
	@echo "🧹 Cleaning up containers and volumes..."
	docker compose -f docker/docker-compose.yml down -v
	docker system prune -f

# Production deployment
deploy:
	@echo "🚀 Deploying to production..."
	./scripts/deploy.sh

# Health check
health:
	@echo "🏥 Checking application health..."
	./scripts/health-check.sh

# View logs
logs:
	@echo "📋 Viewing application logs..."
	docker compose -f docker/docker-compose.yml logs -f

# Database backup
backup:
	@echo "💾 Creating database backup..."
	./scripts/backup.sh

# Install dependencies
install:
	@echo "📦 Installing dependencies..."
	cd services/backend && npm install
	cd services/frontend && npm install

# Database operations
db-migrate:
	@echo "🗄️ Running database migrations..."
	docker compose -f docker/docker-compose.yml exec backend npm run migrate

db-seed:
	@echo "🌱 Seeding database..."
	docker compose -f docker/docker-compose.yml exec backend npm run seed

db-reset:
	@echo "🔄 Resetting database..."
	docker compose -f docker/docker-compose.yml exec backend npm run db:reset

# Development helpers
dev-backend:
	@echo "🔧 Starting backend in development mode..."
	cd services/backend && npm run dev

dev-frontend:
	@echo "🔧 Starting frontend in development mode..."
	cd services/frontend && npm run dev

# Linting and formatting
lint:
	@echo "🔍 Running linters..."
	cd services/backend && npm run lint
	cd services/frontend && npm run lint

format:
	@echo "✨ Formatting code..."
	cd services/backend && npm run format
	cd services/frontend && npm run format
