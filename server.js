#!/usr/bin/env node

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs').promises;
const fsSync = require('fs');
const { exec } = require('child_process');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Security configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'; // Change this in production!

// Configuration and backup settings
const CONFIG_DIR = process.env.CONFIG_DIR || '/etc/nfs-web-ui';
const CONFIG_FILE = path.join(CONFIG_DIR, 'exports.json');
const BACKUP_DIR = process.env.BACKUP_DIR || '/var/backups/nfs-web-ui';
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS) || 10;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Utility functions
const execCommand = (command) => {
    return new Promise((resolve, reject) => {
        exec(command, { timeout: 10000 }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`Command failed: ${error.message}`));
                return;
            }
            if (stderr) {
                console.warn('Command stderr:', stderr);
            }
            resolve(stdout.trim());
        });
    });
};

const validatePath = (filePath) => {
    // Basic path validation - prevent directory traversal
    if (!filePath || typeof filePath !== 'string') {
        return false;
    }
    
    // Check for directory traversal attempts
    if (filePath.includes('..') || filePath.includes('//')) {
        return false;
    }
    
    // Ensure path starts with / and doesn't contain dangerous characters
    if (!filePath.startsWith('/') || /[<>:"|?*]/.test(filePath)) {
        return false;
    }
    
    return true;
};

const validateIP = (ip) => {
    // Basic IP validation
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const cidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/([0-9]|[1-2][0-9]|3[0-2])$/;
    
    return ipRegex.test(ip) || cidrRegex.test(ip);
};

// Backup and restore functions
const ensureBackupDir = async () => {
    try {
        await fs.access(BACKUP_DIR);
    } catch {
        await fs.mkdir(BACKUP_DIR, { recursive: true });
    }
};

const createBackup = async () => {
    try {
        await ensureBackupDir();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(BACKUP_DIR, `exports-${timestamp}.bak`);
        
        // Backup the current configuration file instead of /etc/exports
        const configContent = await fs.readFile(CONFIG_FILE, 'utf8');
        await fs.writeFile(backupFile, configContent);
        
        // Clean up old backups
        const files = await fs.readdir(BACKUP_DIR);
        const backupFiles = files
            .filter(f => f.startsWith('exports-') && f.endsWith('.bak'))
            .sort()
            .reverse();
        
        if (backupFiles.length > MAX_BACKUPS) {
            for (let i = MAX_BACKUPS; i < backupFiles.length; i++) {
                await fs.unlink(path.join(BACKUP_DIR, backupFiles[i]));
            }
        }
        
        return backupFile;
    } catch (error) {
        console.error('Backup failed:', error);
        throw error;
    }
};

const parseExportsFile = async () => {
    try {
        // Read from the configuration file instead of /etc/exports
        const configContent = await fs.readFile(CONFIG_FILE, 'utf8');
        const config = JSON.parse(configContent);
        
        const exports = [];
        const errors = [];
        
        if (!config.exports || !Array.isArray(config.exports)) {
            return { exports: [], errors: ['Configuration file is invalid or empty'] };
        }
        
        config.exports.forEach((exportConfig, index) => {
            try {
                if (!exportConfig.path || !exportConfig.clients || !Array.isArray(exportConfig.clients)) {
                    errors.push(`Export ${index + 1}: Invalid export configuration`);
                    return;
                }
                
                // Validate clients
                const validClients = [];
                exportConfig.clients.forEach(client => {
                    if (!client.ip || !client.permission) {
                        errors.push(`Export ${index + 1}: Invalid client configuration`);
                        return;
                    }
                    
                    if (!validateIP(client.ip)) {
                        errors.push(`Export ${index + 1}: Invalid IP address: ${client.ip}`);
                        return;
                    }
                    
                    if (!['ro', 'rw'].includes(client.permission)) {
                        errors.push(`Export ${index + 1}: Invalid permission: ${client.permission}`);
                        return;
                    }
                    
                    validClients.push({ ip: client.ip, permission: client.permission });
                });
                
                if (validClients.length === 0) {
                    errors.push(`Export ${index + 1}: No valid clients found`);
                    return;
                }
                
                exports.push({
                    path: exportConfig.path,
                    clients: validClients,
                    metadata: exportConfig.metadata || {}
                });
                
            } catch (error) {
                errors.push(`Export ${index + 1}: Parse error - ${error.message}`);
                console.error('Error parsing export:', error);
            }
        });
        
        return { exports, errors };
    } catch (error) {
        // If configuration file doesn't exist or is invalid, return empty exports
        console.warn('Configuration file not found or invalid, returning empty exports');
        return { exports: [], errors: ['Configuration file not found or invalid'] };
    }
};

// Authentication routes
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    
    try {
        const isValidUser = username === ADMIN_USERNAME;
        const isValidPassword = await bcrypt.compare(password, await bcrypt.hash(ADMIN_PASSWORD, 10));
        
        if (isValidUser && isValidPassword) {
            const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
            res.json({ token, username });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Authentication error' });
    }
});

