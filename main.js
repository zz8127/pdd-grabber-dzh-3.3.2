const { app, BrowserWindow, ipcMain, Notification, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// 设置控制台编码（解决Windows中文乱码问题）
if (process.platform === 'win32') {
    // 在最早时机设置代码页为UTF-8
    try {
        const { execSync } = require('child_process');
        execSync('chcp 65001', { stdio: 'ignore' });
    } catch (e) {
        // 忽略错误，继续执行
    }
    
    // 设置控制台输出编码为UTF-8
    if (process.stdout && process.stdout.setEncoding) {
        process.stdout.setEncoding('utf8');
    }
    if (process.stderr && process.stderr.setEncoding) {
        process.stderr.setEncoding('utf8');
    }
    
    // 设置环境变量（必须在任何输出之前）
    process.env.NODE_OPTIONS = '--enable-utf8';
    process.env.PYTHONIOENCODING = 'utf-8';
    process.env.LANG = 'zh_CN.UTF-8';
    process.env.LC_ALL = 'zh_CN.UTF-8';
}

/**
 * 拼多多多账号抢购助手 - 主进程
 * @version 3.3.2
 */

// 导入核心模块
const MultiAccountManager = require('./core/MultiAccountManager');
const ConfigManager = require('./core/ConfigManager');
const PerformanceMonitor = require('./core/PerformanceMonitor');

// 全局变量
let mainWindow = null;
let accountWindows = new Map(); // accountId -> BrowserWindow
let loginWindows = new Map(); // accountId -> BrowserWindow (多登录窗口支持)
let accountManager = null;
let configManager = null;
let performanceMonitor = null;

// 开发模式配置
if (process.env.NODE_ENV === 'development') {
    require('electron-reload')(__dirname, {
        electron: require(`${__dirname}/node_modules/electron`)
    });
}

// 获取应用路径
global.appPath = app.getAppPath();
if (app.isPackaged) {
    global.appPath = path.dirname(app.getPath('exe'));
}

// 创建主窗口
function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 1000,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'icon.ico'),
        show: false,
        backgroundColor: '#f5f5f5'
    });

    mainWindow.loadFile('index.html');
    
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        // 初始化完成后发送通知
        mainWindow.webContents.send('app-ready');
    });
    
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    
    return mainWindow;
}

// 创建账号子窗口
function createAccountWindow(accountId) {
    if (accountWindows.has(accountId)) {
        const existingWindow = accountWindows.get(accountId);
        existingWindow.focus();
        return existingWindow;
    }
    
    const account = accountManager.getAccount(accountId);
    if (!account) {
        console.error(`账号不存在: ${accountId}`);
        return null;
    }
    
    const accountWindow = new BrowserWindow({
        width: 550,
        height: 700,
        parent: mainWindow,
        modal: false,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload-account.js')
        },
        title: `账号管理 - ${account.name}`,
        backgroundColor: '#f5f5f5'
    });
    
    // 加载账号子窗口页面
    accountWindow.loadFile('account-window.html', {
        query: { accountId: accountId }
    });
    
    accountWindow.once('ready-to-show', () => {
        accountWindow.show();
    });
    
    accountWindow.on('closed', () => {
        accountWindows.delete(accountId);
    });
    
    // 存储窗口引用
    accountWindows.set(accountId, accountWindow);
    
    return accountWindow;
}

