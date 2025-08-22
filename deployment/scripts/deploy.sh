#!/bin/bash

# Production Deployment Script
# Automated deployment with zero-downtime and rollback capabilities

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOYMENT_DIR="/opt/boarding-house"
BACKUP_DIR="/opt/boarding-house/backups"
LOG_FILE="/var/log/boarding-house-deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${BLUE}[INFO]${NC} $message"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} $message"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} $message"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[SUCCESS]${NC} $message"
            ;;
    esac
    
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# Error handler
error_exit() {
    log "ERROR" "$1"
    exit 1
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error_exit "This script must be run as root"
    fi
}

# Check prerequisites
check_prerequisites() {
    log "INFO" "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error_exit "Docker is not installed"
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error_exit "Docker Compose is not installed"
    fi
    
    # Check Git
    if ! command -v git &> /dev/null; then
        error_exit "Git is not installed"
    fi
    
    # Check required directories
    mkdir -p "$DEPLOYMENT_DIR" "$BACKUP_DIR"
    mkdir -p /opt/boarding-house/data/{postgres,redis,prometheus,grafana,loki}
    mkdir -p /opt/boarding-house/logs/{nginx,backend,frontend,postgres,redis}
    
    log "SUCCESS" "Prerequisites check completed"
}

# Load environment variables
load_environment() {
    log "INFO" "Loading environment variables..."
    
    if [[ ! -f "$DEPLOYMENT_DIR/.env.prod" ]]; then
        error_exit "Production environment file not found: $DEPLOYMENT_DIR/.env.prod"
    fi
    
    set -a
    source "$DEPLOYMENT_DIR/.env.prod"
    set +a
    
    # Validate required variables
    required_vars=(
        "DB_PASSWORD"
        "REDIS_PASSWORD"
        "JWT_SECRET"
        "JWT_REFRESH_SECRET"
        "GRAFANA_PASSWORD"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            error_exit "Required environment variable $var is not set"
        fi
    done
    
    log "SUCCESS" "Environment variables loaded"
}

# Create database backup
create_backup() {
    log "INFO" "Creating database backup..."
    
    local backup_name="boarding_house_$(date +%Y%m%d_%H%M%S).sql"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    if docker ps --format '{{.Names}}' | grep -q "boarding-postgres"; then
        docker exec boarding-postgres pg_dump -U boarding_user -d boarding_house_prod > "$backup_path"
        
        if [[ $? -eq 0 ]]; then
            log "SUCCESS" "Database backup created: $backup_path"
            
            # Compress backup
            gzip "$backup_path"
            log "INFO" "Backup compressed: $backup_path.gz"
            
            # Clean old backups (keep last 7 days)
            find "$BACKUP_DIR" -name "boarding_house_*.sql.gz" -mtime +7 -delete
            
            echo "$backup_path.gz"
        else
            error_exit "Database backup failed"
        fi
    else
        log "WARN" "Database container not running, skipping backup"
        echo ""
    fi
}

# Pull latest code
pull_code() {
    log "INFO" "Pulling latest code..."
    
    cd "$PROJECT_ROOT"
    
    # Stash any local changes
    git stash push -m "Auto-stash before deployment $(date)"
    
    # Pull latest changes
    git pull origin main
    
    if [[ $? -eq 0 ]]; then
        log "SUCCESS" "Code updated successfully"
    else
        error_exit "Failed to pull latest code"
    fi
}

# Build and deploy services
deploy_services() {
    log "INFO" "Building and deploying services..."
    
    cd "$PROJECT_ROOT/deployment"
    
    # Build images
    log "INFO" "Building Docker images..."
    docker-compose -f docker-compose.prod.yml build --no-cache
    
    if [[ $? -ne 0 ]]; then
        error_exit "Docker build failed"
    fi
    
    # Deploy with zero downtime
    log "INFO" "Deploying services..."
    docker-compose -f docker-compose.prod.yml up -d --remove-orphans
    
    if [[ $? -eq 0 ]]; then
        log "SUCCESS" "Services deployed successfully"
    else
        error_exit "Service deployment failed"
    fi
}

# Health check
health_check() {
    log "INFO" "Performing health checks..."
    
    local max_attempts=30
    local attempt=1
    
    # Check backend health
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s http://localhost/api/health > /dev/null; then
            log "SUCCESS" "Backend health check passed"
            break
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            error_exit "Backend health check failed after $max_attempts attempts"
        fi
        
        log "INFO" "Backend health check attempt $attempt/$max_attempts failed, retrying..."
        sleep 10
        ((attempt++))
    done
    
    # Check frontend health
    attempt=1
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s http://localhost/ > /dev/null; then
            log "SUCCESS" "Frontend health check passed"
            break
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            error_exit "Frontend health check failed after $max_attempts attempts"
        fi
        
        log "INFO" "Frontend health check attempt $attempt/$max_attempts failed, retrying..."
        sleep 10
        ((attempt++))
    done
    
    # Check database health
    if docker exec boarding-postgres pg_isready -U boarding_user -d boarding_house_prod > /dev/null; then
        log "SUCCESS" "Database health check passed"
    else
        error_exit "Database health check failed"
    fi
    
    # Check Redis health
    if docker exec boarding-redis redis-cli ping > /dev/null; then
        log "SUCCESS" "Redis health check passed"
    else
        error_exit "Redis health check failed"
    fi
}

# Setup SSL certificates
setup_ssl() {
    log "INFO" "Setting up SSL certificates..."
    
    local ssl_dir="$DEPLOYMENT_DIR/ssl"
    mkdir -p "$ssl_dir"
    
    # Check if certificates exist
    if [[ -f "$ssl_dir/boardinghouse.com.crt" && -f "$ssl_dir/boardinghouse.com.key" ]]; then
        log "INFO" "SSL certificates already exist"
        
        # Check certificate expiration
        local expiry_date=$(openssl x509 -enddate -noout -in "$ssl_dir/boardinghouse.com.crt" | cut -d= -f2)
        local expiry_timestamp=$(date -d "$expiry_date" +%s)
        local current_timestamp=$(date +%s)
        local days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))
        
        if [[ $days_until_expiry -lt 30 ]]; then
            log "WARN" "SSL certificate expires in $days_until_expiry days"
        else
            log "INFO" "SSL certificate valid for $days_until_expiry days"
        fi
    else
        log "WARN" "SSL certificates not found. Please install certificates manually."
        log "INFO" "Expected locations:"
        log "INFO" "  - $ssl_dir/boardinghouse.com.crt"
        log "INFO" "  - $ssl_dir/boardinghouse.com.key"
        log "INFO" "  - $ssl_dir/api.boardinghouse.com.crt"
        log "INFO" "  - $ssl_dir/api.boardinghouse.com.key"
        log "INFO" "  - $ssl_dir/monitoring.boardinghouse.com.crt"
        log "INFO" "  - $ssl_dir/monitoring.boardinghouse.com.key"
    fi
}

