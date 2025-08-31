# NFS Web Management System - Unified Deployment Guide

## Overview

This document describes the new unified deployment and management system for the NFS Web Management System. The system has been consolidated into a single deployment method with an integrated CLI management tool.

## Architecture

The system consists of two main services:

1. **NFS Web UI Service** (`nfs-web-ui`)
   - Provides the web interface for managing NFS exports
   - Runs on port 3000
   - Runs as user `autumn`

2. **NFS Configuration Manager** (`nfs-config-manager`)
   - Monitors configuration changes and applies them to `/etc/exports`
   - Runs as root with minimal privileges
   - Automatically creates backups before changes

## Quick Start

### 1. Deploy the System

```bash
# Clone the repository
git clone <repository-url>
cd node-nas-nfs

# Run the unified deployment script
sudo ./deploy-unified.sh
```

Or use the Makefile:

```bash
make deploy
```

### 2. Access the Web UI

- **URL**: http://localhost:3000
- **Username**: autumn
- **Password**: J3498200j (or check server.js for current password)

### 3. Manage Services

Use the integrated CLI tool:

```bash
# Check status of all services
node-nfs status

# Start all services
sudo node-nfs start

# View logs
node-nfs logs

# Get help
node-nfs help
```

## Management Commands

### Service Management

```bash
# Basic service control
sudo node-nfs start          # Start all services
sudo node-nfs stop           # Stop all services
sudo node-nfs restart        # Restart all services
sudo node-nfs enable         # Enable services on boot
sudo node-nfs disable        # Disable services on boot

# Individual service control
sudo node-nfs web-ui start
sudo node-nfs web-ui stop
sudo node-nfs config-manager restart
```

### Status and Monitoring

```bash
# System status
node-nfs status              # All services status
node-nfs web-ui status       # Web UI service status
node-nfs config-manager status # Config manager status

# Logs
node-nfs logs                # All service logs
node-nfs web-ui logs         # Web UI logs only
node-nfs config-manager logs # Config manager logs only
```

### Configuration Management

```bash
# View and manage configuration
node-nfs config show         # Show current NFS exports
sudo node-nfs config backup  # Create backup
sudo node-nfs config restore /path/to/backup  # Restore from backup
node-nfs config validate     # Validate configuration
```

### System Management

```bash
# Installation and removal
sudo node-nfs install        # Install/update system
sudo node-nfs uninstall      # Remove system completely
```

## Makefile Integration

The system also integrates with the Makefile for easy management:

```bash
# Deployment
make deploy                  # Unified deployment
make deploy-legacy          # Show legacy deployment options

# Service management
make start                  # Start all services
make stop                   # Stop all services
make restart                # Restart all services
make status                 # Show all service status
make logs                   # Show all service logs

# Information
make cli                    # Show CLI commands
make help                   # Show all available commands
```

## File Structure

```
/etc/systemd/system/
├── nfs-web-ui.service          # Web UI systemd service
└── nfs-config-manager.service  # Configuration manager service

/etc/nfs-web-ui/
├── exports.json                # NFS exports configuration
└── (other config files)

/usr/local/bin/
├── node-nfs                    # CLI management tool
└── nfs-config-manager          # Configuration manager script

/var/backups/nfs-exports/       # Automatic backups
```

## Security Features

- **Separation of privileges**: Web UI runs as user, config manager runs as root
- **Controlled file access**: Web UI only writes to configuration files
- **Automatic validation**: Configuration changes are validated before application
- **Backup creation**: Automatic backups before any changes
- **No sudo access required**: Web UI operates without elevated privileges

## Troubleshooting

### Common Issues

1. **Service won't start**
   ```bash
   # Check service status
   sudo systemctl status nfs-web-ui
   sudo systemctl status nfs-config-manager
   
   # Check logs
   sudo journalctl -u nfs-web-ui -n 20
   sudo journalctl -u nfs-config-manager -n 20
   ```

2. **Web UI not accessible**
   ```bash
   # Check if service is running
   node-nfs status
   
   # Check port usage
   sudo netstat -tlnp | grep :3000
   ```

3. **Configuration not applying**
   ```bash
   # Check config manager logs
   node-nfs config-manager logs
   
   # Validate configuration
   node-nfs config validate
   ```

### Log Locations

- **Systemd logs**: `journalctl -u service-name`
- **Application logs**: Check service status for log output
- **NFS logs**: `/var/log/syslog` (filter for NFS)

## Migration from Legacy Systems

If you're upgrading from the old deployment methods:

1. **Stop old services**:
   ```bash
   sudo systemctl stop nfs-web-ui  # if exists
   ```

2. **Run unified deployment**:
   ```bash
   sudo ./deploy-unified.sh
   ```

3. **Verify migration**:
   ```bash
   node-nfs status
   ```

## Support

For issues and questions:

1. Check the service logs: `node-nfs logs`
2. Verify system status: `node-nfs status`
3. Check configuration: `node-nfs config show`
4. Review this documentation

## Legacy Deployment Methods

The following deployment methods are still available but not recommended:

- `./deploy.sh` - Full automated deployment
- `./quick-deploy.sh` - Quick deployment
- `./deploy-docker.sh` - Docker-based deployment

Use `make deploy-legacy` to see these options.