// NFS Management API Routes
app.get('/api/exports', authenticateToken, async (req, res) => {
    try {
        const { exports, errors } = await parseExportsFile();
        
        if (errors.length > 0) {
            console.warn('Export file parsing warnings:', errors);
        }
        
        res.json({ exports, warnings: errors });
    } catch (error) {
        console.error('Error reading exports:', error);
        res.status(500).json({ error: 'Failed to read NFS exports' });
    }
});

app.post('/api/exports', authenticateToken, async (req, res) => {
    const { path, clients } = req.body;
    
    if (!validatePath(path)) {
        return res.status(400).json({ error: 'Invalid path' });
    }
    
    if (!Array.isArray(clients) || clients.length === 0) {
        return res.status(400).json({ error: 'At least one client must be specified' });
    }
    
    // Validate all clients
    for (const client of clients) {
        if (!validateIP(client.ip) || !['ro', 'rw'].includes(client.permission)) {
            return res.status(400).json({ error: 'Invalid client configuration' });
        }
    }
    
    try {
        // Check if path exists
        await fs.access(path);
        
        // Create backup before making changes
        const backupFile = await createBackup();
        console.log(`Backup created: ${backupFile}`);
        
        // Read current configuration
        let config = { exports: [], metadata: {} };
        try {
            const configContent = await fs.readFile(CONFIG_FILE, 'utf8');
            config = JSON.parse(configContent);
        } catch (error) {
            // If file doesn't exist, use default config
            config = { exports: [], metadata: {} };
        }
        
        // Check if export already exists
        const existingExport = config.exports.find(exp => exp.path === path);
        if (existingExport) {
            return res.status(400).json({ error: 'Export already exists' });
        }
        
        // Add new export
        config.exports.push({ path, clients });
        config.metadata.lastModified = new Date().toISOString();
        
        // Write configuration file
        await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
        
        // Wait a moment for the config manager to pick up the change
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        res.json({ 
            message: 'Export created successfully', 
            export: { path, clients },
            backup: backupFile
        });
    } catch (error) {
        console.error('Error creating export:', error);
        res.status(500).json({ error: 'Failed to create export' });
    }
});

app.put('/api/exports/:path(*)', authenticateToken, async (req, res) => {
    const { path: exportPath } = req.params;
    const { clients } = req.body;
    
    if (!validatePath(exportPath)) {
        return res.status(400).json({ error: 'Invalid path' });
    }
    
    if (!Array.isArray(clients) || clients.length === 0) {
        return res.status(400).json({ error: 'At least one client must be specified' });
    }
    
    // Validate all clients
    for (const client of clients) {
        if (!validateIP(client.ip) || !['ro', 'rw'].includes(client.permission)) {
            return res.status(400).json({ error: 'Invalid client configuration' });
        }
    }
    
    try {
        // Create backup before making changes
        const backupFile = await createBackup();
        console.log(`Backup created: ${backupFile}`);
        
        // Read current configuration
        let config = { exports: [], metadata: {} };
        try {
            const configContent = await fs.readFile(CONFIG_FILE, 'utf8');
            config = JSON.parse(configContent);
        } catch (error) {
            // If file doesn't exist, use default config
            config = { exports: [], metadata: {} };
        }
        
        // Find and update the export
        const exportIndex = config.exports.findIndex(exp => exp.path === exportPath);
        if (exportIndex === -1) {
            return res.status(404).json({ error: 'Export not found' });
        }
        
        // Update the export
        config.exports[exportIndex] = { path: exportPath, clients };
        config.metadata.lastModified = new Date().toISOString();
        
        // Write configuration file
        await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
        
        // Wait a moment for the config manager to pick up the change
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        res.json({ 
            message: 'Export updated successfully', 
            export: { path: exportPath, clients },
            backup: backupFile
        });
    } catch (error) {
        console.error('Error updating export:', error);
        res.status(500).json({ error: 'Failed to update export' });
    }
});

