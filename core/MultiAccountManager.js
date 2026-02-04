const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const ntpClient = require('ntp-client');
const Account = require('../models/Account');
const MultiLogger = require('./MultiLogger');
const MultiTaskScheduler = require('./MultiTaskScheduler');
const { ErrorFactory, ErrorHandler, ErrorTypes } = require('../utils/errors');

class MultiAccountManager {
    constructor(baseDir) {
        this.baseDir = baseDir || process.cwd();
        
        // 目录设置
        this.configsDir = path.join(this.baseDir, 'configs');
        this.logsDir = path.join(this.baseDir, 'logs');
        
        // 确保目录存在
        if (!fs.existsSync(this.configsDir)) {
            fs.mkdirSync(this.configsDir, { recursive: true });
        }
        
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
        
        // 全局配置文件
        this.globalConfigPath = path.join(this.configsDir, 'global-config.json');
        
        // 初始化组件
        this.logger = new MultiLogger(this.baseDir);
        this.errorHandler = new ErrorHandler(this.logger);
        this.taskScheduler = new MultiTaskScheduler(this, this.logger);
        
        // 添加自动同步定时器
        this.autoSyncTimer = null;

        // 存储账号
        this.accounts = new Map(); // id -> Account
        
        // 全局配置
        this.globalConfig = {
            timeSync: {
                enabled: true,
                autoSync: true,
                syncInterval: 5,
                lastSync: null,
                offset: 0,
                ntpServer: null,
                ntpServers: [
                    'time.windows.com',
                    'time.apple.com',
                    'pool.ntp.org',
                    'cn.pool.ntp.org'
                ]
            },
            logSettings: {
                level: 'info',
                maxSize: '10MB',
                maxFiles: 10
            },
            version: '3.0.0'
        };
    }
    
    // 加载全局配置
    async loadGlobalConfig() {
        try {
            if (fs.existsSync(this.globalConfigPath)) {
                const data = JSON.parse(await fsPromises.readFile(this.globalConfigPath, 'utf8'));
                this.globalConfig = { ...this.globalConfig, ...data };
                this.logger.global('全局配置加载成功', 'success');
            } else {
                // 保存默认配置
                await this.saveGlobalConfig();
                this.logger.global('创建默认全局配置', 'info');
            }
        } catch (error) {
            this.logger.global(`加载全局配置失败: ${error.message}`, 'error');
        }
    }
    
    // 保存全局配置
    async saveGlobalConfig() {
        try {
            await fsPromises.writeFile(this.globalConfigPath, JSON.stringify(this.globalConfig, null, 2), 'utf8');
            return true;
        } catch (error) {
            this.logger.global(`保存全局配置失败: ${error.message}`, 'error');
            return false;
        }
    }
    
    // 加载所有账号
    async loadAllAccounts() {
        try {
            const files = await fsPromises.readdir(this.configsDir);
            
            for (const file of files) {
                if (file.endsWith('.json') && file !== 'global-config.json') {
                    const accountId = file.replace('.json', '');
                    const result = await this.loadAccount(accountId);
                    if (!result.success) {
                        this.logger.global(`账号 ${accountId} 加载失败: ${result.error.message}`, 'warning');
                    }
                }
            }
            
            this.logger.global(`加载了 ${this.accounts.size} 个账号`, 'success');
            return { success: true, count: this.accounts.size };
        } catch (error) {
            const appError = this.errorHandler.handle(
                ErrorFactory.ioError(`加载账号失败: ${error.message}`, this.configsDir, 'readdir'),
                { operation: 'loadAllAccounts' }
            );
            return { success: false, error: appError };
        }
    }
    
    // 加载单个账号
    async loadAccount(accountId) {
        const configPath = path.join(this.configsDir, `${accountId}.json`);
        
        try {
            if (!fs.existsSync(configPath)) {
                const error = ErrorFactory.configError(
                    `账号配置文件不存在: ${accountId}`,
                    configPath,
                    'account_id'
                );
                this.errorHandler.handle(error, { operation: 'loadAccount', accountId });
                return { success: false, error, accountId };
            }
            
            const data = JSON.parse(await fsPromises.readFile(configPath, 'utf8'));
            // 标记数据来自存储，需要解密
            data._fromStorage = true;
            const account = new Account(data);
            
            // 验证账号
            const validation = account.validate();
            if (!validation.valid) {
                const error = ErrorFactory.validationError(
                    `账号 ${account.name} 配置无效`,
                    validation.errors,
                    'account_config'
                );
                this.errorHandler.handle(error, { operation: 'loadAccount', accountId: account.id, accountName: account.name });
                // 警告但不阻止加载
            }
            
            // 保存到内存
            this.accounts.set(account.id, account);
            
            // 安排任务
            this.scheduleAccountTasks(account);
            
            this.logger.global(`账号加载成功: ${account.name}`, 'success');
            return { success: true, account };
        } catch (error) {
            const appError = this.errorHandler.handle(
                ErrorFactory.ioError(`加载账号 ${accountId} 失败: ${error.message}`, configPath, 'read'),
                { operation: 'loadAccount', accountId }
            );
            return { success: false, error: appError, accountId };
        }
    }
    
