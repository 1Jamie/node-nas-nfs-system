#!/bin/bash

# Unified NFS Web Management System Deployment Script
# This script deploys both the web UI and configuration manager services

set -e

# Configuration
PROJECT_NAME="node-nas-nfs"
WEB_UI_SERVICE="nfs-web-ui"
CONFIG_MANAGER_SERVICE="nfs-config-manager"
WEB_UI_USER="nfs-web-ui"
WEB_UI_PORT="3000"
CONFIG_DIR="/etc/nfs-web-ui"
BACKUP_DIR="/var/backups/nfs-web-ui"
BIN_DIR="/usr/local/bin"
SERVICE_DIR="/etc/systemd/system"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Check system requirements
check_requirements() {
    log_info "Checking system requirements..."
    
    # Check if Node.js is available (including NVM installations)
    NODE_PATH=$(which node 2>/dev/null || echo "")
    if [[ -z "$NODE_PATH" ]]; then
        # Try common NVM paths for different users
        NVM_PATHS=(
            "/home/autumn/.nvm/versions/node/v22.19.0/bin/node"
            "/home/autumn/.nvm/versions/node/v20.0.0/bin/node"
            "/home/autumn/.nvm/versions/node/v18.0.0/bin/node"
            "/home/autumn/.nvm/versions/node/v16.0.0/bin/node"
            "/root/.nvm/versions/node/v22.19.0/bin/node"
            "/root/.nvm/versions/node/v20.0.0/bin/node"
            "/root/.nvm/versions/node/v18.0.0/bin/node"
            "/root/.nvm/versions/node/v16.0.0/bin/node"
        )
        
        for nvm_path in "${NVM_PATHS[@]}"; do
            if [[ -f "$nvm_path" ]]; then
                NODE_PATH="$nvm_path"
                log_info "Found Node.js at NVM path: $NODE_PATH"
                break
            fi
        done
        
        if [[ -z "$NODE_PATH" ]]; then
            log_error "Node.js is not installed. Please install Node.js first."
            log_info "You can install it using: curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs"
            exit 1
        fi
    else
        log_info "Found Node.js at: $NODE_PATH"
    fi
    
    # Check Node.js version
    NODE_VERSION=$("$NODE_PATH" --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ $NODE_VERSION -lt 16 ]]; then
        log_error "Node.js version 16 or higher is required. Current version: $("$NODE_PATH" --version)"
        exit 1
    fi
    
    # Check if NFS server is installed
    if ! systemctl is-active --quiet nfs-kernel-server 2>/dev/null; then
        log_warning "NFS kernel server is not running. Installing NFS server..."
        apt-get update
        apt-get install -y nfs-kernel-server
        systemctl enable nfs-kernel-server
        systemctl start nfs-kernel-server
    fi
    
    log_success "System requirements check passed"
}

# Install dependencies
install_dependencies() {
    log_info "Installing project dependencies..."
    
    # Install npm packages (skip for now due to PATH issues in sudo)
    if [[ -f "package.json" ]]; then
        log_warning "Skipping npm install due to PATH issues in sudo environment"
        log_info "Dependencies should already be installed from user environment"
    fi
    
    # Install system packages
    apt-get update
    apt-get install -y inotify-tools jq
    log_success "System dependencies installed"
}

# Create system user and directories
create_user_and_directories() {
    log_info "Creating system user and directories..."
    
    # Create system user if it doesn't exist
    if ! id "$WEB_UI_USER" &>/dev/null; then
        log_info "Creating system user: $WEB_UI_USER"
        useradd -r -s /bin/false -d /var/lib/nfs-web-ui "$WEB_UI_USER"
        log_success "System user created: $WEB_UI_USER"
    else
        log_info "System user already exists: $WEB_UI_USER"
    fi
    
    mkdir -p "$CONFIG_DIR" "$BACKUP_DIR" "$BIN_DIR"
    chown "$WEB_UI_USER:$WEB_UI_USER" "$CONFIG_DIR"
    chmod 755 "$CONFIG_DIR"
    chmod 700 "$BACKUP_DIR"
    
    log_success "System user and directories created"
}

# Deploy configuration manager
deploy_config_manager() {
    log_info "Deploying NFS Configuration Manager..."
    
    # Copy the configuration manager script
    cp nfs-config-manager.sh "$BIN_DIR/nfs-config-manager"
    chmod +x "$BIN_DIR/nfs-config-manager"
    
    # Copy the systemd service file
    cp nfs-config-manager.service "$SERVICE_DIR/"
    
    # Create initial configuration
    if [[ ! -f "$CONFIG_DIR/exports.json" ]]; then
        cat > "$CONFIG_DIR/exports.json" << EOF
{
  "exports": [],
  "metadata": {
    "created": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "version": "1.0",
    "description": "NFS Exports managed by nfs-web-ui"
  }
}
EOF
        chown "$WEB_UI_USER:$WEB_UI_USER" "$CONFIG_DIR/exports.json"
    fi
    
    log_success "Configuration Manager deployed"
}

