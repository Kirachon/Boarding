#!/bin/bash
# Health check script for Boarding House Monitor

set -e

echo "🏥 Performing comprehensive health checks..."

# Function to check service health
check_service() {
    local service_name=$1
    local url=$2
    local expected_status=${3:-200}
    
    echo "🔍 Checking $service_name..."
    
    if response=$(curl -s -w "%{http_code}" -o /dev/null "$url" 2>/dev/null); then
        if [ "$response" -eq "$expected_status" ]; then
            echo "✅ $service_name is healthy (HTTP $response)"
            return 0
        else
            echo "❌ $service_name returned HTTP $response (expected $expected_status)"
            return 1
        fi
    else
        echo "❌ $service_name is unreachable"
        return 1
    fi
}

# Function to check Docker container health
check_container_health() {
    local container_name=$1
    
    if docker compose -f docker/docker-compose.yml ps --format json | jq -r ".[] | select(.Service==\"$container_name\") | .Health" | grep -q "healthy"; then
        echo "✅ Container $container_name is healthy"
        return 0
    else
        echo "❌ Container $container_name is not healthy"
        return 1
    fi
}

# Check if Docker Compose is running
if ! docker compose -f docker/docker-compose.yml ps > /dev/null 2>&1; then
    echo "❌ Docker Compose services are not running"
    echo "💡 Run 'make dev' to start the development environment"
    exit 1
fi

echo "📦 Docker containers status:"
docker compose -f docker/docker-compose.yml ps

echo ""
echo "🔍 Performing service health checks..."

# Initialize health check results
all_healthy=true

# Check main application health
if ! check_service "Application" "http://localhost/health"; then
    all_healthy=false
fi

# Check backend API health
if ! check_service "Backend API" "http://localhost/api/health" 200; then
    all_healthy=false
fi

# Check if frontend is serving content
if ! check_service "Frontend" "http://localhost" 200; then
    all_healthy=false
fi

# Check individual container health (if available)
echo ""
echo "🐳 Container health status:"

containers=("postgres" "redis" "backend" "frontend" "nginx")
for container in "${containers[@]}"; do
    if docker compose -f docker/docker-compose.yml ps --format json | jq -r ".[] | select(.Service==\"$container\") | .Name" > /dev/null 2>&1; then
        if ! check_container_health "$container"; then
            all_healthy=false
        fi
    else
        echo "⚠️ Container $container not found"
    fi
done

# Database connectivity check
echo ""
echo "🗄️ Database connectivity:"
if docker compose -f docker/docker-compose.yml exec -T postgres pg_isready -U app_user -d boarding_house > /dev/null 2>&1; then
    echo "✅ PostgreSQL database is ready"
else
    echo "❌ PostgreSQL database is not ready"
    all_healthy=false
fi

# Redis connectivity check
echo ""
echo "🔴 Redis connectivity:"
if docker compose -f docker/docker-compose.yml exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is responding"
else
    echo "❌ Redis is not responding"
    all_healthy=false
fi

# Summary
echo ""
echo "📊 Health Check Summary:"
if [ "$all_healthy" = true ]; then
    echo "✅ All services are healthy!"
    exit 0
else
    echo "❌ Some services are not healthy. Check the logs for more details:"
    echo "📋 View logs with: docker compose -f docker/docker-compose.yml logs"
    exit 1
fi
