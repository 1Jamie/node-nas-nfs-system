# NFS Web Management System - Makefile
# Provides unified commands for deployment and management

.PHONY: help install deploy start stop restart status logs test clean backup restore cli

# Default target
help:
	@echo "NFS Web Management System - Available Commands"
	@echo "============================================="
	@echo ""
	@echo "Deployment Commands:"
	@echo "  install        - Install project dependencies"
	@echo "  deploy         - Unified deployment"
	@echo ""
	@echo "Service Management:"
	@echo "  start          - Start all services"
	@echo "  stop           - Stop all services"
	@echo "  restart        - Restart all services"
	@echo "  status         - Show status of all services"
	@echo "  logs           - Show logs for all services"
	@echo ""
	@echo "Utility Commands:"
	@echo "  backup         - Create manual backup"
	@echo "  restore        - Restore from backup"
	@echo "  clean          - Clean up temporary files"
	@echo "  cli            - Show CLI management commands"
	@echo ""
	@echo "Examples:"
	@echo "  make deploy          # Deploy the system"
	@echo "  make status          # Check all services"
	@echo "  make logs            # View all logs"
	@echo "  make cli             # Show CLI commands"

# Install project dependencies
install:
	@echo "Installing project dependencies..."
	npm install

# Unified deployment (recommended)
deploy:
	@echo "Starting unified deployment..."
	@echo "This will deploy both the web UI and configuration manager services"
	@echo "Requires sudo privileges"
	@echo ""
	read -p "Continue? (y/N): " -n 1 -r; echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		sudo ./deploy-unified.sh; \
	else \
		echo "Deployment cancelled"; \
	fi



# Start all services
start:
	@echo "Starting all NFS management services..."
	sudo systemctl start nfs-web-ui nfs-config-manager
	@echo "Services started. Check status with: make status"

# Stop all services
stop:
	@echo "Stopping all NFS management services..."
	sudo systemctl stop nfs-web-ui nfs-config-manager
	@echo "Services stopped."

# Restart all services
restart:
	@echo "Restarting all NFS management services..."
	sudo systemctl restart nfs-web-ui nfs-config-manager
	@echo "Services restarted. Check status with: make status"

# Show status of all services
status:
	@echo "NFS Web Management System Status:"
	@echo "================================="
	@echo ""
	@echo "Web UI Service:"
	@echo "==============="
	sudo systemctl status nfs-web-ui --no-pager -l
	@echo ""
	@echo "Configuration Manager Service:"
	@echo "=============================="
	sudo systemctl status nfs-config-manager --no-pager -l
	@echo ""
	@echo "NFS Server Status:"
	@echo "=================="
	sudo systemctl status nfs-kernel-server --no-pager -l

# Show logs for all services
logs:
	@echo "Showing logs for all services (press Ctrl+C to exit)..."
	@echo ""
	@echo "Web UI Service Logs:"
	@echo "===================="
	sudo journalctl -u nfs-web-ui -f &
	@echo ""
	@echo "Configuration Manager Logs:"
	@echo "==========================="
	sudo journalctl -u nfs-config-manager -f &
	@echo ""
	@echo "Press Ctrl+C to stop all log viewers"
	wait

# Show NFS server logs
nfs-logs:
	@echo "Showing NFS server logs (press Ctrl+C to exit)..."
	sudo journalctl -u nfs-kernel-server -f

# Show CLI management commands
cli:
	@echo "NFS Web Management System CLI Commands:"
	@echo "======================================="
	@echo ""
	@echo "The system includes a powerful CLI management tool: node-nfs"
	@echo ""
	@echo "Basic Commands:"
	@echo "  node-nfs status                    # Show all services status"
	@echo "  node-nfs start                     # Start all services"
	@echo "  node-nfs stop                      # Stop all services"
	@echo "  node-nfs restart                   # Restart all services"
	@echo ""
	@echo "Service-Specific Commands:"
	@echo "  node-nfs web-ui status            # Web UI service status"
	@echo "  node-nfs web-ui logs              # Web UI service logs"
	@echo "  node-nfs config-manager status    # Config manager status"
	@echo "  node-nfs config-manager logs      # Config manager logs"
	@echo ""
	@echo "Configuration Management:"
	@echo "  node-nfs config show              # Show current configuration"
	@echo "  node-nfs config backup            # Create backup"
	@echo "  node-nfs config restore [file]    # Restore from backup"
	@echo ""
	@echo "System Management:"
	@echo "  node-nfs logs                     # Show all service logs"
	@echo "  node-nfs uninstall                # Remove the system"
	@echo ""
	@echo "For full help: node-nfs help"