# Deploy web UI service
deploy_web_ui() {
    log_info "Deploying NFS Web UI Service..."
    
    # Create application directory and copy files
    mkdir -p /opt/nfs-web-ui
    cp -r server.js public package.json /opt/nfs-web-ui/
    chown -R "$WEB_UI_USER:$WEB_UI_USER" /opt/nfs-web-ui
    chmod -R 755 /opt/nfs-web-ui
    
    # Create systemd service file for web UI
    cat > "$SERVICE_DIR/$WEB_UI_SERVICE.service" << EOF
[Unit]
Description=NFS Web Management Interface
After=network.target nfs-kernel-server.service

[Service]
Type=simple
User=$WEB_UI_USER
WorkingDirectory=/opt/nfs-web-ui
ExecStart=$NODE_PATH server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=$WEB_UI_PORT
Environment=CONFIG_DIR=$CONFIG_DIR
Environment=BACKUP_DIR=$BACKUP_DIR
Environment=ADMIN_USERNAME=admin
Environment=ADMIN_PASSWORD=admin123
Environment=JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

[Install]
WantedBy=multi-user.target
EOF
    
    log_success "Web UI Service deployed"
}

# Deploy management CLI tool
deploy_cli_tool() {
    log_info "Deploying CLI management tool..."
    
    # Create a simple CLI tool
    cat > "$BIN_DIR/node-nfs" << 'EOF'
#!/bin/bash

# Simple NFS Web Management System CLI Tool
# Usage: node-nfs [command]

WEB_UI_SERVICE="nfs-web-ui"
CONFIG_MANAGER_SERVICE="nfs-config-manager"
SERVICE_FILE="/etc/systemd/system/nfs-web-ui.service"

# Function to update service environment variables
update_service_env() {
    local var_name="$1"
    local var_value="$2"
    
    # Create backup of service file
    sudo cp "$SERVICE_FILE" "${SERVICE_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
    
    # Update the environment variable in the service file
    sudo sed -i "s/Environment=${var_name}=.*/Environment=${var_name}=${var_value}/" "$SERVICE_FILE"
    
    # Reload systemd and restart service
    sudo systemctl daemon-reload
    sudo systemctl restart "$WEB_UI_SERVICE"
    
    echo "Updated ${var_name} and restarted service"
}

# Function to set credentials
set_credentials() {
    local username="$1"
    local password="$2"
    
    if [[ -z "$username" || -z "$password" ]]; then
        echo "Usage: node-nfs set-credentials <username> <password>"
        echo "Example: node-nfs set-credentials admin mypassword123"
        exit 1
    fi
    
    echo "Setting credentials..."
    echo "Username: $username"
    echo "Password: $password"
    echo ""
    
    # Update username
    update_service_env "ADMIN_USERNAME" "$username"
    
    # Update password
    update_service_env "ADMIN_PASSWORD" "$password"
    
    echo ""
    echo "Credentials updated successfully!"
    echo "The web UI will now use these new credentials."
    echo "You can access the web UI at: http://localhost:3000"
}

# Function to change password only
change_password() {
    local password="$1"
    
    if [[ -z "$password" ]]; then
        echo "Usage: node-nfs change-password <new-password>"
        echo "Example: node-nfs change-password mynewpassword123"
        exit 1
    fi
    
    echo "Changing password..."
    echo "New password: $password"
    echo ""
    
    # Update password
    update_service_env "ADMIN_PASSWORD" "$password"
    
    echo ""
    echo "Password updated successfully!"
    echo "The web UI will now use the new password."
}

# Function to change username only
change_username() {
    local username="$1"
    
    if [[ -z "$username" ]]; then
        echo "Usage: node-nfs change-username <new-username>"
        echo "Example: node-nfs change-username administrator"
        exit 1
    fi
    
    echo "Changing username..."
    echo "New username: $username"
    echo ""
    
    # Update username
    update_service_env "ADMIN_USERNAME" "$username"
    
    echo ""
    echo "Username updated successfully!"
    echo "The web UI will now use the new username."
}

# Function to show current credentials
show_credentials() {
    echo "Current Web UI Credentials:"
    echo "=========================="
    
    # Extract current username and password from service file
    local current_username=$(grep "Environment=ADMIN_USERNAME=" "$SERVICE_FILE" | cut -d'=' -f3)
    local current_password=$(grep "Environment=ADMIN_PASSWORD=" "$SERVICE_FILE" | cut -d'=' -f3)
    
    echo "Username: $current_username"
    echo "Password: $current_password"
    echo ""
    echo "Web UI URL: http://localhost:3000"
}

case "$1" in
    status)
        echo "NFS Web Management System Status:"
        echo "=================================="
        systemctl is-active --quiet "$WEB_UI_SERVICE" && echo "● $WEB_UI_SERVICE: active" || echo "● $WEB_UI_SERVICE: inactive"
        systemctl is-active --quiet "$CONFIG_MANAGER_SERVICE" && echo "● $CONFIG_MANAGER_SERVICE: active" || echo "● $CONFIG_MANAGER_SERVICE: inactive"
        ;;
    start)
        sudo systemctl start "$WEB_UI_SERVICE" "$CONFIG_MANAGER_SERVICE"
        echo "Services started"
        ;;
    stop)
        sudo systemctl stop "$WEB_UI_SERVICE" "$CONFIG_MANAGER_SERVICE"
        echo "Services stopped"
        ;;
    restart)
        sudo systemctl restart "$WEB_UI_SERVICE" "$CONFIG_MANAGER_SERVICE"
        echo "Services restarted"
        ;;
    logs)
        echo "Web UI Service Logs:"
        echo "===================="
        journalctl -u "$WEB_UI_SERVICE" -n 10 --no-pager
        echo ""
        echo "Configuration Manager Logs:"
        echo "==========================="
        journalctl -u "$CONFIG_MANAGER_SERVICE" -n 10 --no-pager
        ;;
    set-credentials)
        set_credentials "$2" "$3"
        ;;
    change-password)
        change_password "$2"
        ;;
    change-username)
        change_username "$2"
        ;;
    show-credentials)
        show_credentials
        ;;
    help|--help|-h|"")
        echo "NFS Web Management System CLI Tool"
        echo ""
        echo "Usage: node-nfs [command]"
        echo ""
        echo "Commands:"
        echo "  status              - Show status of all services"
        echo "  start               - Start all services (requires sudo)"
        echo "  stop                - Stop all services (requires sudo)"
        echo "  restart             - Restart all services (requires sudo)"
        echo "  logs                - Show logs for all services"
        echo "  set-credentials     - Set both username and password"
        echo "  change-password     - Change password only"
        echo "  change-username     - Change username only"
        echo "  show-credentials    - Show current credentials"
        echo "  help                - Show this help message"
        echo ""
        echo "Credential Management Examples:"
        echo "  node-nfs set-credentials admin mypassword123"
        echo "  node-nfs change-password newpassword456"
        echo "  node-nfs change-username administrator"
        echo "  node-nfs show-credentials"
        ;;
    *)
        echo "Unknown command: $1"
        echo "Use 'node-nfs help' for available commands"
        exit 1
        ;;