# Setup monitoring
setup_monitoring() {
    log "INFO" "Setting up monitoring..."
    
    # Wait for Prometheus to be ready
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s http://localhost:9090/-/ready > /dev/null; then
            log "SUCCESS" "Prometheus is ready"
            break
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            log "WARN" "Prometheus readiness check failed"
            break
        fi
        
        log "INFO" "Waiting for Prometheus... ($attempt/$max_attempts)"
        sleep 10
        ((attempt++))
    done
    
    # Wait for Grafana to be ready
    attempt=1
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s http://localhost:3001/api/health > /dev/null; then
            log "SUCCESS" "Grafana is ready"
            break
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            log "WARN" "Grafana readiness check failed"
            break
        fi
        
        log "INFO" "Waiting for Grafana... ($attempt/$max_attempts)"
        sleep 10
        ((attempt++))
    done
}

# Cleanup old resources
cleanup() {
    log "INFO" "Cleaning up old resources..."
    
    # Remove unused Docker images
    docker image prune -f
    
    # Remove unused volumes
    docker volume prune -f
    
    # Clean old logs (keep last 30 days)
    find /opt/boarding-house/logs -name "*.log" -mtime +30 -delete
    
    log "SUCCESS" "Cleanup completed"
}

# Rollback function
rollback() {
    local backup_file=$1
    
    log "WARN" "Initiating rollback..."
    
    if [[ -n "$backup_file" && -f "$backup_file" ]]; then
        log "INFO" "Restoring database from backup: $backup_file"
        
        # Stop services
        docker-compose -f "$PROJECT_ROOT/deployment/docker-compose.prod.yml" down
        
        # Restore database
        gunzip -c "$backup_file" | docker exec -i boarding-postgres psql -U boarding_user -d boarding_house_prod
        
        # Restart services
        docker-compose -f "$PROJECT_ROOT/deployment/docker-compose.prod.yml" up -d
        
        log "SUCCESS" "Rollback completed"
    else
        log "ERROR" "No backup file available for rollback"
    fi
}

# Main deployment function
main() {
    log "INFO" "Starting deployment process..."
    
    local backup_file=""
    
    # Trap errors for rollback
    trap 'rollback "$backup_file"' ERR
    
    check_root
    check_prerequisites
    load_environment
    
    backup_file=$(create_backup)
    
    pull_code
    deploy_services
    health_check
    setup_ssl
    setup_monitoring
    cleanup
    
    log "SUCCESS" "Deployment completed successfully!"
    log "INFO" "Application is available at: https://boardinghouse.com"
    log "INFO" "API is available at: https://api.boardinghouse.com"
    log "INFO" "Monitoring is available at: https://monitoring.boardinghouse.com"
    
    # Remove error trap
    trap - ERR
}

# Script entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
