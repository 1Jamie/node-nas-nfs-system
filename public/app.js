// Global variables
let authToken = localStorage.getItem('authToken');
let currentUser = localStorage.getItem('currentUser');
let isEditing = false;
let editingPath = '';

// DOM elements
const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');
const addExportBtn = document.getElementById('addExportBtn');
const exportModal = document.getElementById('exportModal');
const exportsTableBody = document.getElementById('exportsTableBody');
const systemStatus = document.getElementById('systemStatus');
const createBackupBtn = document.getElementById('createBackupBtn');
const backupsTableBody = document.getElementById('backupsTableBody');
const restoreModal = document.getElementById('restoreModal');

// API base URL
const API_BASE = window.location.origin;

// Utility functions
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const messageEl = document.getElementById('notificationMessage');
    const icon = document.getElementById('notificationIcon');
    
    messageEl.textContent = message;
    
    // Set icon and color based on type
    switch(type) {
        case 'success':
            icon.className = 'fas fa-check-circle text-green-400';
            break;
        case 'error':
            icon.className = 'fas fa-exclamation-circle text-red-400';
            break;
        case 'warning':
            icon.className = 'fas fa-exclamation-triangle text-yellow-400';
            break;
        default:
            icon.className = 'fas fa-info-circle text-blue-400';
    }
    
    notification.classList.remove('hidden');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 5000);
}

function formatDate(date) {
    try {
        const dateObj = date instanceof Date ? date : new Date(date);
        if (isNaN(dateObj.getTime())) {
            return 'Invalid date';
        }
        
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).format(dateObj);
    } catch (error) {
        console.warn('Error formatting date:', error);
        return 'Invalid date';
    }
}

function formatFileSize(bytes) {
    try {
        if (!bytes || bytes === 0) return '0 B';
        if (isNaN(bytes)) return 'Unknown';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    } catch (error) {
        console.warn('Error formatting file size:', error);
        return 'Unknown';
    }
}

// API functions
async function apiCall(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };

    if (authToken) {
        config.headers.Authorization = `Bearer ${authToken}`;
    }

    try {
        const response = await fetch(url, config);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}

// System status functions
async function loadSystemStatus() {
    try {
        return await apiCall('/api/status');
    } catch (error) {
        showNotification('Failed to load system status: ' + error.message, 'error');
        return null;
    }
}

function updateSystemStatus(status) {
    if (!status) return;
    
    const nfsStatusIcon = document.getElementById('nfsStatusIcon');
    const nfsStatusText = document.getElementById('nfsStatusText');
    const activeExportsCount = document.getElementById('activeExportsCount');
    const systemUptime = document.getElementById('systemUptime');
    const memoryUsage = document.getElementById('memoryUsage');
    const diskUsage = document.getElementById('diskUsage');
    const exportWarnings = document.getElementById('exportWarnings');
    const lastUpdated = document.getElementById('lastUpdated');
    
    // Update NFS server status
    if (status.nfsServer.status === 'active') {
        nfsStatusIcon.className = 'w-3 h-3 rounded-full mr-2 bg-green-400';
        nfsStatusText.textContent = 'Running';
    } else {
        nfsStatusIcon.className = 'w-3 h-3 rounded-full mr-2 bg-red-400';
        nfsStatusText.textContent = 'Stopped';
    }
    
    // Update system info
    if (status.system) {
        activeExportsCount.textContent = status.activeExports || 0;
        systemUptime.textContent = status.system.uptime || 'Unknown';
        memoryUsage.textContent = status.system.memory || 'Unknown';
        diskUsage.textContent = status.system.diskUsage || 'Unknown';
    }
    
    // Update export warnings
    if (status.exportWarnings && status.exportWarnings.length > 0) {
        exportWarnings.textContent = status.exportWarnings.join(', ');
        exportWarnings.parentElement.classList.remove('hidden');
    } else {
        exportWarnings.parentElement.classList.add('hidden');
    }
    
    // Update last updated time
    lastUpdated.textContent = formatDate(new Date());
}

// Export management functions
async function loadExports() {
    try {
        const data = await apiCall('/api/exports');
        return data.exports || [];
    } catch (error) {
        showNotification('Failed to load exports: ' + error.message, 'error');
        return [];
    }
}

