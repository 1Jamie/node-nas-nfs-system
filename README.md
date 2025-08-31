# NFS Web Management System

A professional, secure web-based management interface for NFS (Network File System) exports on Ubuntu 24.04. This system provides an intuitive web UI to manage NFS shares, configure access control, and monitor system status with integrated service management and comprehensive credential management.

## Features

- **Dashboard**: Real-time system status and export overview
- **Export Management**: Create, edit, and delete NFS exports with granular IP control
- **Access Control**: Configure client IP addresses and permissions (Read-Only/Read-Write)
- **Security**: JWT-based authentication with secure credential management
- **Responsive UI**: Modern, mobile-friendly interface using Tailwind CSS
- **Real-time Updates**: Auto-refresh dashboard every 30 seconds
- **System Integration**: Direct integration with Ubuntu's NFS server
- **Credential Management**: Built-in CLI tools for managing admin credentials
- **Backup & Restore**: Automatic backup system with restore capabilities
- **Unified Management**: Single CLI tool for all service management

## Technology Stack

- **Backend**: Node.js with Express.js
- **Frontend**: Vanilla JavaScript with Tailwind CSS
- **Authentication**: JWT tokens with bcrypt password hashing
- **System Integration**: Secure configuration management with automatic NFS export application

## System Architecture

The system consists of two main services working together:

1. **NFS Web UI Service** (`nfs-web-ui`)
   - Provides the web interface for managing NFS exports
   - Runs on port 3000 as user `nfs-web-ui` (or `autumn` for NVM compatibility)
   - Writes configuration to `/etc/nfs-web-ui/exports.json`
   - Supports environment variable configuration for credentials

2. **NFS Configuration Manager** (`nfs-config-manager`)
   - Monitors configuration changes and applies them to `/etc/exports`
   - Runs as root with minimal privileges
   - Automatically creates backups before changes
   - Reloads NFS exports when configuration changes
   - Uses JSON parsing with jq or Python fallback

3. **CLI Management Tool** (`node-nfs`)
   - Unified command-line interface for managing all services
   - Installed system-wide at `/usr/local/bin/node-nfs`
   - Provides status, control, monitoring, and credential management
   - Supports automatic service file backups and updates

## Prerequisites

- Ubuntu 24.04 (or compatible Linux distribution)
- Node.js 18+ (automatically detected and configured)
- sudo privileges for deployment

## Installation

### Unified Deployment (Recommended)

The system uses a unified deployment method that automatically sets up all required services:

1. **Clone or download the project**:
   ```bash
   git clone <repository-url>
   cd node-nas-nfs
   ```

2. **Run the unified deployment script**:
   ```bash
   sudo ./deploy-unified.sh
   ```

3. **Access the web UI**:
   Open your browser and navigate to `http://localhost:3000`

### Alternative: Makefile Deployment

You can also use the Makefile for deployment:

```bash
make deploy
```

### What Gets Installed

The unified deployment automatically:
- Installs system dependencies (NFS server, inotify-tools, jq)
- Creates systemd services for both web UI and configuration manager
- Sets up the CLI management tool (`node-nfs`) with credential management
- Configures proper file permissions and security
- Creates system user `nfs-web-ui` for secure operation
- Sets up universal backup directory at `/var/backups/nfs-web-ui`
- Starts all services automatically

## Usage

### Default Credentials

- **Username**: `admin`
- **Password**: `admin123`

⚠️ **Important**: Change these credentials immediately in production using the credential management tools!

### Credential Management

The system includes comprehensive credential management through the CLI tool:

```bash
# Show current credentials
node-nfs show-credentials

# Change password only
node-nfs change-password "MySecurePassword123"

# Change username only
node-nfs change-username "administrator"

# Set both username and password
node-nfs set-credentials "admin" "SecurePassword456"

# Get help with credential management
node-nfs help
```

**Features:**
- ✅ **Automatic Backups**: Service file backups created before changes
- ✅ **Immediate Effect**: Changes applied instantly with service restart
- ✅ **Validation**: Parameter validation and helpful error messages
- ✅ **Security**: Uses sudo for all system file modifications

### Managing Exports

1. **Login** to the web interface using your credentials

2. **View existing exports** in the dashboard table