    // 安排账号任务
    scheduleAccountTasks(account) {
        if (!account.enabled) {
            this.logger.account(account.id, '账号已禁用，跳过任务安排', 'info', 'task');
            return;
        }
        
        const enabledTasks = account.getEnabledTasks();
        let scheduledCount = 0;
        
        for (const task of enabledTasks) {
            if (this.taskScheduler.scheduleTask(task)) {
                scheduledCount++;
            }
        }
        
        this.logger.account(account.id, `安排了 ${scheduledCount} 个任务`, 'info', 'task');
    }
    
    // 创建新账号
    async createAccount(accountData) {
        try {
            // 验证必填字段
            if (!accountData.name || !accountData.name.trim()) {
                return {
                    success: false,
                    message: '账号名称不能为空'
                };
            }

            // Cookie 可以为空，在账号管理窗口中配置
            // 如果提供了 Cookie，则使用；否则设置为空字符串
            if (!accountData.cookie) {
                accountData.cookie = '';
            }
            
            // 创建账号实例
            const account = new Account(accountData);
            
            // 验证账号数据
            const validation = account.validate();
            if (!validation.valid) {
                return {
                    success: false,
                    message: `账号验证失败: ${validation.errors.join(', ')}`
                };
            }
            
            // 先添加到内存
            this.accounts.set(account.id, account);
            
            // 保存账号配置
            try {
                const saveResult = await this.saveAccount(account.id);
                if (!saveResult.success) {
                    // 保存失败，从内存中移除
                    this.accounts.delete(account.id);
                    throw new Error(`保存账号配置失败: ${saveResult.error?.message || '未知错误'}`);
                }
            } catch (saveError) {
                // 保存失败，从内存中移除
                this.accounts.delete(account.id);
                throw saveError;
            }
            
            // 安排任务
            this.scheduleAccountTasks(account);
            
            this.logger.global(`账号创建成功: ${account.name}`, 'success');
            
            return {
                success: true,
                account: account.toJSON(),
                message: '账号创建成功'
            };
        } catch (error) {
            const errorMessage = error.message || '创建账号时发生未知错误';
            this.logger.global(`创建账号失败: ${errorMessage}`, 'error');
            
            return {
                success: false,
                message: errorMessage
            };
        }
    }
    
    // 删除账号
    async deleteAccount(accountId) {
        try {
            const account = this.accounts.get(accountId);
            if (!account) {
                return {
                    success: false,
                    message: '账号不存在'
                };
            }
            
            // 停止所有任务
            this.taskScheduler.stopAccountTasks(accountId);
            
            // 删除配置文件
            const configPath = path.join(this.configsDir, `${accountId}.json`);
            if (fs.existsSync(configPath)) {
                await fsPromises.unlink(configPath);
            }
            
            // 删除日志目录
            const logDir = path.join(this.logsDir, accountId);
            if (fs.existsSync(logDir)) {
                await fsPromises.rm(logDir, { recursive: true });
            }
            
            // 从内存中移除
            this.accounts.delete(accountId);
            
            this.logger.global(`账号删除成功: ${account.name}`, 'success');
            
            return {
                success: true,
                accountId: accountId
            };
        } catch (error) {
            const appError = this.errorHandler.handle(
                ErrorFactory.ioError(`删除账号失败: ${error.message}`, null, 'delete'),
                { operation: 'deleteAccount', accountId }
            );
            return {
                success: false,
                error: appError
            };
        }
    }
    
    // 获取账号
    getAccount(accountId) {
        return this.accounts.get(accountId);
    }
    
    // 获取所有账号
    getAllAccounts() {
        return Array.from(this.accounts.values()).map(account => account.toJSON());
    }
    