// 创建登录窗口（支持多账号独立窗口）
function createLoginWindow(accountId) {
    // 检查是否已有该账号的登录窗口
    const existingWindow = loginWindows.get(accountId);
    if (existingWindow && !existingWindow.isDestroyed()) {
        existingWindow.focus();
        return existingWindow;
    }
    
    // 获取账号信息
    let accountName = '未知账号';
    if (accountId) {
        const account = accountManager.getAccount(accountId);
        if (account) {
            accountName = account.name;
        }
    }
    
    // 为每个账号创建独立的登录窗口
    const newLoginWindow = new BrowserWindow({
        width: 900,
        height: 750,
        parent: mainWindow,
        modal: false,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webviewTag: true,
            preload: path.join(__dirname, 'preload-login.js'),
            // 为每个账号使用独立的session partition
            partition: `persist:pdd_login_${accountId || 'default'}`
        },
        title: `拼多多登录 - ${accountName} (${accountId})`,
        backgroundColor: '#f5f5f5',
        resizable: true,
        maximizable: true,
        minimizable: true
    });
    
    // 加载登录窗口页面
    newLoginWindow.loadFile('login-window.html', {
        query: { accountId: accountId }
    });
    
    // 打开开发者工具时保留日志
    newLoginWindow.webContents.on('did-finish-load', () => {
        // 配置webview的开发者工具设置
        newLoginWindow.webContents.executeJavaScript(`
            (function() {
                if (window.pddWebview) {
                    window.pddWebview.addEventListener('dom-ready', function() {
                        // 保留日志设置
                        try {
                            window.pddWebview.executeJavaScript(
                                "console.log('[PDD] 页面加载完成，日志保留已启用');"
                            );
                        } catch(e) {}
                    });
                }
            })();
        `);
    });
    
    newLoginWindow.once('ready-to-show', () => {
        newLoginWindow.show();
    });
    
    newLoginWindow.on('closed', () => {
        loginWindows.delete(accountId);
    });
    
    // 存储窗口引用
    loginWindows.set(accountId, newLoginWindow);
    
    return newLoginWindow;
}

// 设置全局通信
function setupGlobalCommunications() {
    global.sendToRenderer = (channel, data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(channel, data);
        }
    };
    
    global.sendToAccountWindow = (accountId, channel, data) => {
        const accountWindow = accountWindows.get(accountId);
        if (accountWindow && !accountWindow.isDestroyed()) {
            accountWindow.webContents.send(channel, data);
        }
    };
    
    global.showNotification = (title, message) => {
        if (Notification.isSupported()) {
            const notif = new Notification({
                title: title,
                body: message,
                icon: path.join(__dirname, 'icon.png')
            });
            
            notif.show();
        }
    };
}