3. **Add new export**:
   - Click "Add Export" button
   - Enter the directory path (must be absolute, e.g., `/home/user/shared`)
   - Add client IP addresses or CIDR blocks
   - Select permissions (Read-Only or Read/Write)
   - Click "Save Export"

4. **Edit existing export**:
   - Click the edit icon next to any export
   - Modify client IPs or permissions
   - Click "Save Export"

5. **Delete export**:
   - Click the delete icon next to any export
   - Confirm the deletion

6. **Manage individual IP addresses**:
   - Add individual IPs to existing exports using the "Add IP" button
   - Remove individual IPs using the "×" button next to each IP
   - Each export can have multiple client IPs with different permissions

### Service Management

The system includes a powerful CLI management tool with comprehensive features:

```bash
# Check status of all services
node-nfs status

# Start all services
sudo node-nfs start

# Restart all services
sudo node-nfs restart

# View logs
node-nfs logs

# Credential management
node-nfs show-credentials
node-nfs change-password "newpassword"
node-nfs change-username "newuser"
node-nfs set-credentials "user" "password"

# Get help
node-nfs help
```

**Available Commands:**
- `status` - Show status of all services
- `start` - Start all services (requires sudo)
- `stop` - Stop all services (requires sudo)
- `restart` - Restart all services (requires sudo)
- `logs` - Show logs for all services
- `set-credentials` - Set both username and password
- `change-password` - Change password only
- `change-username` - Change username only
- `show-credentials` - Show current credentials
- `help` - Show help message

### Makefile Integration

You can also use the Makefile for service management:

```bash
make start          # Start all services
make stop           # Stop all services
make restart        # Restart all services
make status         # Show all service status
make logs           # Show all service logs
make cli            # Show CLI commands
```
3. **Add new export**:
   - Click "Add Export" button
   - Enter the directory path (must be absolute, e.g., `/home/user/shared`)
   - Add client IP addresses or CIDR blocks
   - Select permissions (Read-Only or Read/Write)
   - Click "Save Export"

4. **Edit existing export**:
   - Click the edit icon next to any export
   - Modify client IPs or permissions
   - Click "Save Export"

5. **Delete export**:
   - Click the delete icon next to any export
   - Confirm the deletion

### Client Configuration

- **Single IP**: `192.168.1.100`
- **CIDR Block**: `192.168.1.0/24`
- **Permissions**:
  - `ro`: Read-Only
  - `rw`: Read/Write

### System Status

The dashboard shows:
- NFS server status (Running/Stopped)
- Number of active exports
- Last update timestamp

## Configuration

### Environment Variables

The system supports comprehensive configuration through environment variables:

```bash
# Authentication (managed via CLI tool)
export ADMIN_USERNAME="your-username"
export ADMIN_PASSWORD="your-secure-password"
export JWT_SECRET="your-super-secret-jwt-key"

# Server configuration
export PORT="3000"
export NODE_ENV="production"

# System paths (set automatically by deployment)
export CONFIG_DIR="/etc/nfs-web-ui"
export BACKUP_DIR="/var/backups/nfs-web-ui"
```

### Universal Configuration

The system now uses universal paths that work across different installations:

- **Configuration Directory**: `/etc/nfs-web-ui/`
- **Backup Directory**: `/var/backups/nfs-web-ui/`
- **Service User**: `nfs-web-ui` (created automatically)
- **Application Directory**: `/opt/nfs-web-ui/` (for system-wide installations)

### Production Deployment

For production deployment:

1. **Change default credentials using CLI tool**:
   ```bash
   node-nfs set-credentials "your-admin-username" "your-secure-password"
   ```

2. **Set a strong JWT secret** (optional, managed automatically):
   ```bash
   export JWT_SECRET="your-super-secret-jwt-key-change-this"
   ```

3. **Use HTTPS** (recommended):
   - Set up a reverse proxy with nginx or Apache
   - Configure SSL certificates
   - Update the frontend to use HTTPS URLs

4. **Configure firewall**:
   ```bash
   sudo ufw allow 3000/tcp  # Web interface
   sudo ufw allow 2049/tcp  # NFS
   sudo ufw allow 111/tcp   # Portmapper
   ```

5. **Systemd services** (automatically configured by deployment script):
   ```bash
   sudo systemctl enable nfs-web-ui nfs-config-manager
   sudo systemctl start nfs-web-ui nfs-config-manager
   ```