    // 保存账号配置
    async saveAccount(accountId) {
        const account = this.accounts.get(accountId);
        if (!account) {
            const error = ErrorFactory.validationError('账号不存在', [], 'account_id');
            this.errorHandler.handle(error, { operation: 'saveAccount', accountId });
            return { success: false, error };
        }
        
        try {
            const configPath = path.join(this.configsDir, `${accountId}.json`);
            await fsPromises.writeFile(configPath, JSON.stringify(account.toJSON(), null, 2), 'utf8');
            
            // 更新账号的更新时间
            account.updatedAt = new Date().toISOString();
            
            this.logger.account(accountId, '配置保存成功', 'success', 'config');
            return { success: true };
        } catch (error) {
            const appError = this.errorHandler.handle(
                ErrorFactory.ioError(`保存配置失败: ${error.message}`, configPath, 'write'),
                { operation: 'saveAccount', accountId, accountName: account.name }
            );
            return { success: false, error: appError };
        }
    }
    
    // 更新账号配置
    async updateAccount(accountId, updates) {
        const account = this.accounts.get(accountId);
        if (!account) {
            return {
                success: false,
                message: '账号不存在'
            };
        }
        
        try {
            // 更新账号属性
            Object.assign(account, updates);
            account.updatedAt = new Date().toISOString();
            
            // 重新安排任务
            this.taskScheduler.stopAccountTasks(accountId);
            this.scheduleAccountTasks(account);
            
            // 保存配置
            const saveResult = await this.saveAccount(accountId);
            if (!saveResult.success) {
                throw new Error(`保存账号配置失败: ${saveResult.error.message}`);
            }
            
            this.logger.account(accountId, '账号配置更新成功', 'success', 'config');
            
            return {
                success: true,
                account: account.toJSON()
            };
        } catch (error) {
            this.logger.account(accountId, `更新账号配置失败: ${error.message}`, 'error', 'config');
            return {
                success: false,
                message: error.message
            };
        }
    }
    
    // 执行账号任务
    async executeAccountTask(accountId, taskData) {
        const account = this.accounts.get(accountId);
        if (!account) {
            return {
                success: false,
                message: '账号不存在'
            };
        }
        
        // 创建临时任务
        const task = {
            id: `manual_${Date.now()}`,
            accountId: accountId,
            ...taskData
        };
        
        // 执行任务
        const result = await this.taskScheduler.executeTaskNow(task);
        return result;
    }
    
    // 获取账号统计信息
    getAccountStats(accountId) {
        const account = this.accounts.get(accountId);
        if (!account) return null;
        
        return {
            ...account.statistics,
            taskCount: account.tasks.length,
            enabledTaskCount: account.getEnabledTasks().length
        };
    }
    
    // 获取全局统计信息
    getGlobalStats() {
        let totalAccounts = this.accounts.size;
        let totalTasks = 0;
        let totalEnabledTasks = 0;
        let totalSuccess = 0;
        let totalFail = 0;
        
        for (const account of this.accounts.values()) {
            totalTasks += account.tasks.length;
            totalEnabledTasks += account.getEnabledTasks().length;
            totalSuccess += account.statistics.successCount;
            totalFail += account.statistics.failCount;
        }
        
        return {
            totalAccounts,
            totalTasks,
            totalEnabledTasks,
            totalSuccess,
            totalFail
        };
    }
 
    // 初始化时启动自动同步
    async initialize() {
        try {
            // 加载全局配置
            await this.loadGlobalConfig();
            
            // 加载所有账号
            await this.loadAllAccounts();
            
            // 启动自动时间同步
            this.startAutoTimeSync();
            
            this.logger.global('多账号管理器初始化完成', 'success');
            return true;
        } catch (error) {
            this.logger.global(`初始化失败: ${error.message}`, 'error');
            return false;
        }
    }
    
    // 启动自动时间同步
    startAutoTimeSync() {
        // 清除现有定时器
        if (this.autoSyncTimer) {
            clearInterval(this.autoSyncTimer);
            this.autoSyncTimer = null;
        }
        
        // 如果启用自动同步
        if (this.globalConfig.timeSync.enabled && this.globalConfig.timeSync.autoSync) {
            const syncInterval = (this.globalConfig.timeSync.syncInterval || 5) * 60 * 1000; // 转换为毫秒
            
            this.autoSyncTimer = setInterval(async () => {
                try {
                    this.logger.global(`自动时间同步开始...`, 'info', 'time-sync.auto');
                    await this.syncServerTime();
                } catch (error) {
                    this.logger.global(`自动时间同步失败: ${error.message}`, 'error', 'time-sync.auto');
                }
            }, syncInterval);
            
            // 立即执行一次同步
            setTimeout(async () => {
                try {
                    await this.syncServerTime();
                } catch (error) {
                    console.error('首次时间同步失败:', error);
                }
            }, 1000);
            
            this.logger.global(`已启用自动时间同步，每${syncInterval/60000}分钟同步一次`, 'success', 'time-sync');
        }
    }   
    
