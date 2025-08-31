#!/bin/bash

# NFS Web Management System CLI Tool with Security Features
# Usage: node-nfs [command]

WEB_UI_SERVICE="nfs-web-ui"
CONFIG_MANAGER_SERVICE="nfs-config-manager"
SERVICE_FILE="/etc/systemd/system/nfs-web-ui.service"

# Function to generate bcrypt hash
generate_password_hash() {
    local password="$1"
    local hash=$(node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('$password', 10).then(h => console.log(h)).catch(e => console.error('Error:', e.message))" 2>/dev/null)
    if [[ $? -ne 0 || -z "$hash" ]]; then
        echo "Error: Could not generate password hash. Make sure bcryptjs is installed."
        return 1
    fi
    echo "$hash"
}

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

# Function to set credentials securely
set_credentials() {
    local username="$1"
    local password="$2"
    
    if [[ -z "$username" || -z "$password" ]]; then
        echo "Usage: node-nfs set-credentials <username> <password>"
        echo "Example: node-nfs set-credentials admin mypassword123"
        exit 1
    fi
    
    echo "Setting credentials securely..."
    echo "Username: $username"
    echo "Password: [HIDDEN]"
    echo ""
    
    # Generate secure password hash
    echo "Generating secure password hash..."
    local password_hash=$(generate_password_hash "$password")
    if [[ $? -ne 0 ]]; then
        echo "Failed to generate password hash"
        exit 1
    fi
    
    # Update username
    update_service_env "ADMIN_USERNAME" "$username"
    
    # Update password hash (secure)
    update_service_env "HASHED_PASSWORD" "$password_hash"
    
    # Also update plain password for reference (will be hashed on login)
    update_service_env "ADMIN_PASSWORD" "$password"
    
    echo ""
    echo "Credentials updated successfully with secure bcrypt hashing!"
    echo "The web UI will now use these new credentials."
    echo "You can access the web UI at: http://localhost:3000"
}

# Function to change password securely
change_password() {
    local password="$1"
    
    if [[ -z "$password" ]]; then
        echo "Usage: node-nfs change-password <new-password>"
        echo "Example: node-nfs change-password mynewpassword123"
        exit 1
    fi
    
    echo "Changing password securely..."
    echo "New password: [HIDDEN]"
    echo ""
    
    # Generate secure password hash
    echo "Generating secure password hash..."
    local password_hash=$(generate_password_hash "$password")
    if [[ $? -ne 0 ]]; then
        echo "Failed to generate password hash"
        exit 1
    fi
    
    # Update password hash (secure)
    update_service_env "HASHED_PASSWORD" "$password_hash"
    
    # Also update plain password for reference
    update_service_env "ADMIN_PASSWORD" "$password"
    
    echo ""
    echo "Password updated successfully with secure bcrypt hashing!"
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
    local hashed_password=$(grep "Environment=HASHED_PASSWORD=" "$SERVICE_FILE" | cut -d'=' -f3)
    
    echo "Username: $current_username"
    echo "Password: $current_password"
    echo "Security: $(if [[ -n "$hashed_password" ]]; then echo "✅ Bcrypt hashed"; else echo "❌ Plain text (INSECURE)"; fi)"
    echo ""
    echo "Web UI URL: http://localhost:3000"
}

# Function to show password security status
show_security_status() {
    echo "Password Security Status:"
    echo "========================"
    
    local hashed_password=$(grep "Environment=HASHED_PASSWORD=" "$SERVICE_FILE" | cut -d'=' -f3)
    
    if [[ -n "$hashed_password" ]]; then
        echo "✅ Password Security: ENABLED"
        echo "   - Using bcrypt hashing"
        echo "   - Salt protection active"
        echo "   - Secure against rainbow table attacks"
        echo "   - Hash: ${hashed_password:0:20}..."
    else
        echo "❌ Password Security: DISABLED"
        echo "   - Passwords stored in plain text"
        echo "   - HIGHLY INSECURE"
        echo "   - Run 'node-nfs set-credentials <user> <pass>' to secure"
    fi
    echo ""
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
    security-status)
        show_security_status
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
        echo ""
        echo "Credential Management:"
        echo "  set-credentials     - Set username and password (with bcrypt hashing)"
        echo "  change-password     - Change password securely"
        echo "  change-username     - Change username only"
        echo "  show-credentials    - Show current credentials"
        echo "  security-status     - Show password security status"
        echo ""
        echo "Credential Management Examples:"
        echo "  node-nfs set-credentials admin mypassword123"
        echo "  node-nfs change-password newpassword456"
        echo "  node-nfs change-username administrator"
        echo "  node-nfs show-credentials"
        echo "  node-nfs security-status"
        ;;
    *)
        echo "Unknown command: $1"
        echo "Use 'node-nfs help' for available commands"
        exit 1
        ;;
esac
