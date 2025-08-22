#!/bin/bash
# Production deployment script for Boarding House Monitor

set -e

echo "🚀 Starting production deployment..."

# Check if required files exist
if [ ! -f "secrets/db_password.txt" ]; then
    echo "❌ Error: Database password file not found. Run 'make setup' first."
    exit 1
fi

if [ ! -f "secrets/jwt_secret.txt" ]; then
    echo "❌ Error: JWT secret file not found. Run 'make setup' first."
    exit 1
fi

if [ ! -f "docker/.env" ]; then
    echo "❌ Error: Environment file not found. Copy docker/.env.example to docker/.env"
    exit 1
fi

# Build and deploy
echo "🏗️ Building Docker images..."
docker compose -f docker/docker-compose.prod.yml build --no-cache

echo "🔄 Stopping existing containers..."
docker compose -f docker/docker-compose.prod.yml down

echo "🚀 Starting production containers..."
docker compose -f docker/docker-compose.prod.yml up -d

echo "⏳ Waiting for services to be healthy..."
sleep 30

# Health check
echo "🏥 Performing health checks..."
max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
    if curl -f http://localhost/health > /dev/null 2>&1; then
        echo "✅ Health check passed!"
        break
    fi
    
    if [ $attempt -eq $max_attempts ]; then
        echo "❌ Health check failed after $max_attempts attempts"
        echo "📋 Container logs:"
        docker compose -f docker/docker-compose.prod.yml logs --tail=50
        exit 1
    fi
    
    echo "⏳ Attempt $attempt/$max_attempts - waiting for services..."
    sleep 10
    ((attempt++))
done

echo "🗄️ Running database migrations..."
docker compose -f docker/docker-compose.prod.yml exec -T backend npm run migrate

echo "✅ Production deployment completed successfully!"
echo "🌐 Application is available at: http://localhost"
echo "📊 Health status: http://localhost/health"

# Show running containers
echo "📦 Running containers:"
docker compose -f docker/docker-compose.prod.yml ps