    // NTP服务器列表
    getNtpServers() {
        return this.globalConfig.timeSync.ntpServers || [
            'time.windows.com',
            'time.apple.com',
            'pool.ntp.org',
            'cn.pool.ntp.org'
        ];
    }

    // 同步NTP时间（不修改系统时间，只计算偏移量）
    async syncServerTime() {
        try {
            this.logger.global('正在同步NTP服务器时间...', 'info', 'time-sync');
            
            const ntpServers = this.getNtpServers();
            let syncResult = null;
            let lastError = null;
            
            // 尝试多个NTP服务器
            for (const server of ntpServers) {
                try {
                    const ntpTime = await new Promise((resolve, reject) => {
                        ntpClient.getNetworkTime(server, 123, (err, date) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(date);
                            }
                        });
                    });
                    
                    const localTime = new Date().getTime();
                    const offset = ntpTime.getTime() - localTime;
                    
                    syncResult = {
                        server: server,
                        offset: offset,
                        ntpTime: ntpTime,
                        localTime: new Date(localTime)
                    };
                    
                    this.logger.global(`NTP服务器 ${server} 同步成功`, 'info', 'time-sync');
                    break; // 成功则跳出循环
                } catch (err) {
                    lastError = err;
                    this.logger.global(`NTP服务器 ${server} 失败: ${err.message}`, 'warning', 'time-sync');
                }
            }
            
            if (!syncResult) {
                throw lastError || new Error('所有NTP服务器都不可用');
            }
            
            // 保存时间偏移量（不修改系统时间）
            this.globalConfig.timeSync.offset = syncResult.offset;
            this.globalConfig.timeSync.lastSync = new Date().toISOString();
            this.globalConfig.timeSync.ntpServer = syncResult.server;
            
            await this.saveGlobalConfig();
            
            const offsetStr = syncResult.offset >= 0 ? `+${syncResult.offset}` : `${syncResult.offset}`;
            this.logger.global(`NTP时间同步成功! 服务器: ${syncResult.server}, 偏移量: ${offsetStr}ms`, 'success', 'time-sync');
            
            // 记录详细时间信息
            this.logger.global(
                `本地时间: ${syncResult.localTime.toLocaleString('zh-CN')}, ` +
                `NTP时间: ${syncResult.ntpTime.toLocaleString('zh-CN')}`, 
                'info', 'time-sync.detail'
            );
            
            // 通知所有窗口
            global.sendToRenderer('time-synced', {
                success: true,
                offset: syncResult.offset,
                ntpTime: syncResult.ntpTime,
                localTime: syncResult.localTime,
                server: syncResult.server,
                timestamp: new Date().toISOString()
            });
            
            return {
                success: true,
                offset: syncResult.offset,
                ntpTime: syncResult.ntpTime,
                localTime: syncResult.localTime,
                server: syncResult.server
            };
        } catch (error) {
            this.logger.global(`NTP时间同步失败: ${error.message}`, 'error', 'time-sync');
            return {
                success: false,
                message: error.message
            };
        }
    }
    
    // 获取当前NTP时间（基于偏移量计算）
    getCurrentNtpTime() {
        const offset = this.globalConfig.timeSync.offset || 0;
        return new Date(Date.now() + offset);
    }
    
    // 获取NTP时间戳（毫秒）
    getCurrentNtpTimestamp() {
        const offset = this.globalConfig.timeSync.offset || 0;
        return Date.now() + offset;
    }
    
    // 更新全局配置时重新启动自动同步
    async updateGlobalConfig(updates) {
        try {
            this.globalConfig = { ...this.globalConfig, ...updates };
            await this.saveGlobalConfig();
            
            // 如果时间同步配置发生变化，重新启动自动同步
            if (updates.timeSync) {
                this.startAutoTimeSync();
            }
            
            return true;
        } catch (error) {
            this.logger.global(`更新全局配置失败: ${error.message}`, 'error');
            return false;
        }
    }
    
    // 销毁时清理定时器
    destroy() {
        if (this.autoSyncTimer) {
            clearInterval(this.autoSyncTimer);
        }
        
        if (this.taskScheduler) {
            this.taskScheduler.destroy();
        }
    }
}

module.exports = MultiAccountManager;