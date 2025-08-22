#!/bin/bash

# Container Security Audit Script
# Validates Docker container security configurations

set -e

echo "🔒 Starting Container Security Audit..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Function to log results
log_result() {
    local level=$1
    local test=$2
    local message=$3
    
    case $level in
        "PASS")
            echo -e "${GREEN}[PASS]${NC} $test: $message"
            ((PASSED++))
            ;;
        "FAIL")
            echo -e "${RED}[FAIL]${NC} $test: $message"
            ((FAILED++))
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} $test: $message"
            ((WARNINGS++))
            ;;
        "INFO")
            echo -e "${BLUE}[INFO]${NC} $test: $message"
            ;;
    esac
}

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running or not accessible"
    exit 1
fi

echo -e "\n=== Docker Configuration Security ==="

# Test 1: Check Docker daemon configuration
if docker info --format '{{.SecurityOptions}}' | grep -q "name=seccomp"; then
    log_result "PASS" "SECCOMP" "Seccomp security profile enabled"
else
    log_result "WARN" "SECCOMP" "Seccomp security profile not detected"
fi

# Test 2: Check for AppArmor/SELinux
if docker info --format '{{.SecurityOptions}}' | grep -q "name=apparmor\|name=selinux"; then
    log_result "PASS" "MAC_SECURITY" "Mandatory Access Control (AppArmor/SELinux) enabled"
else
    log_result "WARN" "MAC_SECURITY" "No Mandatory Access Control detected"
fi

# Test 3: Check Docker version
DOCKER_VERSION=$(docker version --format '{{.Server.Version}}')
log_result "INFO" "DOCKER_VERSION" "Docker version: $DOCKER_VERSION"

echo -e "\n=== Container Image Security ==="

# Get list of images used in the project
IMAGES=$(docker-compose config --services 2>/dev/null | xargs -I {} docker-compose config --format json | jq -r '.services[].image // empty' 2>/dev/null || echo "")

if [ -z "$IMAGES" ]; then
    # Fallback: check common image names
    IMAGES="postgres:17-alpine redis:7-alpine node:20-alpine"
fi

for image in $IMAGES; do
    if [ -n "$image" ]; then
        echo -e "\n--- Analyzing image: $image ---"
        
        # Test 4: Check if image exists locally
        if docker image inspect "$image" >/dev/null 2>&1; then
            log_result "PASS" "IMAGE_EXISTS" "Image $image found locally"
            
            # Test 5: Check for non-root user
            USER_INFO=$(docker image inspect "$image" --format '{{.Config.User}}' 2>/dev/null || echo "")
            if [ -n "$USER_INFO" ] && [ "$USER_INFO" != "root" ] && [ "$USER_INFO" != "0" ]; then
                log_result "PASS" "NON_ROOT_USER" "Image $image runs as non-root user: $USER_INFO"
            else
                log_result "WARN" "NON_ROOT_USER" "Image $image may run as root user"
            fi
            
            # Test 6: Check for minimal base image (Alpine)
            if echo "$image" | grep -q "alpine"; then
                log_result "PASS" "MINIMAL_IMAGE" "Image $image uses minimal Alpine base"
            else
                log_result "INFO" "MINIMAL_IMAGE" "Image $image does not use Alpine base"
            fi
            
        else
            log_result "WARN" "IMAGE_EXISTS" "Image $image not found locally"
        fi
    fi
done

echo -e "\n=== Docker Compose Security ==="

# Test 7: Check docker-compose.yml security configurations
if [ -f "docker-compose.yml" ]; then
    log_result "INFO" "COMPOSE_FILE" "Found docker-compose.yml"
    
    # Test 8: Check for privileged containers
    if grep -q "privileged.*true" docker-compose.yml; then
        log_result "FAIL" "PRIVILEGED_CONTAINERS" "Privileged containers detected in docker-compose.yml"
    else
        log_result "PASS" "PRIVILEGED_CONTAINERS" "No privileged containers found"
    fi
    
    # Test 9: Check for host network mode
    if grep -q "network_mode.*host" docker-compose.yml; then
        log_result "WARN" "HOST_NETWORK" "Host network mode detected"
    else
        log_result "PASS" "HOST_NETWORK" "No host network mode found"
    fi
    
    # Test 10: Check for volume mounts
    if grep -q "/var/run/docker.sock" docker-compose.yml; then
        log_result "FAIL" "DOCKER_SOCKET" "Docker socket mounted - high security risk"
    else
        log_result "PASS" "DOCKER_SOCKET" "Docker socket not mounted"
    fi
    
    # Test 11: Check for secrets management
    if grep -q "secrets:" docker-compose.yml; then
        log_result "PASS" "SECRETS_MANAGEMENT" "Docker secrets configuration found"
    else
        log_result "WARN" "SECRETS_MANAGEMENT" "No Docker secrets configuration found"
    fi
    
    # Test 12: Check for resource limits
    if grep -q "mem_limit\|cpus\|deploy:" docker-compose.yml; then
        log_result "PASS" "RESOURCE_LIMITS" "Resource limits configured"
    else
        log_result "WARN" "RESOURCE_LIMITS" "No resource limits found"
    fi
    
    # Test 13: Check for restart policies
    if grep -q "restart:" docker-compose.yml; then
        log_result "PASS" "RESTART_POLICY" "Restart policies configured"
    else
        log_result "WARN" "RESTART_POLICY" "No restart policies found"
    fi
    