// 设置IPC通信
function setupIPC() {
    // ==================== 账号管理 ====================
    ipcMain.handle('get-all-accounts', () => {
        try {
            const accounts = accountManager.getAllAccounts();
            return {
                success: true,
                accounts: accounts
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    });
    
    ipcMain.handle('create-account', async (event, accountData) => {
        try {
            const result = await accountManager.createAccount(accountData);
            
            if (result.success) {
                // 通知所有窗口账号更新
                global.sendToRenderer('account-created', result.account);
            }
            
            return result;
        } catch (error) {
            const errorMessage = error.message || '创建账号时发生错误';
            console.error('创建账号失败:', error);
            return {
                success: false,
                message: errorMessage
            };
        }
    });
    
    ipcMain.handle('delete-account', async (event, accountId) => {
        try {
            const result = await accountManager.deleteAccount(accountId);
            
            if (result.success) {
                // 关闭账号窗口
                const accountWindow = accountWindows.get(accountId);
                if (accountWindow) {
                    accountWindow.close();
                }
                
                // 通知所有窗口账号删除
                global.sendToRenderer('account-deleted', accountId);
            }
            
            return result;
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    });
    
    ipcMain.handle('get-account', (event, accountId) => {
        try {
            const account = accountManager.getAccount(accountId);
            if (account) {
                return {
                    success: true,
                    account: account.toJSON()
                };
            } else {
                return {
                    success: false,
                    message: '账号不存在'
                };
            }
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    });
    
    ipcMain.handle('update-account', async (event, accountId, updates) => {
        try {
            const result = await accountManager.updateAccount(accountId, updates);
            
            if (result.success) {
                // 通知所有窗口账号更新
                global.sendToRenderer('account-updated', result.account);
                
                // 通知账号窗口
                global.sendToAccountWindow(accountId, 'account-updated', result.account);
            }
            
            return result;
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    });
    
    ipcMain.handle('open-account-window', (event, accountId) => {
        try {
            const window = createAccountWindow(accountId);
            return {
                success: true,
                windowId: window ? window.id : null
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    });
    
    ipcMain.handle('open-login-window', (event, accountId) => {
        try {
            const window = createLoginWindow(accountId);
            return {
                success: true,
                windowId: window ? window.id : null
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    });
    
    // 获取登录窗口的完整Cookie（包括HttpOnly Cookie）
    ipcMain.handle('get-login-window-cookies', async (event, accountId) => {
        try {
            const { session } = require('electron');
            const partition = `persist:pdd_login_${accountId || 'default'}`;
            const ses = session.fromPartition(partition);

            // 获取 mobile.yangkeduo.com 域的所有 Cookie
            const cookies = await ses.cookies.get({
                domain: 'mobile.yangkeduo.com'
            });

            // 获取 .yangkeduo.com 域的所有 Cookie
            const cookies2 = await ses.cookies.get({
                domain: '.yangkeduo.com'
            });

            // 合并所有 Cookie
            const allCookies = [...cookies, ...cookies2];

            // 将 Cookie 数组转换为 Cookie 字符串
            const cookieString = allCookies.map(cookie => {
                return `${cookie.name}=${cookie.value}`;
            }).join('; ');

            console.log(`[Main] 获取到 ${allCookies.length} 个Cookie`);

            return {
                success: true,
                cookies: cookieString,
                cookieCount: allCookies.length,
                cookieDetails: allCookies.map(c => ({ name: c.name, domain: c.domain }))
            };
        } catch (error) {
            console.error('[Main] 获取Cookie失败:', error);
            return {
                success: false,
                message: error.message,
                cookies: ''
            };
        }
    });

    ipcMain.handle('apply-cookie-data', async (event, accountId, cookieData) => {
        try {
            // 更新账号配置
            const account = accountManager.getAccount(accountId);
            if (account) {
                // 更新账号的Cookie配置
                const updates = {
                    cookie: cookieData.cookie || '',
                    pdduid: cookieData.pdduid || '',
                    userAgent: cookieData.userAgent || '',
                    antiContent: cookieData.antiContent || '',
                    defaultAddressId: cookieData.addressId || '',
                    defaultGroupId: cookieData.groupId || '',
                    defaultActivityId: cookieData.activityId || ''
                };

                // 异步更新账号
                await accountManager.updateAccount(accountId, updates);

                // 发送通知到账号窗口
                global.sendToAccountWindow(accountId, 'cookie-data-applied', cookieData);

                return {
                    success: true,
                    message: 'Cookie数据已应用到账号配置'
                };
            } else {
                return {
                    success: false,
                    message: '账号不存在'
                };
            }
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    });

    ipcMain.handle('get-all-tasks', async () => {
        try {
            const accounts = accountManager.getAllAccounts();
            const allTasks = [];
            
            accounts.forEach(account => {
                if (account.tasks && account.tasks.length > 0) {
                    account.tasks.forEach(task => {
                        allTasks.push({
                            ...task,
                            accountName: account.name,
                            accountId: account.id
                        });
                    });
                }
            });
            
            return {
                success: true,
                tasks: allTasks
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    });
    
    // ==================== 任务管理 ====================
    ipcMain.handle('add-task', async (event, accountId, taskData) => {
        try {
            const account = accountManager.getAccount(accountId);
            if (!account) {
                return {
                    success: false,
                    message: '账号不存在'
                };
            }
            
            const task = account.addTask(taskData);
            
            // 保存账号配置
            await accountManager.saveAccount(accountId);
            
            // 安排任务
            accountManager.scheduleAccountTasks(account);
            
            // 通知更新
            global.sendToRenderer('task-added', { accountId, task });
            global.sendToAccountWindow(accountId, 'task-added', task);
            
            return {
                success: true,
                task: task
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    });
    
    ipcMain.handle('update-task', async (event, accountId, taskId, updates) => {
        try {
            const account = accountManager.getAccount(accountId);
            if (!account) {
                return {
                    success: false,
                    message: '账号不存在'
                };
            }
            
            const task = account.updateTask(taskId, updates);
            if (!task) {
                return {
                    success: false,
                    message: '任务不存在'
                };
            }
            
            // 保存账号配置
            await accountManager.saveAccount(accountId);
            
            // 重新安排任务
            accountManager.taskScheduler.stopTask(taskId);
            if (task.enabled) {
                accountManager.taskScheduler.scheduleTask(task);
            }
            
            // 通知更新
            global.sendToRenderer('task-updated', { accountId, task });
            global.sendToAccountWindow(accountId, 'task-updated', task);
            
            return {
                success: true,
                task: task
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    });
    
    ipcMain.handle('delete-task', async (event, accountId, taskId) => {
        try {
            const account = accountManager.getAccount(accountId);
            if (!account) {
                return {
                    success: false,
                    message: '账号不存在'
                };
            }
            
            const task = account.deleteTask(taskId);
            if (!task) {
                return {
                    success: false,
                    message: '任务不存在'
                };
            }
            
            // 保存账号配置
            await accountManager.saveAccount(accountId);
            
            // 停止任务
            accountManager.taskScheduler.stopTask(taskId);
            
            // 通知更新
            global.sendToRenderer('task-deleted', { accountId, taskId });
            global.sendToAccountWindow(accountId, 'task-deleted', taskId);
            
            return {
                success: true,
                task: task
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    });
    
    ipcMain.handle('get-account-tasks', (event, accountId) => {
        try {
            const account = accountManager.getAccount(accountId);
            if (!account) {
                return {
                    success: false,
                    message: '账号不存在'
                };
            }
            
            return {
                success: true,
                tasks: account.tasks
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    });
    
    ipcMain.handle('execute-task-now', async (event, accountId, taskData) => {
        try {
            const result = await accountManager.executeAccountTask(accountId, taskData);
            return result;
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    });
    
    // ==================== 全局统计 ====================
    ipcMain.handle('get-global-stats', () => {
        try {
            const stats = accountManager.getGlobalStats();
            return {
                success: true,
                stats: stats
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    });
    
    ipcMain.handle('get-account-stats', (event, accountId) => {
        try {
            const stats = accountManager.getAccountStats(accountId);
            if (stats) {
                return {
                    success: true,
                    stats: stats
                };
            } else {
                return {
                    success: false,
                    message: '账号不存在'
                };
            }
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    });
    
    // ==================== 时间同步 ====================
    ipcMain.handle('sync-server-time', async () => {
        try {
            const result = await accountManager.syncServerTime();

            if (result.success) {
                // 通知所有窗口时间同步完成
                global.sendToRenderer('time-synced', result);

                for (const [accountId, window] of accountWindows) {
                    global.sendToAccountWindow(accountId, 'time-synced', result);
                }
            }

            return result;
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    });

    // 保存时间同步设置
    ipcMain.handle('save-time-sync-settings', async (event, settings) => {
        try {
            // 保存到全局配置
            const configManager = require('./core/ConfigManager');
            const config = configManager.loadGlobalConfig();

            config.timeSync = {
                enabled: settings.enabled,
                interval: settings.interval,
                lastSync: config.timeSync?.lastSync || null,
                offset: config.timeSync?.offset || 0
            };

            await configManager.saveGlobalConfig(config);

            // 如果启用了自动同步，启动自动同步
            if (settings.enabled) {
                accountManager.startAutoTimeSync(settings.interval);
            } else {
                accountManager.stopAutoTimeSync();
            }

            return {
                success: true,
                message: '时间同步设置已保存'
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    });

    // 获取时间同步设置
    ipcMain.handle('get-time-sync-settings', async () => {
        try {
            const configManager = require('./core/ConfigManager');
            const config = configManager.loadGlobalConfig();

            return {
                success: true,
                settings: {
                    enabled: config.timeSync?.enabled !== false, // 默认启用
                    interval: config.timeSync?.interval || 5, // 默认5分钟
                    lastSync: config.timeSync?.lastSync || null,
                    offset: config.timeSync?.offset || 0
                }
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    });

    // ==================== 全局配置 ====================
    ipcMain.handle('get-global-config', () => {
        try {
            return {
                success: true,
                config: accountManager.globalConfig
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    });

    ipcMain.handle('update-global-config', async (event, updates) => {
        try {
            const success = await accountManager.updateGlobalConfig(updates);
            return { success };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    });   
    
    // ==================== 日志管理 ====================
    ipcMain.handle('send-error-log', (event, errorInfo) => {
        try {
            // 将Webview中的错误日志输出到主进程控制台
            console.error(`[Webview-Error] ${errorInfo.type}: ${errorInfo.message}`);
            if (errorInfo.stack) {
                console.error(`[Webview-Error] Stack: ${errorInfo.stack}`);
            }
            return {
                success: true,
                message: '错误日志已接收'
            };
        } catch (error) {
            console.error('处理错误日志失败:', error);
            return {
                success: false,
                message: error.message
            };
        }
    });
    
    ipcMain.handle('get-account-logs', (event, accountId, limit = 100, category = null) => {
        try {
            const logs = accountManager.logger.getAccountLogs(accountId, limit, category);
            return {
                success: true,
                logs: logs
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    });
    
    ipcMain.handle('get-global-logs', (event, limit = 100) => {
        try {
            const logs = accountManager.logger.getGlobalLogs(limit);
            return {
                success: true,
                logs: logs
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    });
    
    ipcMain.handle('clear-account-logs', (event, accountId) => {
        try {
            accountManager.logger.clearAccountLogs(accountId);
            return {
                success: true
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    });
    
    ipcMain.handle('export-logs', async (event, accountId = null, category = null) => {
        try {
            const exportPath = accountManager.logger.exportLogs(accountId, category);
            
            if (exportPath) {
                // 打开文件保存对话框
                const result = await dialog.showSaveDialog({
                    title: '导出日志',
                    defaultPath: exportPath,
                    filters: [
                        { name: 'JSON文件', extensions: ['json'] },
                        { name: '所有文件', extensions: ['*'] }
                    ]
                });
                
                if (!result.canceled) {
                    // 复制文件到用户选择的位置
                    fs.copyFileSync(exportPath, result.filePath);
                    
                    return {
                        success: true,
                        filePath: result.filePath
                    };
                }
            }
            
            return {
                success: false,
                message: '导出失败'
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    });

    ipcMain.handle('clear-global-logs', async (event) => {
        try {
            const success = accountManager.logger.clearGlobalLogs();
            
            if (success) {
                // 通知所有窗口日志已清空
                global.sendToRenderer('logs-cleared', {});
                
                return {
                    success: true
                };
            } else {
                return {
                    success: false,
                    message: '清空日志失败'
                };
            }
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    });   
    
    // ==================== 文件对话框 ====================
    ipcMain.handle('show-open-dialog', async (event, options) => {
        try {
            const result = await dialog.showOpenDialog(options);
            return result;
        } catch (error) {
            return {
                canceled: true,
                error: error.message
            };
        }
    });
    
    ipcMain.handle('show-save-dialog', async (event, options) => {
        try {
            const result = await dialog.showSaveDialog(options);
            return result;
        } catch (error) {
            return {
                canceled: true,
                error: error.message
            };
        }
    });
    
    // ==================== 高级设置 ====================
    ipcMain.handle('get-global-settings', () => {
        try {
            // 返回当前全局配置
            return {
                success: true,
                settings: accountManager.globalConfig.logSettings || {
                    retentionDays: 30,
                    maxSize: 10
                }
            };
        } catch (error) {
            accountManager.logger.global(`获取全局设置失败: ${error.message}`, 'error', 'settings');
            return { success: false, message: error.message };
        }
    });
    
    ipcMain.handle('save-global-settings', async (event, settings) => {
        try {
            // 更新全局配置
            accountManager.globalConfig.logSettings = {
                ...accountManager.globalConfig.logSettings,
                retentionDays: settings.logRetentionDays || 30,
                maxSize: settings.logMaxSize || 10
            };
            
            // 记录设置更新
            accountManager.logger.global(
                `全局设置已更新: 日志保留${settings.logRetentionDays}天，最大${settings.logMaxSize}MB`, 
                'success', 'settings'
            );
            
            // 保存配置
            await accountManager.saveGlobalConfig();
            
            return { success: true };
        } catch (error) {
            accountManager.logger.global(`保存全局设置失败: ${error.message}`, 'error', 'settings');
            return { success: false, message: error.message };
        }
    });

    // ==================== 通知 ====================
    ipcMain.handle('show-notification-dialog', async (event, notification) => {
        try {
            // 显示系统通知
            if (Notification.isSupported()) {
                const notif = new Notification({
                    title: notification.title || '拼多多多账号抢购助手',
                    body: notification.message,
                    icon: path.join(__dirname, 'icon.png')
                });
                
                notif.show();
            }
            
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    });
    
    // ==================== 配置热更新 ====================
    ipcMain.handle('watch-config', (event, configName) => {
        try {
            if (configManager) {
                configManager.watchConfig(configName);
                return { success: true };
            }
            return { success: false, message: '配置管理器未初始化' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    });
    
    ipcMain.handle('unwatch-config', (event, configName) => {
        try {
            if (configManager) {
                configManager.unwatchConfig(configName);
                return { success: true };
            }
            return { success: false, message: '配置管理器未初始化' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    });
    
    ipcMain.handle('get-config-history', async (event, configName) => {
        try {
            if (configManager) {
                const history = await configManager.getConfigHistory(configName);
                return { success: true, history };
            }
            return { success: false, message: '配置管理器未初始化' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    });
    
    ipcMain.handle('restore-config', async (event, configName, timestamp) => {
        try {
            if (configManager) {
                const config = await configManager.restoreConfig(configName, timestamp);
                return { success: true, config };
            }
            return { success: false, message: '配置管理器未初始化' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    });
    
    // ==================== 性能监控 ====================
    ipcMain.handle('start-performance-monitor', () => {
        try {
            if (performanceMonitor) {
                performanceMonitor.start();
                return { success: true };
            }
            return { success: false, message: '性能监控器未初始化' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    });
    
    ipcMain.handle('stop-performance-monitor', () => {
        try {
            if (performanceMonitor) {
                performanceMonitor.stop();
                return { success: true };
            }
            return { success: false, message: '性能监控器未初始化' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    });
    
    ipcMain.handle('get-performance-stats', () => {
        try {
            if (performanceMonitor) {
                const stats = performanceMonitor.getStats();
                return { success: true, stats };
            }
            return { success: false, message: '性能监控器未初始化' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    });
    
    ipcMain.handle('get-performance-history', (event, metricType, duration) => {
        try {
            if (performanceMonitor) {
                const history = performanceMonitor.getHistory(metricType, duration);
                return { success: true, history };
            }
            return { success: false, message: '性能监控器未初始化' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    });
    
    ipcMain.handle('update-performance-thresholds', (event, thresholds) => {
        try {
            if (performanceMonitor) {
                performanceMonitor.updateAlertThresholds(thresholds);
                return { success: true };
            }
            return { success: false, message: '性能监控器未初始化' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    });
    
    ipcMain.handle('reset-performance-stats', () => {
        try {
            if (performanceMonitor) {
                performanceMonitor.reset();
                return { success: true };
            }
            return { success: false, message: '性能监控器未初始化' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    });
    
    ipcMain.handle('generate-performance-report', (event, duration) => {
        try {
            if (performanceMonitor) {
                const report = performanceMonitor.generateReport(duration);
                return { success: true, report };
            }
            return { success: false, message: '性能监控器未初始化' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    });
    }

// 添加目录检查
function ensureDirectories() {
    const directories = [
        path.join(global.appPath, 'configs'),
        path.join(global.appPath, 'logs'),
        path.join(global.appPath, 'logs', 'global')
    ];
    
    directories.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`创建目录: ${dir}`);
        }
    });
}

/**
 * 初始化应用程序
 * @async
 */
async function initializeApp() {
    // 使用Buffer确保UTF-8编码输出
    try {
        if (process.stdout && process.stdout.write) {
            process.stdout.write(Buffer.from('启动拼多多多账号抢购助手...\n', 'utf8'));
        } else {
            console.log('启动拼多多多账号抢购助手...');
        }
    } catch (err) {
        console.log('启动拼多多多账号抢购助手...');
    }
    
    try {
        // 确保必要的目录存在
        ensureDirectories();
        
        // 初始化配置管理器
        configManager = new ConfigManager(global.appPath, console);
        
        // 监听配置变更事件
        configManager.on('config:changed', ({ configName, changes }) => {
            console.log(`配置 ${configName} 已更新，变更项:`, changes.length);
            // 通知所有窗口配置已更新
            global.sendToRenderer('config-changed', { configName, changes });
        });
        
        // 初始化性能监控器（使用简单的logger，等accountManager初始化后再更新）
        const simpleLogger = {
            global: (message, level = 'info', category = 'system') => {
                console.log(`[${level.toUpperCase()}] ${message}`);
            },
            account: (accountId, message, level = 'info', category = 'system', accountName = '') => {
                console.log(`[${level.toUpperCase()}] [${accountName || accountId}] ${message}`);
            }
        };
        performanceMonitor = new PerformanceMonitor(simpleLogger);
        
        // 监听性能告警事件
        performanceMonitor.on('alert:triggered', ({ type, message }) => {
            console.warn(`[性能告警] ${type}: ${message}`);
            global.sendToRenderer('performance-alert', { type, message, level: 'warning' });
        });
        
        performanceMonitor.on('alert:resolved', ({ type, message }) => {
            console.log(`[性能告警解除] ${type}: ${message}`);
            global.sendToRenderer('performance-alert-resolved', { type, message, level: 'success' });
        });
        
        // 启动性能监控
        performanceMonitor.start();
        
        // 初始化账号管理器
        accountManager = new MultiAccountManager(global.appPath);
        await accountManager.initialize();
        
        // 设置全局通信
        setupGlobalCommunications();
        
        // 创建主窗口
        mainWindow = createMainWindow();
        
        // 设置IPC通信
        setupIPC();
        
        // 设置日志发送器
        accountManager.logger.setRendererSender((target, logEntry) => {
            if (target === 'global') {
                global.sendToRenderer('log-global', logEntry);
            } else {
                // 发送到账号子窗口
                global.sendToAccountWindow(target, 'log-update', logEntry);
                // 同时发送到主窗口（用于全局日志显示）
                global.sendToRenderer(`log-account-${target}`, logEntry);
            }
        });
        
        // 监听任务执行，记录性能数据
        const originalExecuteTask = accountManager.executeAccountTask.bind(accountManager);
        accountManager.executeAccountTask = async (accountId, taskData) => {
            const startTime = Date.now();
            const result = await originalExecuteTask(accountId, taskData);
            const duration = Date.now() - startTime;
            
            // 记录到性能监控器
            if (performanceMonitor) {
                performanceMonitor.recordLatency(duration, result.success);
            }
            
            return result;
        };
        
        console.log('应用程序启动完成');
    } catch (error) {
        console.error('应用程序初始化失败:', error);
        throw error;
    }
}

// Electron生命周期
app.whenReady().then(() => {
    initializeApp().catch(error => {
        console.error('启动失败:', error);
        app.quit();
    });
    
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    console.log('应用程序即将退出...');
    
    // 关闭所有账号窗口
    for (const [accountId, window] of accountWindows) {
        if (!window.isDestroyed()) {
            window.close();
        }
    }
    
    // 停止性能监控
    if (performanceMonitor) {
        performanceMonitor.stop();
        performanceMonitor.destroy();
    }
    
    // 清理配置管理器
    if (configManager) {
        configManager.destroy();
    }
    
    // 清理账号管理器
    if (accountManager) {
        accountManager.destroy();
    }
    
    console.log('应用程序退出');
});

// 错误处理
process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
    if (accountManager && accountManager.logger) {
        accountManager.logger.global(`未捕获异常: ${error.message}`, 'error');
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的Promise拒绝:', reason);
    if (accountManager && accountManager.logger) {
        accountManager.logger.global(`未处理的Promise拒绝: ${reason}`, 'error');
    }
});