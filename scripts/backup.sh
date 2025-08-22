#!/bin/bash
# Database backup script for Boarding House Monitor

set -e

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup-${TIMESTAMP}.sql.gz"
RETENTION_DAYS=7

echo "💾 Starting database backup..."

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if PostgreSQL container is running
if ! docker compose -f docker/docker-compose.yml ps postgres | grep -q "Up"; then
    echo "❌ PostgreSQL container is not running"
    exit 1
fi

# Perform backup
echo "🗄️ Creating database backup: $BACKUP_FILE"
if docker compose -f docker/docker-compose.yml exec -T postgres pg_dump -U app_user boarding_house | gzip > "$BACKUP_DIR/$BACKUP_FILE"; then
    echo "✅ Backup created successfully: $BACKUP_DIR/$BACKUP_FILE"
    
    # Get backup file size
    backup_size=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
    echo "📊 Backup size: $backup_size"
else
    echo "❌ Backup failed"
    exit 1
fi

# Clean up old backups
echo "🧹 Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "backup-*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

# List current backups
echo "📋 Current backups:"
ls -lh "$BACKUP_DIR"/backup-*.sql.gz 2>/dev/null || echo "No backups found"

echo "✅ Backup process completed successfully!"
