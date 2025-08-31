# NFS Web Management System

A professional, secure web-based management interface for NFS (Network File System) exports on Ubuntu 24.04. This system provides an intuitive web UI to manage NFS shares, configure access control, and monitor system status with integrated service management.

## Features

- **Dashboard**: Real-time system status and export overview
- **Export Management**: Create, edit, and delete NFS exports
- **Access Control**: Configure client IP addresses and permissions (Read-Only/Read-Write)
- **Security**: JWT-based authentication and input validation
- **Responsive UI**: Modern, mobile-friendly interface using Tailwind CSS
- **Real-time Updates**: Auto-refresh dashboard every 30 seconds
- **System Integration**: Direct integration with Ubuntu's NFS server

## Technology Stack

- **Backend**: Node.js with Express.js
- **Frontend**: Vanilla JavaScript with Tailwind CSS
- **Authentication**: JWT tokens with bcrypt password hashing
- **System Integration**: Secure configuration management with automatic NFS export application

## System Architecture

The system consists of two main services working together:

1. **NFS Web UI Service** (`nfs-web-ui`)
   - Provides the web interface for managing NFS exports
   - Runs on port 3000 as user `autumn`
   - Writes configuration to `/etc/nfs-web-ui/exports.json`

2. **NFS Configuration Manager** (`nfs-config-manager`)
   - Monitors configuration changes and applies them to `/etc/exports`
   - Runs as root with minimal privileges
   - Automatically creates backups before changes
   - Reloads NFS exports when configuration changes

3. **CLI Management Tool** (`node-nfs`)
   - Unified command-line interface for managing all services
   - Installed system-wide at `/usr/local/bin/node-nfs`
   - Provides status, control, and monitoring capabilities

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
- Sets up the CLI management tool (`node-nfs`)
- Configures proper file permissions and security
- Starts all services automatically

## Usage

### Default Credentials

- **Username**: `autumn`
- **Password**: `J3498200j`

⚠️ **Important**: Change these credentials immediately in production!

### Managing Exports

1. **Login** to the web interface
2. **View existing exports** in the dashboard table

### Service Management

The system includes a powerful CLI management tool:

```bash
# Check status of all services
node-nfs status

# Start all services
sudo node-nfs start

# Restart all services
sudo node-nfs restart

# View logs
node-nfs logs

# Get help
node-nfs help
```

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

You can customize the application using environment variables:

```bash
# Authentication
export ADMIN_USERNAME="your-username"
export ADMIN_PASSWORD="your-secure-password"
export JWT_SECRET="your-super-secret-jwt-key"

# Server configuration
export PORT="3000"
export NODE_ENV="production"
```

### Production Deployment

For production deployment:

1. **Change default credentials**:
   ```bash
   export ADMIN_USERNAME="your-admin-username"
   export ADMIN_PASSWORD="your-secure-password"
   ```

2. **Set a strong JWT secret**:
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

5. **Set up systemd service** (already done by setup script):
   ```bash
   sudo systemctl enable nfs-web-ui
   sudo systemctl start nfs-web-ui
   ```

## Security Considerations

### Critical Security Notes

1. **Privilege Escalation**: The application requires sudo privileges to modify `/etc/exports` and run `exportfs`. This is a significant security risk.

2. **Input Validation**: All user inputs are validated on the backend to prevent:
   - Directory traversal attacks
   - Command injection
   - Invalid IP addresses

3. **Authentication**: JWT-based authentication with configurable credentials.

4. **Network Security**: 
   - Configure firewall rules appropriately
   - Use HTTPS in production
   - Restrict access to trusted networks

### Security Best Practices

1. **Change default credentials immediately**
2. **Use strong passwords and JWT secrets**
3. **Regularly update the system and dependencies**
4. **Monitor system logs for suspicious activity**
5. **Backup `/etc/exports` regularly**
6. **Consider using a reverse proxy for additional security**

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
   node-nfs config show
   # Check active exports
   sudo exportfs -v
   ```

### Logs and Debugging

- **All service logs**: `node-nfs logs`
- **Individual service logs**: `node-nfs web-ui logs` or `node-nfs config-manager logs`
- **NFS server logs**: `sudo journalctl -u nfs-kernel-server -f`
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
4. Check Makefile help: `make help`
5. Review the documentation files
6. Create an issue in the repository
7. Ensure you're using Ubuntu 24.04 or compatible system
