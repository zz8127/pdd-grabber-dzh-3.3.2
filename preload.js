const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    // ==================== 账号管理 ====================
    getAllAccounts: () => ipcRenderer.invoke('get-all-accounts'),
    createAccount: (accountData) => ipcRenderer.invoke('create-account', accountData),
    deleteAccount: (accountId) => ipcRenderer.invoke('delete-account', accountId),
    getAccount: (accountId) => ipcRenderer.invoke('get-account', accountId),
    updateAccount: (accountId, updates) => ipcRenderer.invoke('update-account', accountId, updates),
    openAccountWindow: (accountId) => ipcRenderer.invoke('open-account-window', accountId),
    
    // ==================== 任务管理 ====================
    addTask: (accountId, taskData) => ipcRenderer.invoke('add-task', accountId, taskData),
    updateTask: (accountId, taskId, updates) => ipcRenderer.invoke('update-task', accountId, taskId, updates),
    deleteTask: (accountId, taskId) => ipcRenderer.invoke('delete-task', accountId, taskId),
    getAccountTasks: (accountId) => ipcRenderer.invoke('get-account-tasks', accountId),
    executeTaskNow: (accountId, taskData) => ipcRenderer.invoke('execute-task-now', accountId, taskData),
    getAllTasks: () => ipcRenderer.invoke('get-all-tasks'),
    
    // ==================== 统计信息 ====================
    getGlobalStats: () => ipcRenderer.invoke('get-global-stats'),
    getAccountStats: (accountId) => ipcRenderer.invoke('get-account-stats', accountId),
    
    // ==================== 全局配置 ====================
    getGlobalConfig: () => ipcRenderer.invoke('get-global-config'), // 新增
    updateGlobalConfig: (updates) => ipcRenderer.invoke('update-global-config', updates),
    saveGlobalSettings: (settings) => ipcRenderer.invoke('save-global-settings', settings),
    getGlobalSettings: () => ipcRenderer.invoke('get-global-settings'), // 新增
    
    // ==================== 时间同步 ====================
    syncServerTime: () => ipcRenderer.invoke('sync-server-time'),
    saveTimeSyncSettings: (settings) => ipcRenderer.invoke('save-time-sync-settings', settings),
    getTimeSyncSettings: () => ipcRenderer.invoke('get-time-sync-settings'),
    
    // ==================== 日志管理 ====================
    getGlobalLogs: (limit) => ipcRenderer.invoke('get-global-logs', limit),
    getAccountLogs: (accountId, limit, category) => ipcRenderer.invoke('get-account-logs', accountId, limit, category),
    clearAccountLogs: (accountId) => ipcRenderer.invoke('clear-account-logs', accountId),
    exportLogs: (accountId, category) => ipcRenderer.invoke('export-logs', accountId, category),
    clearGlobalLogs: () => ipcRenderer.invoke('clear-global-logs'),
    
    // ==================== 文件对话框 ====================
    showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
    showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
    
    // ==================== 通知 ====================
    showNotification: (title, message) => ipcRenderer.send('show-notification', { title, message }),
    
    // ==================== 全局配置 ====================
    updateGlobalConfig: (updates) => ipcRenderer.invoke('update-global-config', updates),
    saveGlobalSettings: (settings) => ipcRenderer.invoke('save-global-settings', settings),
    
    // ==================== 事件监听 ====================
    onAppReady: (callback) => {
        ipcRenderer.on('app-ready', () => callback());
        return () => ipcRenderer.removeAllListeners('app-ready');
    },
    
    onAccountCreated: (callback) => {
        ipcRenderer.on('account-created', (event, account) => callback(account));
        return () => ipcRenderer.removeAllListeners('account-created');
    },
    
    onAccountDeleted: (callback) => {
        ipcRenderer.on('account-deleted', (event, accountId) => callback(accountId));
        return () => ipcRenderer.removeAllListeners('account-deleted');
    },
    
    onAccountUpdated: (callback) => {
        ipcRenderer.on('account-updated', (event, account) => callback(account));
        return () => ipcRenderer.removeAllListeners('account-updated');
    },
    
    onTaskAdded: (callback) => {
        ipcRenderer.on('task-added', (event, data) => callback(data));
        return () => ipcRenderer.removeAllListeners('task-added');
    },
    
    onTaskUpdated: (callback) => {
        ipcRenderer.on('task-updated', (event, data) => callback(data));
        return () => ipcRenderer.removeAllListeners('task-updated');
    },
    
    onTaskDeleted: (callback) => {
        ipcRenderer.on('task-deleted', (event, data) => callback(data));
        return () => ipcRenderer.removeAllListeners('task-deleted');
    },
    
    onTimeSynced: (callback) => {
        ipcRenderer.on('time-synced', (event, result) => callback(result));
        return () => ipcRenderer.removeAllListeners('time-synced');
    },
    
    onLogGlobal: (callback) => {
        ipcRenderer.on('log-global', (event, logEntry) => callback(logEntry));
        return () => ipcRenderer.removeAllListeners('log-global');
    },

    // 添加日志清空事件监听
    onLogsCleared: (callback) => {
        ipcRenderer.on('logs-cleared', (event) => callback());
        return () => ipcRenderer.removeAllListeners('logs-cleared');
    },
    
    onLogAccount: (accountId, callback) => {
        const channel = `log-${accountId}`;
        ipcRenderer.on(channel, (event, logEntry) => callback(logEntry));
        return () => ipcRenderer.removeAllListeners(channel);
    }
});