function updateExportsTable(exports) {
    if (exports.length === 0) {
        exportsTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-4 text-center text-gray-500">No exports found</td>
            </tr>
        `;
        return;
    }
    
    exportsTableBody.innerHTML = exports.map(exp => {
        const clients = exp.clients || [];
        let clientList = clients.map(client => 
            `<div class="inline-flex items-center bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-1 mb-1">
                <span>${client.ip} (${client.permission})</span>
                <button onclick="removeClient('${exp.path}', '${client.ip}')" 
                        class="ml-1 text-red-600 hover:text-red-800" title="Remove this IP">
                    <i class="fas fa-times"></i>
                </button>
            </div>`
        ).join('');
        
        if (clients.length > 0) {
            clientList += `<button onclick="addClientToExport('${exp.path}')" 
                        class="ml-2 text-green-600 hover:text-green-800 text-xs" title="Add IP address">
                    <i class="fas fa-plus"></i> Add IP
                </button>`;
        }
        
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <i class="fas fa-folder text-blue-600 mr-2"></i>${exp.path}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        NFSv4
                    </span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-500">
                    ${clientList}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${clients.map(c => c.permission).join(', ')}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="editExport('${exp.path}')" class="text-indigo-600 hover:text-indigo-900 mr-3">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteExport('${exp.path}')" class="text-red-600 hover:text-red-900">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Backup management functions
async function loadBackups() {
    try {
        const data = await apiCall('/api/backups');
        return data.backups;
    } catch (error) {
        showNotification('Failed to load backups: ' + error.message, 'error');
        return [];
    }
}

function updateBackupsTable(backups) {
    if (backups.length === 0) {
        backupsTableBody.innerHTML = `
            <tr>
                <td colspan="4" class="px-6 py-4 text-center text-gray-500">No backups found</td>
            </tr>
        `;
        return;
    }
    
    backupsTableBody.innerHTML = backups.map(backup => {
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <i class="fas fa-file-archive text-green-600 mr-2"></i>${backup.filename || 'Unknown'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${formatFileSize(backup.size)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${formatDate(backup.created)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="showRestoreModal('${backup.filename || ''}')" class="text-yellow-600 hover:text-yellow-900 mr-3">
                        <i class="fas fa-undo"></i>
                    </button>
                    <button onclick="deleteBackup('${backup.filename || ''}')" class="text-red-600 hover:text-red-900">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Modal functions
function showExportModal(editing = false, path = '') {
    isEditing = editing;
    editingPath = path;
    
    const modalTitle = document.getElementById('modalTitle');
    const exportPath = document.getElementById('exportPath');
    const clientsContainer = document.getElementById('clientsContainer');
    
    modalTitle.textContent = editing ? 'Edit NFS Export' : 'Add NFS Export';
    exportPath.value = path;
    exportPath.disabled = editing;
    
    // Clear existing clients
    clientsContainer.innerHTML = '';
    
    // Add initial client row
    addClientRow();
    
    exportModal.classList.remove('hidden');
}

function hideExportModal() {
    exportModal.classList.add('hidden');
    isEditing = false;
    editingPath = '';
    
    // Clear form
    document.getElementById('exportPath').value = '';
    document.getElementById('clientsContainer').innerHTML = '';
    addClientRow();
}

function showRestoreModal(filename) {
    document.getElementById('restoreFilename').textContent = filename;
    restoreModal.classList.remove('hidden');
}

function hideRestoreModal() {
    restoreModal.classList.add('hidden');
}

// Client management functions
function addClientRow(ip = '', permission = 'ro') {
    const container = document.getElementById('clientsContainer');
    const row = document.createElement('div');
    row.className = 'flex space-x-2';
    row.innerHTML = `
        <input type="text" placeholder="192.168.1.100 or 192.168.1.0/24" 
               class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent client-ip" value="${ip}">
        <select class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent client-permission">
            <option value="ro" ${permission === 'ro' ? 'selected' : ''}>Read Only</option>
            <option value="rw" ${permission === 'rw' ? 'selected' : ''}>Read/Write</option>
        </select>
        <button type="button" class="remove-client-btn px-3 py-2 text-red-600 hover:text-red-800">
            <i class="fas fa-trash"></i>
        </button>
    `;
    container.appendChild(row);
}

function getFormData() {
    const path = document.getElementById('exportPath').value.trim();
    const clientRows = document.querySelectorAll('#clientsContainer > div');
    
    const clients = Array.from(clientRows).map(row => {
        const ip = row.querySelector('.client-ip').value.trim();
        const permission = row.querySelector('.client-permission').value;
        return { ip, permission };
    }).filter(client => client.ip); // Filter out empty IPs
    
    return { path, clients };
}

function validateFormData(path, clients) {
    if (!path) {
        showNotification('Export path is required', 'error');
        return false;
    }
    
    if (!path.startsWith('/')) {
        showNotification('Export path must be absolute (start with /)', 'error');
        return false;
    }
    
    if (clients.length === 0) {
        showNotification('At least one client must be specified', 'error');
        return false;
    }
    
    for (const client of clients) {
        if (!client.ip) {
            showNotification('All client IP addresses must be specified', 'error');
            return false;
        }
        
        // Basic IP validation
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        const cidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/([0-9]|[1-2][0-9]|3[0-2])$/;
        
        if (!ipRegex.test(client.ip) && !cidrRegex.test(client.ip)) {
            showNotification(`Invalid IP address: ${client.ip}`, 'error');
            return false;
        }
    }
    
    return true;
}

async function saveExport() {
    const { path, clients } = getFormData();
    
    if (!validateFormData(path, clients)) {
        return;
    }
    
    try {
        if (isEditing) {
            await updateExport(editingPath, { clients });
        } else {
            await createExport(path, { clients });
        }
        
        hideExportModal();
        refreshDashboard();
    } catch (error) {
        // Error already shown in API function
    }
}

// API functions for exports
async function createExport(path, clients) {
    try {
        const data = await apiCall('/api/exports', {
            method: 'POST',
            body: JSON.stringify({ path, clients })
        });
        
        showNotification('Export created successfully', 'success');
        return data;
    } catch (error) {
        showNotification('Failed to create export: ' + error.message, 'error');
        throw error;
    }
}

async function updateExport(path, clients) {
    try {
        const data = await apiCall(`/api/exports/${encodeURIComponent(path)}`, {
            method: 'PUT',
            body: JSON.stringify({ clients })
        });
        
        showNotification('Export updated successfully', 'success');
        return data;
    } catch (error) {
        showNotification('Failed to update export: ' + error.message, 'error');
        throw error;
    }
}

async function deleteExport(path) {
    if (!confirm(`Are you sure you want to delete the export "${path}"?`)) {
        return;
    }
    
    try {
        await apiCall(`/api/exports/${encodeURIComponent(path)}`, {
            method: 'DELETE'
        });
        
        showNotification('Export deleted successfully', 'success');
        refreshDashboard();
    } catch (error) {
        showNotification('Failed to delete export: ' + error.message, 'error');
    }
}

// Backup functions
async function createBackup() {
    try {
        // Create a backup by making a small change and then reverting it
        const currentExports = await loadExports();
        if (currentExports.length === 0) {
            // If no exports, create a temporary one to trigger backup
            await apiCall('/api/exports', {
                method: 'POST',
                body: JSON.stringify({
                    path: '/tmp/nfs-backup-trigger',
                    clients: [{ ip: '127.0.0.1', permission: 'ro' }]
                })
            });
            
            // Immediately delete it
            await apiCall('/api/exports/%2Ftmp%2Fnfs-backup-trigger', {
                method: 'DELETE'
            });
        } else {
            // Update the first export to trigger backup
            const firstExport = currentExports[0];
            const originalClients = firstExport.clients;
            
            // Temporarily modify and restore
            await apiCall(`/api/exports/${encodeURIComponent(firstExport.path)}`, {
                method: 'PUT',
                body: JSON.stringify({ clients: originalClients })
            });
        }
        
        showNotification('Backup created successfully', 'success');
        refreshDashboard();
    } catch (error) {
        showNotification('Failed to create backup: ' + error.message, 'error');
    }
}

async function restoreBackup(filename) {
    try {
        await apiCall(`/api/backups/restore/${filename}`, {
            method: 'POST'
        });
        
        showNotification('Backup restored successfully', 'success');
        hideRestoreModal();
        refreshDashboard();
    } catch (error) {
        showNotification('Failed to restore backup: ' + error.message, 'error');
    }
}

async function deleteBackup(filename) {
    if (!confirm(`Are you sure you want to delete backup "${filename}"?`)) {
        return;
    }
    
    try {
        await apiCall(`/api/backups/${filename}`, {
            method: 'DELETE'
        });
        
        showNotification('Backup deleted successfully', 'success');
        refreshDashboard();
    } catch (error) {
        showNotification('Failed to delete backup: ' + error.message, 'error');
    }
}

// Client management functions
async function addClientToExport(exportPath) {
    const ip = prompt('Enter IP address to add:');
    if (!ip) return;
    
    const permission = prompt('Enter permission (ro/rw):', 'ro');
    if (!permission || !['ro', 'rw'].includes(permission)) {
        showNotification('Invalid permission. Use "ro" or "rw"', 'error');
        return;
    }
    
    try {
        await apiCall(`/api/exports/${encodeURIComponent(exportPath)}/clients`, {
            method: 'POST',
            body: JSON.stringify({ ip, permission })
        });
        
        showNotification('IP address added successfully', 'success');
        refreshDashboard();
    } catch (error) {
        showNotification('Failed to add IP address: ' + error.message, 'error');
    }
}

async function removeClient(exportPath, ip) {
    if (!confirm(`Are you sure you want to remove IP address "${ip}" from export "${exportPath}"?`)) {
        return;
    }
    
    try {
        await apiCall('/api/exports/clients', {
            method: 'DELETE',
            body: JSON.stringify({ path: exportPath, ip })
        });
        
        showNotification('IP address removed successfully', 'success');
        refreshDashboard();
    } catch (error) {
        showNotification('Failed to remove IP address: ' + error.message, 'error');
    }
}

// UI functions
function showLoginScreen() {
    loginScreen.classList.remove('hidden');
    dashboard.classList.add('hidden');
    loginError.classList.add('hidden');
}

function showDashboard() {
    loginScreen.classList.add('hidden');
    dashboard.classList.remove('hidden');
    userInfo.textContent = `Logged in as: ${currentUser}`;
    refreshDashboard();
}

function refreshDashboard() {
    loadSystemStatus().then(updateSystemStatus);
    loadExports().then(updateExportsTable);
    loadBackups().then(updateBackupsTable);
}

// Event handlers
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already logged in
    if (authToken && currentUser) {
        showDashboard();
    } else {
        showLoginScreen();
    }
    
    // Auto-refresh dashboard every 30 seconds
    setInterval(() => {
        if (!loginScreen.classList.contains('hidden')) {
            return; // Don't refresh if on login screen
        }
        refreshDashboard();
    }, 30000);
});

// Login form handler
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(loginForm);
    const username = formData.get('username');
    const password = formData.get('password');
    
    try {
        const response = await apiCall('/api/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        authToken = response.token;
        currentUser = response.username;
        
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('currentUser', currentUser);
        
        showDashboard();
        loginError.classList.add('hidden');
    } catch (error) {
        loginError.textContent = error.message;
        loginError.classList.remove('hidden');
    }
});

// Logout handler
logoutBtn.addEventListener('click', () => {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    showLoginScreen();
});

// Add export button
addExportBtn.addEventListener('click', () => {
    showExportModal(false);
});

// Modal event handlers
document.getElementById('saveExportBtn').addEventListener('click', saveExport);
document.getElementById('cancelExportBtn').addEventListener('click', hideExportModal);
document.getElementById('createBackupBtn').addEventListener('click', createBackup);
document.getElementById('confirmRestoreBtn').addEventListener('click', () => {
    const filename = document.getElementById('restoreFilename').textContent;
    restoreBackup(filename);
});
document.getElementById('cancelRestoreBtn').addEventListener('click', hideRestoreModal);

// Add client button
document.getElementById('addClientBtn').addEventListener('click', () => {
    addClientRow();
});

// Remove client button delegation
document.addEventListener('click', (e) => {
    if (e.target.closest('.remove-client-btn')) {
        const row = e.target.closest('.flex');
        row.remove();
    }
});

// Global functions for table actions
window.editExport = editExport;
window.deleteExport = deleteExport;
window.showRestoreModal = showRestoreModal;
window.deleteBackup = deleteBackup;
window.addClientToExport = addClientToExport;
window.removeClient = removeClient;

function editExport(path) {
    // Find the export data
    loadExports().then(exports => {
        const exportData = exports.find(exp => exp.path === path);
        if (exportData) {
            showExportModal(true, path);
            
            // Populate clients
            const clientsContainer = document.getElementById('clientsContainer');
            clientsContainer.innerHTML = '';
            
            if (exportData.clients && exportData.clients.length > 0) {
                exportData.clients.forEach(client => addClientRow(client.ip, client.permission));
            } else {
                addClientRow();
            }
        }
    });
}