// Remove individual IP address from an export
app.delete('/api/exports/clients', authenticateToken, async (req, res) => {
    const { path: exportPath, ip } = req.body;
    
    console.log('Delete client request:', { exportPath, ip, body: req.body });
    
    if (!validatePath(exportPath)) {
        return res.status(400).json({ error: 'Invalid path' });
    }
    
    if (!ip) {
        return res.status(400).json({ error: 'IP address is required' });
    }
    
    try {
        // Create backup before making changes
        const backupFile = await createBackup();
        console.log(`Backup created: ${backupFile}`);
        
        // Read current configuration
        let config = { exports: [], metadata: {} };
        try {
            const configContent = await fs.readFile(CONFIG_FILE, 'utf8');
            config = JSON.parse(configContent);
        } catch (error) {
            // If file doesn't exist, use default config
            config = { exports: [], metadata: {} };
        }
        
        console.log('Current config exports:', config.exports.map(exp => exp.path));
        console.log('Looking for export path:', exportPath);
        
        // Find the export
        const exportIndex = config.exports.findIndex(exp => exp.path === exportPath);
        if (exportIndex === -1) {
            console.log('Export not found. Available paths:', config.exports.map(exp => exp.path));
            return res.status(404).json({ error: 'Export not found' });
        }
        
        // Find and remove the client
        const clientIndex = config.exports[exportIndex].clients.findIndex(client => client.ip === ip);
        if (clientIndex === -1) {
            return res.status(404).json({ error: 'IP address not found for this export' });
        }
        
        // Remove the client
        config.exports[exportIndex].clients.splice(clientIndex, 1);
        
        // If no clients left, remove the entire export
        if (config.exports[exportIndex].clients.length === 0) {
            config.exports.splice(exportIndex, 1);
            res.json({ 
                message: 'IP address removed and export deleted (no clients remaining)',
                backup: backupFile
            });
        } else {
            config.metadata.lastModified = new Date().toISOString();
            res.json({ 
                message: 'IP address removed successfully',
                export: config.exports[exportIndex],
                backup: backupFile
            });
        }
        
        // Write configuration file
        await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
        
        // Wait a moment for the config manager to pick up the change
        await new Promise(resolve => setTimeout(resolve, 1000));
        
    } catch (error) {
        console.error('Error removing IP address:', error);
        res.status(500).json({ error: 'Failed to remove IP address' });
    }
});

app.delete('/api/exports/:path(*)', authenticateToken, async (req, res) => {
    const { path: exportPath } = req.params;
    
    if (!validatePath(exportPath)) {
        return res.status(400).json({ error: 'Invalid path' });
    }
    
    try {
        // Create backup before making changes
        const backupFile = await createBackup();
        console.log(`Backup created: ${backupFile}`);
        
        // Read current configuration
        let config = { exports: [], metadata: {} };
        try {
            const configContent = await fs.readFile(CONFIG_FILE, 'utf8');
            config = JSON.parse(configContent);
        } catch (error) {
            // If file doesn't exist, use default config
            config = { exports: [], metadata: {} };
        }
        
        // Find and remove the export
        const exportIndex = config.exports.findIndex(exp => exp.path === exportPath);
        if (exportIndex === -1) {
            return res.status(404).json({ error: 'Export not found' });
        }
        
        config.exports.splice(exportIndex, 1);
        config.metadata.lastModified = new Date().toISOString();
        
        // Write configuration file
        await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
        
        // Wait a moment for the config manager to pick up the change
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        res.json({ 
            message: 'Export deleted successfully',
            backup: backupFile
        });
    } catch (error) {
        console.error('Error deleting export:', error);
        res.status(500).json({ error: 'Failed to delete export' });
    }
});

// Add individual IP address to an export
app.post('/api/exports/:path(*)/clients', authenticateToken, async (req, res) => {
    const { path: exportPath } = req.params;
    const { ip, permission } = req.body;
    
    if (!validatePath(exportPath)) {
        return res.status(400).json({ error: 'Invalid path' });
    }
    
    if (!ip || !permission) {
        return res.status(400).json({ error: 'IP and permission are required' });
    }
    
    if (!validateIP(ip)) {
        return res.status(400).json({ error: 'Invalid IP address' });
    }
    
    if (!['ro', 'rw'].includes(permission)) {
        return res.status(400).json({ error: 'Invalid permission. Use "ro" or "rw"' });
    }
    
    try {
        // Create backup before making changes
        const backupFile = await createBackup();
        console.log(`Backup created: ${backupFile}`);
        
        // Read current configuration
        let config = { exports: [], metadata: {} };
        try {
            const configContent = await fs.readFile(CONFIG_FILE, 'utf8');
            config = JSON.parse(configContent);
        } catch (error) {
            // If file doesn't exist, use default config
            config = { exports: [], metadata: {} };
        }
        
        // Find the export
        const exportIndex = config.exports.findIndex(exp => exp.path === exportPath);
        if (exportIndex === -1) {
            return res.status(404).json({ error: 'Export not found' });
        }
        
        // Check if IP already exists
        const existingClient = config.exports[exportIndex].clients.find(client => client.ip === ip);
        if (existingClient) {
            return res.status(400).json({ error: 'IP address already exists for this export' });
        }
        
        // Add new client
        config.exports[exportIndex].clients.push({ ip, permission });
        config.metadata.lastModified = new Date().toISOString();
        
        // Write configuration file
        await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
        
        // Wait a moment for the config manager to pick up the change
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        res.json({ 
            message: 'IP address added successfully',
            export: config.exports[exportIndex],
            backup: backupFile
        });
    } catch (error) {
        console.error('Error adding IP address:', error);
        res.status(500).json({ error: 'Failed to add IP address' });
    }
});