# Create manual backup
backup:
	@echo "Creating manual backup..."
	sudo cp /etc/exports /etc/exports.backup.$(shell date +%Y%m%d_%H%M%S)
	@echo "Backup created: /etc/exports.backup.$(shell date +%Y%m%d_%H%M%S)"

# List available backups
list-backups:
	@echo "Available backups:"
	@ls -la /etc/exports.backup.* 2>/dev/null || echo "No backups found"

# Restore from backup (usage: make restore BACKUP=filename)
restore:
	@if [ -z "$(BACKUP)" ]; then \
		echo "Usage: make restore BACKUP=filename"; \
		echo "Example: make restore BACKUP=/etc/exports.backup.20241201_120000"; \
		exit 1; \
	fi
	@if [ -f "$(BACKUP)" ]; then \
		echo "Restoring from backup: $(BACKUP)"; \
		sudo cp "$(BACKUP)" /etc/exports; \
		sudo exportfs -ra; \
		echo "Backup restored successfully"; \
	else \
		echo "Backup file not found: $(BACKUP)"; \
		echo "Use 'make list-backups' to see available backups"; \
		exit 1; \
	fi

# Clean up temporary files
clean:
	@echo "Cleaning up temporary files..."
	rm -rf node_modules
	rm -f .env
	@echo "Cleanup completed. Run 'make install' to reinstall dependencies."

# Full cleanup (removes everything)
full-clean: clean
	@echo "Performing full cleanup..."
	sudo systemctl stop nfs-web-ui 2>/dev/null || true
	sudo systemctl disable nfs-web-ui 2>/dev/null || true
	sudo rm -f /etc/systemd/system/nfs-web-ui.service
	sudo systemctl daemon-reload
	@echo "Full cleanup completed."

# Check system requirements
check:
	@echo "Checking system requirements..."
	@echo "Ubuntu Version: $(shell lsb_release -rs 2>/dev/null || echo 'Unknown')"
	@echo "Node.js: $(shell node --version 2>/dev/null || echo 'Not installed')"
	@echo "npm: $(shell npm --version 2>/dev/null || echo 'Not installed')"
	@echo "NFS Server: $(shell command -v exportfs >/dev/null 2>&1 && echo 'Installed' || echo 'Not installed')"
	@echo "Docker: $(shell command -v docker >/dev/null 2>&1 && echo 'Installed' || echo 'Not installed')"
	@echo "Docker Compose: $(shell command -v docker-compose >/dev/null 2>&1 && echo 'Installed' || echo 'Not installed')"

# Show system information
info:
	@echo "System Information:"
	@echo "==================="
	@echo "OS: $(shell lsb_release -d | cut -f2)"
	@echo "Kernel: $(shell uname -r)"
	@echo "Architecture: $(shell uname -m)"
	@echo "Memory: $(shell free -h | grep Mem | awk '{print $3"/"$2}')"
	@echo "Disk Usage: $(shell df -h / | tail -1 | awk '{print $5}')"
	@echo "Uptime: $(shell uptime -p)"

# Show NFS exports
exports:
	@echo "Current NFS Exports:"
	@echo "===================="
	@cat /etc/exports 2>/dev/null || echo "No exports file found"

# Show active NFS exports
active-exports:
	@echo "Active NFS Exports:"
	@echo "==================="
	sudo exportfs -v 2>/dev/null || echo "No active exports"

# Show firewall status
firewall:
	@echo "Firewall Status:"
	@echo "================"
	sudo ufw status 2>/dev/null || echo "UFW not available"

