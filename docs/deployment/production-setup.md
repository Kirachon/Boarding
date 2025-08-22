# Production Deployment Guide

This guide covers deploying the Boarding House Management System to a production environment with high availability, security, and performance.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Requirements](#server-requirements)
3. [Environment Setup](#environment-setup)
4. [SSL Certificate Setup](#ssl-certificate-setup)
5. [Database Configuration](#database-configuration)
6. [Application Deployment](#application-deployment)
7. [Monitoring Setup](#monitoring-setup)
8. [Backup Configuration](#backup-configuration)
9. [Security Hardening](#security-hardening)
10. [Performance Optimization](#performance-optimization)

## Prerequisites

### Required Software
- **Ubuntu 22.04 LTS** (recommended) or CentOS 8+
- **Docker 24.0+** and **Docker Compose 2.0+**
- **Git** for version control
- **Nginx** (installed via Docker)
- **Certbot** for SSL certificates (if using Let's Encrypt)

### Domain Requirements
- Primary domain: `boardinghouse.com`
- API subdomain: `api.boardinghouse.com`
- Monitoring subdomain: `monitoring.boardinghouse.com`

### Network Requirements
- **Ports 80/443**: HTTP/HTTPS traffic
- **Port 22**: SSH access (secure with key-based auth)
- **Port 9090**: Prometheus (internal only)
- **Port 3001**: Grafana (internal only)

## Server Requirements

### Minimum Requirements
- **CPU**: 4 cores (2.4GHz+)
- **RAM**: 8GB
- **Storage**: 100GB SSD
- **Network**: 1Gbps connection

### Recommended Requirements
- **CPU**: 8 cores (3.0GHz+)
- **RAM**: 16GB
- **Storage**: 500GB NVMe SSD
- **Network**: 10Gbps connection

### Scaling Considerations
- **Load Balancer**: For multiple application instances
- **Database Cluster**: PostgreSQL primary/replica setup
- **Redis Cluster**: For high availability caching
- **CDN**: For static asset delivery

## Environment Setup

### 1. System Preparation

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl wget git unzip htop

# Create application user
sudo useradd -m -s /bin/bash boarding
sudo usermod -aG docker boarding

# Create application directories
sudo mkdir -p /opt/boarding-house
sudo chown -R boarding:boarding /opt/boarding-house
```

### 2. Docker Installation

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Start Docker service
sudo systemctl enable docker
sudo systemctl start docker
```

### 3. Application Setup

```bash
# Switch to application user
sudo su - boarding

# Clone repository
cd /opt/boarding-house
git clone https://github.com/Kirachon/Boarding.git .

# Create production environment file
cp deployment/.env.prod.example deployment/.env.prod
```

### 4. Environment Configuration

Edit `/opt/boarding-house/deployment/.env.prod`:

```bash
# Database Configuration
DB_PASSWORD=your_secure_database_password
POSTGRES_DB=boarding_house_prod
POSTGRES_USER=boarding_user

# Redis Configuration
REDIS_PASSWORD=your_secure_redis_password

# JWT Secrets (generate with: openssl rand -base64 64)
JWT_SECRET=your_jwt_secret_key
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key

# Application Configuration
NODE_ENV=production
CORS_ORIGIN=https://boardinghouse.com
API_URL=https://api.boardinghouse.com

# Monitoring
GRAFANA_PASSWORD=your_grafana_admin_password

# Email Configuration (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# Backup Configuration
BACKUP_S3_BUCKET=your-backup-bucket
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
BCRYPT_ROUNDS=12
```

## SSL Certificate Setup

### Option 1: Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt install -y certbot

# Stop any running web servers
sudo systemctl stop nginx || true

# Generate certificates
sudo certbot certonly --standalone -d boardinghouse.com -d www.boardinghouse.com
sudo certbot certonly --standalone -d api.boardinghouse.com
sudo certbot certonly --standalone -d monitoring.boardinghouse.com

# Copy certificates to application directory
sudo mkdir -p /opt/boarding-house/deployment/ssl
sudo cp /etc/letsencrypt/live/boardinghouse.com/fullchain.pem /opt/boarding-house/deployment/ssl/boardinghouse.com.crt
sudo cp /etc/letsencrypt/live/boardinghouse.com/privkey.pem /opt/boarding-house/deployment/ssl/boardinghouse.com.key
sudo cp /etc/letsencrypt/live/api.boardinghouse.com/fullchain.pem /opt/boarding-house/deployment/ssl/api.boardinghouse.com.crt
sudo cp /etc/letsencrypt/live/api.boardinghouse.com/privkey.pem /opt/boarding-house/deployment/ssl/api.boardinghouse.com.key
sudo cp /etc/letsencrypt/live/monitoring.boardinghouse.com/fullchain.pem /opt/boarding-house/deployment/ssl/monitoring.boardinghouse.com.crt
sudo cp /etc/letsencrypt/live/monitoring.boardinghouse.com/privkey.pem /opt/boarding-house/deployment/ssl/monitoring.boardinghouse.com.key

# Set proper permissions
sudo chown -R boarding:boarding /opt/boarding-house/deployment/ssl
sudo chmod 600 /opt/boarding-house/deployment/ssl/*.key
sudo chmod 644 /opt/boarding-house/deployment/ssl/*.crt
```

### Option 2: Custom SSL Certificates

```bash
# Create SSL directory
mkdir -p /opt/boarding-house/deployment/ssl

# Copy your certificates
cp your-certificates/boardinghouse.com.crt /opt/boarding-house/deployment/ssl/
cp your-certificates/boardinghouse.com.key /opt/boarding-house/deployment/ssl/
cp your-certificates/api.boardinghouse.com.crt /opt/boarding-house/deployment/ssl/
cp your-certificates/api.boardinghouse.com.key /opt/boarding-house/deployment/ssl/
cp your-certificates/monitoring.boardinghouse.com.crt /opt/boarding-house/deployment/ssl/
cp your-certificates/monitoring.boardinghouse.com.key /opt/boarding-house/deployment/ssl/

# Set proper permissions
chmod 600 /opt/boarding-house/deployment/ssl/*.key
chmod 644 /opt/boarding-house/deployment/ssl/*.crt
```

### Certificate Auto-Renewal

```bash
# Create renewal script
sudo tee /opt/boarding-house/scripts/renew-ssl.sh << 'EOF'
#!/bin/bash
certbot renew --quiet
if [ $? -eq 0 ]; then
    # Copy renewed certificates
    cp /etc/letsencrypt/live/boardinghouse.com/fullchain.pem /opt/boarding-house/deployment/ssl/boardinghouse.com.crt
    cp /etc/letsencrypt/live/boardinghouse.com/privkey.pem /opt/boarding-house/deployment/ssl/boardinghouse.com.key
    cp /etc/letsencrypt/live/api.boardinghouse.com/fullchain.pem /opt/boarding-house/deployment/ssl/api.boardinghouse.com.crt
    cp /etc/letsencrypt/live/api.boardinghouse.com/privkey.pem /opt/boarding-house/deployment/ssl/api.boardinghouse.com.key
    cp /etc/letsencrypt/live/monitoring.boardinghouse.com/fullchain.pem /opt/boarding-house/deployment/ssl/monitoring.boardinghouse.com.crt
    cp /etc/letsencrypt/live/monitoring.boardinghouse.com/privkey.pem /opt/boarding-house/deployment/ssl/monitoring.boardinghouse.com.key
    
    # Restart nginx
    docker-compose -f /opt/boarding-house/deployment/docker-compose.prod.yml restart nginx
fi
EOF

sudo chmod +x /opt/boarding-house/scripts/renew-ssl.sh

# Add to crontab
sudo crontab -e
# Add this line:
# 0 3 * * * /opt/boarding-house/scripts/renew-ssl.sh
```

## Database Configuration

### PostgreSQL Optimization

Create `/opt/boarding-house/deployment/postgres/postgresql.conf`:

```ini
# Connection Settings
max_connections = 200
shared_buffers = 2GB
effective_cache_size = 6GB
work_mem = 16MB
maintenance_work_mem = 512MB

# Write-Ahead Logging
wal_buffers = 16MB
checkpoint_completion_target = 0.9
wal_level = replica
max_wal_senders = 3

# Query Planner
random_page_cost = 1.1
effective_io_concurrency = 200

# Logging
log_destination = 'stderr'
logging_collector = on
log_directory = '/var/log/postgresql'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_statement = 'mod'
log_min_duration_statement = 1000
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '

# Performance
shared_preload_libraries = 'pg_stat_statements'
```

### Database Security

Create `/opt/boarding-house/deployment/postgres/pg_hba.conf`:

```ini
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             postgres                                peer
local   all             all                                     peer
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
host    boarding_house_prod boarding_user 172.20.0.0/16        scram-sha-256
```

## Application Deployment

### 1. Build and Deploy

```bash
# Switch to application user
sudo su - boarding
cd /opt/boarding-house

# Run deployment script
sudo ./deployment/scripts/deploy.sh
```

### 2. Manual Deployment Steps

If the automated script fails, deploy manually:

```bash
# Build and start services
cd /opt/boarding-house/deployment
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 3. Database Initialization

```bash
# Run database migrations
docker-compose -f docker-compose.prod.yml exec backend npm run migrate

# Create admin user
docker-compose -f docker-compose.prod.yml exec backend npm run create-admin

# Seed sample data (optional)
docker-compose -f docker-compose.prod.yml exec backend npm run seed
```

## Monitoring Setup

### Grafana Configuration

1. Access Grafana at `https://monitoring.boardinghouse.com`
2. Login with admin credentials from `.env.prod`
3. Import dashboards from `/opt/boarding-house/deployment/monitoring/grafana/dashboards/`

### Prometheus Targets

Verify Prometheus targets at `https://monitoring.boardinghouse.com:9090/targets`

### Alert Configuration

Configure alerts in Grafana:
- **High CPU Usage**: > 80% for 5 minutes
- **High Memory Usage**: > 90% for 5 minutes
- **Database Connection Issues**: Connection failures
- **Application Errors**: Error rate > 5%
- **SSL Certificate Expiry**: < 30 days remaining

## Backup Configuration

### Automated Database Backups

The backup service automatically:
- Creates daily database backups
- Uploads to S3 (if configured)
- Retains backups for 30 days
- Compresses backups to save space

### Manual Backup

```bash
# Create manual backup
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U boarding_user -d boarding_house_prod > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U boarding_user -d boarding_house_prod < backup_file.sql
```

### File System Backups

```bash
# Create backup script
sudo tee /opt/boarding-house/scripts/backup-files.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/boarding-house/backups/files"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup application files
tar -czf $BACKUP_DIR/app_$DATE.tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='logs' \
    /opt/boarding-house/

# Backup uploaded files
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz \
    /opt/boarding-house/deployment/uploads/

# Clean old backups (keep 7 days)
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
EOF

sudo chmod +x /opt/boarding-house/scripts/backup-files.sh

# Add to crontab
sudo crontab -e
# Add: 0 2 * * * /opt/boarding-house/scripts/backup-files.sh
```

## Security Hardening

### Firewall Configuration

```bash
# Install UFW
sudo apt install -y ufw

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (change port if needed)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
```

### System Security

```bash
# Disable root login
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config

# Disable password authentication (use keys only)
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config

# Restart SSH
sudo systemctl restart ssh

# Install fail2ban
sudo apt install -y fail2ban

# Configure fail2ban
sudo tee /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
EOF

sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### Container Security

```bash
# Run security audit
cd /opt/boarding-house
sudo ./tests/security/container-security.sh

# Update containers regularly
docker-compose -f deployment/docker-compose.prod.yml pull
docker-compose -f deployment/docker-compose.prod.yml up -d
```

## Performance Optimization

### System Optimization

```bash
# Optimize kernel parameters
sudo tee -a /etc/sysctl.conf << 'EOF'
# Network optimization
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216

# File system optimization
fs.file-max = 2097152
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5
EOF

sudo sysctl -p
```

### Database Performance

```bash
# Monitor database performance
docker-compose -f docker-compose.prod.yml exec postgres psql -U boarding_user -d boarding_house_prod -c "
SELECT schemaname,tablename,attname,n_distinct,correlation 
FROM pg_stats 
WHERE schemaname = 'public' 
ORDER BY n_distinct DESC;
"

# Analyze query performance
docker-compose -f docker-compose.prod.yml exec postgres psql -U boarding_user -d boarding_house_prod -c "
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;
"
```

### Application Performance

```bash
# Monitor application metrics
curl -s http://localhost:5000/api/health/metrics | grep -E "(response_time|memory_usage|cpu_usage)"

# Check Redis performance
docker-compose -f docker-compose.prod.yml exec redis redis-cli info stats
```

## Health Checks

### Automated Health Monitoring

```bash
# Create health check script
sudo tee /opt/boarding-house/scripts/health-check.sh << 'EOF'
#!/bin/bash

# Check application health
if curl -f -s http://localhost/api/health > /dev/null; then
    echo "✅ Application: Healthy"
else
    echo "❌ Application: Unhealthy"
    exit 1
fi

# Check database
if docker-compose -f /opt/boarding-house/deployment/docker-compose.prod.yml exec postgres pg_isready -U boarding_user > /dev/null; then
    echo "✅ Database: Healthy"
else
    echo "❌ Database: Unhealthy"
    exit 1
fi

# Check Redis
if docker-compose -f /opt/boarding-house/deployment/docker-compose.prod.yml exec redis redis-cli ping > /dev/null; then
    echo "✅ Redis: Healthy"
else
    echo "❌ Redis: Unhealthy"
    exit 1
fi

echo "🎉 All services healthy"
EOF

sudo chmod +x /opt/boarding-house/scripts/health-check.sh

# Run health check
sudo /opt/boarding-house/scripts/health-check.sh
```

## Troubleshooting

### Common Issues

1. **SSL Certificate Issues**
   ```bash
   # Check certificate validity
   openssl x509 -in /opt/boarding-house/deployment/ssl/boardinghouse.com.crt -text -noout
   
   # Test SSL connection
   openssl s_client -connect boardinghouse.com:443
   ```

2. **Database Connection Issues**
   ```bash
   # Check database logs
   docker-compose -f docker-compose.prod.yml logs postgres
   
   # Test database connection
   docker-compose -f docker-compose.prod.yml exec postgres psql -U boarding_user -d boarding_house_prod -c "SELECT 1;"
   ```

3. **Performance Issues**
   ```bash
   # Check resource usage
   docker stats
   
   # Check application logs
   docker-compose -f docker-compose.prod.yml logs backend
   ```

### Log Locations

- **Application Logs**: `/opt/boarding-house/deployment/logs/`
- **Nginx Logs**: `/opt/boarding-house/deployment/logs/nginx/`
- **Database Logs**: `/opt/boarding-house/deployment/logs/postgres/`
- **System Logs**: `/var/log/syslog`

## Maintenance

### Regular Maintenance Tasks

1. **Weekly**:
   - Review monitoring dashboards
   - Check backup integrity
   - Update system packages

2. **Monthly**:
   - Review security logs
   - Optimize database
   - Update application dependencies

3. **Quarterly**:
   - Security audit
   - Performance review
   - Disaster recovery test

### Update Procedure

```bash
# 1. Create backup
sudo /opt/boarding-house/scripts/backup-files.sh

# 2. Pull latest code
cd /opt/boarding-house
git pull origin main

# 3. Deploy updates
sudo ./deployment/scripts/deploy.sh

# 4. Verify deployment
sudo ./scripts/health-check.sh
```

---

**Production deployment complete!** Your Boarding House Management System is now running securely in production with monitoring, backups, and performance optimization.