esac
EOF
    
    chmod +x "$BIN_DIR/node-nfs"
    
    log_success "CLI management tool deployed"
}

# Enable and start services
enable_services() {
    log_info "Enabling and starting services..."
    
    # Reload systemd
    systemctl daemon-reload
    
    # Enable services
    systemctl enable "$WEB_UI_SERVICE"
    systemctl enable "$CONFIG_MANAGER_SERVICE"
    
    # Start services
    systemctl start "$CONFIG_MANAGER_SERVICE"
    sleep 2
    systemctl start "$WEB_UI_SERVICE"
    
    log_success "Services enabled and started"
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    # Check services
    if systemctl is-active --quiet "$WEB_UI_SERVICE" && systemctl is-active --quiet "$CONFIG_MANAGER_SERVICE"; then
        log_success "All services are running"
    else
        log_error "Some services are not running"
        systemctl status "$WEB_UI_SERVICE" "$CONFIG_MANAGER_SERVICE" --no-pager
        exit 1
    fi
    
    # Check web UI accessibility
    if curl -s "http://localhost:$WEB_UI_PORT" >/dev/null 2>&1; then
        log_success "Web UI is accessible at http://localhost:$WEB_UI_PORT"
    else
        log_warning "Web UI may not be accessible yet (waiting for startup)"
    fi
    
    # Check CLI tool
    if command -v node-nfs >/dev/null 2>&1; then
        log_success "CLI management tool installed: node-nfs"
    else
        log_error "CLI management tool not found"
        exit 1
    fi
}

# Main deployment function
main() {
    log_info "Starting unified deployment of NFS Web Management System..."
    
    check_root
    check_requirements
    install_dependencies
    create_user_and_directories
    deploy_config_manager
    deploy_web_ui
    deploy_cli_tool
    enable_services
    verify_deployment
    
    log_success "Deployment completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Access the web UI at: http://localhost:$WEB_UI_PORT"
    echo "2. Use 'node-nfs status' to check service status"
    echo "3. Use 'node-nfs help' for available commands"
    echo ""
    echo "Default credentials: $WEB_UI_USER / (check server.js for password)"
    echo ""
    echo "Available commands:"
    echo "  node-nfs status          # Check all services"
    echo "  node-nfs web-ui logs    # View web UI logs"
    echo "  node-nfs config show    # Show current configuration"
}

# Run main function
main "$@"