# Update system packages
update:
	@echo "Updating system packages..."
	sudo apt update
	sudo apt upgrade -y
	@echo "System update completed."

# Install system dependencies
install-deps:
	@echo "Installing system dependencies..."
	sudo apt update
	sudo apt install -y curl nfs-kernel-server ufw
	@echo "System dependencies installed."

# Install Node.js
install-node:
	@echo "Installing Node.js..."
	curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
	sudo apt install -y nodejs
	@echo "Node.js installed: $(shell node --version)"

# Setup NFS
setup-nfs:
	@echo "Setting up NFS server..."
	sudo systemctl enable nfs-kernel-server
	sudo systemctl start nfs-kernel-server
	@echo "NFS server setup completed."

# Configure firewall
setup-firewall:
	@echo "Configuring firewall..."
	sudo ufw allow 2049/tcp
	sudo ufw allow 111/tcp
	sudo ufw allow 32765:32768/tcp
	sudo ufw allow 32765:32768/udp
	sudo ufw allow 3000/tcp
	@echo "Firewall configured."

# Create service
create-service:
	@echo "Creating systemd service..."
	@echo "[Unit]" | sudo tee /etc/systemd/system/nfs-web-ui.service > /dev/null
	@echo "Description=NFS Web Management Interface" | sudo tee -a /etc/systemd/system/nfs-web-ui.service > /dev/null
	@echo "After=network.target nfs-kernel-server.service" | sudo tee -a /etc/systemd/system/nfs-web-ui.service > /dev/null
	@echo "" | sudo tee -a /etc/systemd/system/nfs-web-ui.service > /dev/null
	@echo "[Service]" | sudo tee -a /etc/systemd/system/nfs-web-ui.service > /dev/null
	@echo "Type=simple" | sudo tee -a /etc/systemd/system/nfs-web-ui.service > /dev/null
	@echo "User=$(USER)" | sudo tee -a /etc/systemd/system/nfs-web-ui.service > /dev/null
	@echo "WorkingDirectory=$(PWD)" | sudo tee -a /etc/systemd/system/nfs-web-ui.service > /dev/null
	@echo "ExecStart=/usr/bin/node server.js" | sudo tee -a /etc/systemd/system/nfs-web-ui.service > /dev/null
	@echo "Restart=always" | sudo tee -a /etc/systemd/system/nfs-web-ui.service > /dev/null
	@echo "RestartSec=10" | sudo tee -a /etc/systemd/system/nfs-web-ui.service > /dev/null
	@echo "Environment=NODE_ENV=production" | sudo tee -a /etc/systemd/system/nfs-web-ui.service > /dev/null
	@echo "Environment=PORT=3000" | sudo tee -a /etc/systemd/system/nfs-web-ui.service > /dev/null
	@echo "" | sudo tee -a /etc/systemd/system/nfs-web-ui.service > /dev/null
	@echo "[Install]" | sudo tee -a /etc/systemd/system/nfs-web-ui.service > /dev/null
	@echo "WantedBy=multi-user.target" | sudo tee -a /etc/systemd/system/nfs-web-ui.service > /dev/null
	sudo systemctl daemon-reload
	sudo systemctl enable nfs-web-ui
	@echo "Systemd service created and enabled."

# Manual installation steps
manual-install: install-deps install-node install setup-nfs setup-firewall create-service
	@echo "Manual installation completed."
	@echo "Run 'make start' to start the service."

# Show help for specific command
help-%:
	@echo "Help for command: $*"
	@echo "=================="
	@case "$*" in \
		deploy) \
			echo "Full automated deployment with logging and verification."; \
			echo "Usage: make deploy"; \
			;; \
		quick-deploy) \
			echo "Fast deployment without detailed logging."; \
			echo "Usage: make quick-deploy"; \
			;; \
		docker-deploy) \
			echo "Containerized deployment using Docker."; \
			echo "Usage: make docker-deploy"; \
			;; \
		*) \
			echo "No help available for command: $*"; \
			;; \
	esac