// Backup and restore routes
app.get('/api/backups', authenticateToken, async (req, res) => {
    try {
        await ensureBackupDir();
        const files = await fs.readdir(BACKUP_DIR);
        const backups = files
            .filter(f => f.startsWith('exports-') && f.endsWith('.bak'))
            .map(f => {
                const stats = fsSync.statSync(path.join(BACKUP_DIR, f));
                return {
                    filename: f,
                    size: stats.size,
                    created: stats.birthtime,
                    path: path.join(BACKUP_DIR, f)
                };
            })
            .sort((a, b) => b.created - a.created);
        
        res.json({ backups });
    } catch (error) {
        console.error('Error listing backups:', error);
        res.status(500).json({ error: 'Failed to list backups' });
    }
});

app.post('/api/backups/restore/:filename', authenticateToken, async (req, res) => {
    const { filename } = req.params;
    
    if (!filename || !filename.endsWith('.bak')) {
        return res.status(400).json({ error: 'Invalid backup filename' });
    }
    
    try {
        const backupPath = path.join(BACKUP_DIR, filename);
        
        // Verify backup file exists
        await fs.access(backupPath);
        
        // Create backup of current state before restoring
        const currentBackup = await createBackup();
        console.log(`Current state backed up: ${currentBackup}`);
        
        // Restore from backup
        const backupContent = await fs.readFile(backupPath, 'utf8');
        
        // Parse the backup content and write to configuration file
        try {
            const backupConfig = JSON.parse(backupContent);
            await fs.writeFile(CONFIG_FILE, JSON.stringify(backupConfig, null, 2));
            
            // Wait a moment for the config manager to pick up the change
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            // If backup is not JSON (old format), create a basic config
            console.warn('Backup is not in JSON format, creating basic config');
            const basicConfig = {
                exports: [],
                metadata: {
                    created: new Date().toISOString(),
                    version: "1.0",
                    description: "NFS Exports restored from backup",
                    lastModified: new Date().toISOString()
                }
            };
            await fs.writeFile(CONFIG_FILE, JSON.stringify(basicConfig, null, 2));
        }
        
        res.json({ 
            message: 'Backup restored successfully',
            restored: filename,
            currentBackup
        });
    } catch (error) {
        console.error('Error restoring backup:', error);
        res.status(500).json({ error: 'Failed to restore backup' });
    }
});

app.delete('/api/backups/:filename', authenticateToken, async (req, res) => {
    const { filename } = req.params;
    
    if (!filename || !filename.endsWith('.bak')) {
        return res.status(400).json({ error: 'Invalid backup filename' });
    }
    
    try {
        const backupPath = path.join(BACKUP_DIR, filename);
        await fs.unlink(backupPath);
        
        res.json({ message: 'Backup deleted successfully' });
    } catch (error) {
        console.error('Error deleting backup:', error);
        res.status(500).json({ error: 'Failed to delete backup' });
    }
});

app.get('/api/status', authenticateToken, async (req, res) => {
    try {
        // Check NFS server status
        const nfsStatus = await execCommand('systemctl is-active nfs-kernel-server');
        const nfsEnabled = await execCommand('systemctl is-enabled nfs-kernel-server');
        
        // Get active exports from configuration
        const { exports: configExports } = await parseExportsFile();
        const activeExports = `${configExports.length} exports configured`;
        
        // Get system info
        const uptime = await execCommand('uptime -p');
        const memory = await execCommand('free -h | grep Mem | awk \'{print $3"/"$2}\'');
        const disk = await execCommand('df -h / | tail -1 | awk \'{print $5}\'');
        
        // Parse exports file for validation
        const { exports, errors } = await parseExportsFile();
        
        res.json({
            nfsServer: {
                status: nfsStatus,
                enabled: nfsEnabled === 'enabled'
            },
            system: {
                uptime,
                memory,
                diskUsage: disk
            },
            exports: {
                count: exports.length,
                warnings: errors.length
            },
            activeExports: activeExports
        });
    } catch (error) {
        console.error('Error getting status:', error);
        res.status(500).json({ error: 'Failed to get system status' });
    }
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`NFS Management Server running on port ${PORT}`);
    console.log(`Access the web UI at: http://localhost:${PORT}`);
    console.log(`Default credentials: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
    console.log('⚠️  WARNING: Change default credentials in production!');
    console.log(`Backup directory: ${BACKUP_DIR}`);
});
