const { contextBridge, ipcRenderer } = require('electron');

// 从URL获取账号ID
const urlParams = new URLSearchParams(window.location.search);
const accountId = urlParams.get('accountId');

// 暴露安全的API给账号窗口
contextBridge.exposeInMainWorld('accountAPI', {
    // 获取账号ID
    getAccountId: () => accountId,
    
    // ==================== 账号操作 ====================
    getAccount: () => ipcRenderer.invoke('get-account', accountId),
    updateAccount: (updates) => ipcRenderer.invoke('update-account', accountId, updates),
    
    // ==================== 任务操作 ====================
    getAccountTasks: () => ipcRenderer.invoke('get-account-tasks', accountId),
    addTask: (taskData) => ipcRenderer.invoke('add-task', accountId, taskData),
    updateTask: (taskId, updates) => ipcRenderer.invoke('update-task', accountId, taskId, updates),
    deleteTask: (taskId) => ipcRenderer.invoke('delete-task', accountId, taskId),
    executeTaskNow: (taskData) => ipcRenderer.invoke('execute-task-now', accountId, taskData),
    
    // ==================== 统计信息 ====================
    getAccountStats: () => ipcRenderer.invoke('get-account-stats', accountId),
    
    // ==================== 时间同步 ====================
    syncServerTime: () => ipcRenderer.invoke('sync-server-time'),
    
    // ==================== 日志管理 ====================
    getAccountLogs: (limit, category) => ipcRenderer.invoke('get-account-logs', accountId, limit, category),
    clearAccountLogs: () => ipcRenderer.invoke('clear-account-logs', accountId),
    exportLogs: (category) => ipcRenderer.invoke('export-logs', accountId, category),
    
    // ==================== 事件监听 ====================
    onAccountUpdated: (callback) => {
        ipcRenderer.on('account-updated', (event, account) => {
            if (account.id === accountId) callback(account);
        });
        return () => ipcRenderer.removeAllListeners('account-updated');
    },
    
    onTaskAdded: (callback) => {
        ipcRenderer.on('task-added', (event, task) => {
            if (task.accountId === accountId) callback(task);
        });
        return () => ipcRenderer.removeAllListeners('task-added');
    },
    
    onTaskUpdated: (callback) => {
        ipcRenderer.on('task-updated', (event, task) => {
            if (task.accountId === accountId) callback(task);
        });
        return () => ipcRenderer.removeAllListeners('task-updated');
    },
    
    onTaskDeleted: (callback) => {
        ipcRenderer.on('task-deleted', (event, taskId) => {
            // 注意：这里需要额外判断，可以通过再次获取任务列表来确认
            callback(taskId);
        });
        return () => ipcRenderer.removeAllListeners('task-deleted');
    },
    
    onTimeSynced: (callback) => {
        ipcRenderer.on('time-synced', (event, result) => callback(result));
        return () => ipcRenderer.removeAllListeners('time-synced');
    },
    
    // 监听日志更新事件
    onLogUpdate: (callback) => {
        const channel = 'log-update';
        ipcRenderer.on(channel, (event, logEntry) => {
            callback(logEntry);
        });
        return () => ipcRenderer.removeAllListeners(channel);
    },
    
    // 监听Cookie数据应用事件
    onCookieDataApplied: (callback) => {
        ipcRenderer.on('cookie-data-applied', (event, cookieData) => {
            callback(cookieData);
        });
        return () => ipcRenderer.removeAllListeners('cookie-data-applied');
    },
    
    // ==================== 窗口操作 ====================
    closeWindow: () => {
        window.close();
    },
    
    minimizeWindow: () => {
        const { remote } = require('electron');
        remote.getCurrentWindow().minimize();
    },
    
    maximizeWindow: () => {
        const { remote } = require('electron');
        const win = remote.getCurrentWindow();
        if (win.isMaximized()) {
            win.unmaximize();
        } else {
            win.maximize();
        }
    },
    
    // 打开登录窗口
    openLoginWindow: () => {
        return ipcRenderer.invoke('open-login-window', accountId);
    }
});