else
    log_result "WARN" "COMPOSE_FILE" "docker-compose.yml not found"
fi

echo -e "\n=== Running Container Security ==="

# Test 14: Check running containers
RUNNING_CONTAINERS=$(docker ps --format "{{.Names}}" 2>/dev/null || echo "")

if [ -n "$RUNNING_CONTAINERS" ]; then
    for container in $RUNNING_CONTAINERS; do
        echo -e "\n--- Analyzing running container: $container ---"
        
        # Test 15: Check container user
        CONTAINER_USER=$(docker exec "$container" whoami 2>/dev/null || echo "unknown")
        if [ "$CONTAINER_USER" != "root" ]; then
            log_result "PASS" "CONTAINER_USER" "Container $container runs as: $CONTAINER_USER"
        else
            log_result "WARN" "CONTAINER_USER" "Container $container runs as root"
        fi
        
        # Test 16: Check for capabilities
        CAPABILITIES=$(docker inspect "$container" --format '{{.HostConfig.CapAdd}}' 2>/dev/null || echo "")
        if [ "$CAPABILITIES" = "[]" ] || [ -z "$CAPABILITIES" ]; then
            log_result "PASS" "CAPABILITIES" "Container $container has no additional capabilities"
        else
            log_result "WARN" "CAPABILITIES" "Container $container has additional capabilities: $CAPABILITIES"
        fi
        
        # Test 17: Check for read-only filesystem
        READONLY=$(docker inspect "$container" --format '{{.HostConfig.ReadonlyRootfs}}' 2>/dev/null || echo "false")
        if [ "$READONLY" = "true" ]; then
            log_result "PASS" "READONLY_FS" "Container $container has read-only filesystem"
        else
            log_result "INFO" "READONLY_FS" "Container $container filesystem is writable"
        fi
        
        # Test 18: Check for security options
        SECURITY_OPT=$(docker inspect "$container" --format '{{.HostConfig.SecurityOpt}}' 2>/dev/null || echo "")
        if echo "$SECURITY_OPT" | grep -q "no-new-privileges"; then
            log_result "PASS" "NO_NEW_PRIVILEGES" "Container $container has no-new-privileges"
        else
            log_result "WARN" "NO_NEW_PRIVILEGES" "Container $container may allow privilege escalation"
        fi
    done
else
    log_result "INFO" "RUNNING_CONTAINERS" "No running containers found"
fi

echo -e "\n=== Network Security ==="

# Test 19: Check Docker networks
NETWORKS=$(docker network ls --format "{{.Name}}" | grep -v "bridge\|host\|none" || echo "")
if [ -n "$NETWORKS" ]; then
    log_result "PASS" "CUSTOM_NETWORKS" "Custom Docker networks found: $NETWORKS"
else
    log_result "WARN" "CUSTOM_NETWORKS" "No custom Docker networks found"
fi

# Test 20: Check for exposed ports
if [ -f "docker-compose.yml" ]; then
    EXPOSED_PORTS=$(grep -E "^\s*-\s*[0-9]+:" docker-compose.yml || echo "")
    if [ -n "$EXPOSED_PORTS" ]; then
        log_result "INFO" "EXPOSED_PORTS" "Ports exposed to host system"
        echo "$EXPOSED_PORTS" | while read -r port; do
            echo "  $port"
        done
    else
        log_result "PASS" "EXPOSED_PORTS" "No ports directly exposed to host"
    fi
fi

echo -e "\n=== File System Security ==="

# Test 21: Check for sensitive files in build context
if [ -f ".dockerignore" ]; then
    log_result "PASS" "DOCKERIGNORE" ".dockerignore file found"
    
    # Check if common sensitive patterns are ignored
    if grep -q "\.env\|\.git\|node_modules\|\.npm" .dockerignore; then
        log_result "PASS" "DOCKERIGNORE_CONTENT" ".dockerignore excludes sensitive files"
    else
        log_result "WARN" "DOCKERIGNORE_CONTENT" ".dockerignore may not exclude all sensitive files"
    fi
else
    log_result "WARN" "DOCKERIGNORE" ".dockerignore file not found"
fi

# Test 22: Check for secrets in environment files
if find . -name "*.env*" -type f 2>/dev/null | head -1 | grep -q .; then
    log_result "WARN" "ENV_FILES" "Environment files found - ensure they're not in version control"
else
    log_result "PASS" "ENV_FILES" "No environment files found in current directory"
fi

echo -e "\n" + "="*50
echo -e "🔒 CONTAINER SECURITY AUDIT REPORT"
echo -e "="*50
echo -e "✅ Tests Passed: $PASSED"
echo -e "❌ Tests Failed: $FAILED"
echo -e "⚠️  Warnings: $WARNINGS"

TOTAL=$((PASSED + FAILED + WARNINGS))
if [ $TOTAL -gt 0 ]; then
    SCORE=$((PASSED * 100 / TOTAL))
    echo -e "🎯 Security Score: $SCORE%"
fi

if [ $FAILED -eq 0 ]; then
    echo -e "\n🎉 No critical container security issues found!"
    exit 0
else
    echo -e "\n🚨 Critical container security issues detected. Please address immediately."
    exit 1
fi