## Security Considerations

### Secure Architecture

The system implements a secure two-tier architecture:

1. **Low-Privilege Web UI**: Runs as `nfs-web-ui` user, only writes to configuration files
2. **High-Privilege Config Manager**: Runs as root, applies changes to system files
3. **Separation of Concerns**: Web UI never directly accesses `/etc/exports` or runs `exportfs`

### Critical Security Notes

1. **Privilege Separation**: The web UI runs with minimal privileges and only writes to JSON configuration files. The configuration manager handles all system-level operations.

2. **Input Validation**: All user inputs are validated on the backend to prevent:
   - Directory traversal attacks
   - Command injection
   - Invalid IP addresses
   - Malicious JSON payloads

3. **Authentication**: JWT-based authentication with secure credential management via CLI tools.

4. **Network Security**: 
   - Configure firewall rules appropriately
   - Use HTTPS in production
   - Restrict access to trusted networks

5. **Credential Management**: Built-in CLI tools for secure credential updates with automatic backups.

### Security Best Practices

1. **Use credential management tools** to change default credentials immediately
2. **Use strong passwords and JWT secrets**
3. **Regularly update the system and dependencies**
4. **Monitor system logs for suspicious activity**
5. **Backup configuration files regularly** (automatic backups included)
6. **Consider using a reverse proxy for additional security**
7. **Use the CLI tool for all credential changes** instead of manual file editing
8. **Review service logs regularly** using `node-nfs logs`

## Troubleshooting

### Common Issues

1. **Permission Denied**:
   ```bash
   # Check service status
   node-nfs status
   # Check logs
   node-nfs logs
   ```

2. **NFS Server Not Starting**:
   ```bash
   # Check all services status
   node-nfs status
   # Check NFS server specifically
   sudo systemctl status nfs-kernel-server
   ```

3. **Web Interface Not Accessible**:
   ```bash
   # Check if the service is running
   node-nfs status
   # Check logs
   node-nfs logs
   ```

4. **Exports Not Working**:
   ```bash
   # Check configuration
   cat /etc/nfs-web-ui/exports.json
   # Check active exports
   sudo exportfs -v
   ```

5. **Credential Issues**:
   ```bash
   # Show current credentials
   node-nfs show-credentials
   # Reset credentials if needed
   node-nfs set-credentials "admin" "newpassword"
   ```

### Logs and Debugging

- **All service logs**: `node-nfs logs`
- **Individual service logs**: `sudo journalctl -u nfs-web-ui -f` or `sudo journalctl -u nfs-config-manager -f`
- **NFS server logs**: `sudo journalctl -u nfs-kernel-server -f`
- **Configuration manager logs**: `sudo tail -f /var/log/nfs-config-manager.log`
- **System logs**: `sudo tail -f /var/log/syslog`

## API Reference

The application provides a REST API for programmatic access:

### Authentication
- `POST /api/login` - Login with username/password

### Exports Management
- `GET /api/exports` - List all exports
- `POST /api/exports` - Create new export
- `PUT /api/exports/:path` - Update existing export
- `DELETE /api/exports/:path` - Delete export
- `POST /api/exports/:path/clients` - Add individual IP to export
- `DELETE /api/exports/clients` - Remove individual IP from export

### Backup Management
- `GET /api/backups` - List all backups
- `POST /api/backups` - Create new backup
- `POST /api/backups/restore/:filename` - Restore from backup
- `DELETE /api/backups/:filename` - Delete backup

### System Status
- `GET /api/status` - Get system status

All API endpoints require authentication via JWT token in the Authorization header.

## Documentation

The system includes comprehensive documentation:

- **`UNIFIED_DEPLOYMENT.md`** - Complete deployment and management guide
- **`DEPLOYMENT_SUMMARY.md`** - Implementation summary and architecture overview
- **`Makefile`** - Service management and deployment targets

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Disclaimer

This software is provided "as is" without warranty. Use at your own risk. The authors are not responsible for any data loss or security breaches that may occur from using this software.

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Use the CLI tool to check service status: `node-nfs status`
3. View service logs: `node-nfs logs`
4. Check credentials: `node-nfs show-credentials`
5. Check Makefile help: `make help`
6. Review the documentation files
7. Create an issue in the repository
8. Ensure you're using Ubuntu 24.04 or compatible system
