#!/bin/bash

# ============================================
# Command Validation
# ============================================
REQUIRED_CMDS=(psql pg_dump gzip gunzip)
for cmd in "${REQUIRED_CMDS[@]}"; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "\033[0;31mError: Required command '$cmd' not found. Please install it and try again.\033[0m"
    exit 1
  fi
done

# ============================================
# Database Dump & Restore Manager
# ============================================
# Usage:
#   ./scripts/db-manager.sh dump [filename]
#   ./scripts/db-manager.sh restore <filename>
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
else
  echo -e "${RED}Error: .env file not found${NC}"
  exit 1
fi

# Parse DATABASE_URL
parse_db_url() {
  # Extract components from DATABASE_URL
  # Format: postgresql://user:password@host:port/database
  DB_URL=$DATABASE_URL
  
  # Remove protocol
  DB_URL=${DB_URL#postgresql://}
  
  # Extract user and password
  DB_USER_PASS=${DB_URL%%@*}
  export PGUSER=${DB_USER_PASS%%:*}
  export PGPASSWORD=${DB_USER_PASS#*:}
  
  # Extract host, port, and database
  DB_HOST_PORT_DB=${DB_URL#*@}
  DB_HOST_PORT=${DB_HOST_PORT_DB%%/*}
  export PGHOST=${DB_HOST_PORT%%:*}
  export PGPORT=${DB_HOST_PORT#*:}
  export PGDATABASE=${DB_HOST_PORT_DB#*/}
  
  # Remove query parameters if any
  export PGDATABASE=${PGDATABASE%%\?*}
}

# Create backup directory if it doesn't exist
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

# Function to perform database dump
dump_database() {
  local filename=$1
  
  # Generate filename if not provided
  if [ -z "$filename" ]; then
    filename="opensheets_$(date +%Y%m%d_%H%M%S).sql"
  fi
  
  # Add .sql extension if not present
  if [[ ! "$filename" =~ \.sql$ ]]; then
    filename="${filename}.sql"
  fi
  
  local filepath="${BACKUP_DIR}/${filename}"
  
  echo -e "${BLUE}Starting database dump...${NC}"
  echo -e "${YELLOW}Database: ${PGDATABASE}${NC}"
  echo -e "${YELLOW}Host: ${PGHOST}:${PGPORT}${NC}"
  echo -e "${YELLOW}Output: ${filepath}${NC}"
  
  # Perform the dump
  pg_dump \
    --host="$PGHOST" \
    --port="$PGPORT" \
    --username="$PGUSER" \
    --dbname="$PGDATABASE" \
    --no-password \
    --format=plain \
    --clean \
    --if-exists \
    --create \
    --encoding=UTF8 \
    --verbose \
    --file="$filepath" 2>&1 | grep -v "^pg_dump: "
  
  if [ $? -eq 0 ]; then
    local filesize=$(du -h "$filepath" | cut -f1)
    echo -e "${GREEN}✓ Database dump completed successfully!${NC}"
    echo -e "${GREEN}File: ${filepath} (${filesize})${NC}"
    
    # Create a compressed version
    echo -e "${BLUE}Creating compressed backup...${NC}"
    gzip -c "$filepath" > "${filepath}.gz"
    local gzsize=$(du -h "${filepath}.gz" | cut -f1)
    echo -e "${GREEN}✓ Compressed backup: ${filepath}.gz (${gzsize})${NC}"
  else
    echo -e "${RED}✗ Database dump failed!${NC}"
    exit 1
  fi
}

# Function to restore database
restore_database() {
  local filename=$1
  
  if [ -z "$filename" ]; then
    echo -e "${RED}Error: Please specify a backup file to restore${NC}"
    echo -e "${YELLOW}Usage: ./scripts/db-manager.sh restore <filename>${NC}"
    echo -e "${YELLOW}Available backups:${NC}"
    ls -lh "$BACKUP_DIR"/*.sql 2>/dev/null || echo "No backups found"
    exit 1
  fi
  
  # Check if file exists
  local filepath
  if [ -f "$filename" ]; then
    filepath="$filename"
  elif [ -f "${BACKUP_DIR}/${filename}" ]; then
    filepath="${BACKUP_DIR}/${filename}"
  elif [ -f "${BACKUP_DIR}/${filename}.sql" ]; then
    filepath="${BACKUP_DIR}/${filename}.sql"
  elif [ -f "${filename}.gz" ]; then
    filepath="${filename}.gz"
  elif [ -f "${BACKUP_DIR}/${filename}.gz" ]; then
    filepath="${BACKUP_DIR}/${filename}.gz"
  else
    echo -e "${RED}Error: Backup file not found: ${filename}${NC}"
    echo -e "${YELLOW}Available backups:${NC}"
    ls -lh "$BACKUP_DIR"/*.sql "$BACKUP_DIR"/*.sql.gz 2>/dev/null || echo "No backups found"
    exit 1
  fi
  
  echo -e "${YELLOW}⚠ WARNING: This will DROP and RECREATE the database!${NC}"
  echo -e "${YELLOW}Database: ${PGDATABASE}${NC}"
  echo -e "${YELLOW}Host: ${PGHOST}:${PGPORT}${NC}"
  echo -e "${YELLOW}Backup file: ${filepath}${NC}"
  echo -e "${RED}All existing data will be lost!${NC}"
  echo ""
  read -p "Are you sure you want to continue? (yes/no): " confirm
  
  if [ "$confirm" != "yes" ]; then
    echo -e "${BLUE}Restore cancelled.${NC}"
    exit 0
  fi
  
  echo -e "${BLUE}Starting database restore...${NC}"
  
  # Handle gzipped files
  local restore_status=0
  if [[ "$filepath" =~ \.gz$ ]]; then
    echo -e "${BLUE}Decompressing backup file...${NC}"
    gunzip -c "$filepath" | psql \
      --host="$PGHOST" \
      --port="$PGPORT" \
      --username="$PGUSER" \
      --no-password \
      --quiet
    restore_status=${PIPESTATUS[1]}
  else
    psql \
      --host="$PGHOST" \
      --port="$PGPORT" \
      --username="$PGUSER" \
      --no-password \
      --quiet \
      --file="$filepath"
    restore_status=$?
  fi
  
  if [ $restore_status -eq 0 ]; then
    echo -e "${GREEN}✓ Database restored successfully!${NC}"
  else
    echo -e "${RED}✗ Database restore failed!${NC}"
    echo -e "${RED}See above for error details from psql.${NC}"
    exit 1
  fi
}

# Function to list backups
list_backups() {
  echo -e "${BLUE}Available backups:${NC}"
  echo ""
  
  if ls "$BACKUP_DIR"/*.sql "$BACKUP_DIR"/*.sql.gz 2>/dev/null | grep -q .; then
    ls -lh "$BACKUP_DIR"/*.sql "$BACKUP_DIR"/*.sql.gz 2>/dev/null | awk '{print $9, "(" $5 ")"}'
  else
    echo -e "${YELLOW}No backups found in ${BACKUP_DIR}${NC}"
  fi
}

# Main script logic
main() {
  local action=$1
  shift
  
  # Parse database URL
  parse_db_url
  
  case "$action" in
    dump|backup)
      dump_database "$@"
      ;;
    restore)
      restore_database "$@"
      ;;
    list|ls)
      list_backups
      ;;
    *)
      echo -e "${RED}Invalid action: ${action}${NC}"
      echo ""
      echo -e "${YELLOW}Usage:${NC}"
      echo -e "  ${GREEN}./scripts/db-manager.sh dump [filename]${NC}    - Create a database backup"
      echo -e "  ${GREEN}./scripts/db-manager.sh restore <filename>${NC} - Restore from backup"
      echo -e "  ${GREEN}./scripts/db-manager.sh list${NC}               - List available backups"
      echo ""
      echo -e "${YELLOW}Examples:${NC}"
      echo -e "  ./scripts/db-manager.sh dump"
      echo -e "  ./scripts/db-manager.sh dump my-backup"
      echo -e "  ./scripts/db-manager.sh restore opensheets_20260204_143022.sql"
      echo -e "  ./scripts/db-manager.sh restore my-backup.sql.gz"
      exit 1
      ;;
  esac
}

# Run main function
main "$@"
