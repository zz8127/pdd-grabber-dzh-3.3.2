const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');
const { ErrorFactory, ErrorTypes } = require('../utils/errors');

/**
 * 配置管理器
 * 实现配置文件热更新、版本控制和变更监听
 */
class ConfigManager extends EventEmitter {
    constructor(baseDir, logger) {
        super();
        
        this.baseDir = baseDir || process.cwd();
        this.logger = logger;
        
        // 目录设置
        this.configsDir = path.join(this.baseDir, 'configs');
        
        // 确保目录存在
        if (!fs.existsSync(this.configsDir)) {
            fs.mkdirSync(this.configsDir, { recursive: true });
        }
        
        // 文件监听器
        this.watchers = new Map();
        
        // 配置缓存
        this.configCache = new Map();
        
        // 防抖定时器
        this.debounceTimers = new Map();
        
        // 默认防抖延迟(ms)
        this.debounceDelay = 300;
        
        // 配置版本号
        this.configVersions = new Map();
        
        // 是否启用热更新
        this.hotReloadEnabled = true;
        
        // 配置验证规则
        this.validationRules = this._initValidationRules();
    }
    
    /**
     * 初始化验证规则
     * @private
     */
    _initValidationRules() {
        return {
            'global-config.json': {
                required: ['timeSync', 'logSettings'],
                types: {
                    'timeSync.enabled': 'boolean',
                    'timeSync.autoSync': 'boolean',
                    'timeSync.syncInterval': 'number',
                    'logSettings.maxSize': 'number',
                    'logSettings.retentionDays': 'number'
                }
            },
            'account': {
                required: ['id', 'name', 'cookie'],
                types: {
                    'enabled': 'boolean',
                    'requestSettings.requestCount': 'number',
                    'requestSettings.requestInterval': 'number',
                    'requestSettings.maxRequestTime': 'number'
                }
            }
        };
    }
    
    /**
     * 启动配置文件监听
     * @param {string} configName - 配置文件名（不含路径）
     */
    watchConfig(configName) {
        const configPath = path.join(this.configsDir, configName);
        
        if (this.watchers.has(configName)) {
            this.logger.global(`配置 ${configName} 已在监听中`, 'warning', 'config.watch');
            return;
        }
        
        if (!fs.existsSync(configPath)) {
            this.logger.global(`配置文件不存在: ${configPath}`, 'error', 'config.watch');
            return;
        }
        
        try {
            const watcher = fs.watch(configPath, (eventType) => {
                if (eventType === 'change' && this.hotReloadEnabled) {
                    this._handleConfigChange(configName, configPath);
                }
            });
            
            this.watchers.set(configName, watcher);
            this.logger.global(`开始监听配置: ${configName}`, 'info', 'config.watch');
            
        } catch (error) {
            this.logger.global(`监听配置失败 ${configName}: ${error.message}`, 'error', 'config.watch');
        }
    }
    
    /**
     * 处理配置文件变更
     * @private
     */
    _handleConfigChange(configName, configPath) {
        // 清除之前的防抖定时器
        if (this.debounceTimers.has(configName)) {
            clearTimeout(this.debounceTimers.get(configName));
        }
        
        // 设置新的防抖定时器
        const timer = setTimeout(async () => {
            try {
                this.logger.global(`配置 ${configName} 发生变化，正在重新加载...`, 'info', 'config.reload');
                
                // 读取新配置
                const content = await fsPromises.readFile(configPath, 'utf8');
                const newConfig = JSON.parse(content);
                
                // 验证配置
                const validation = this._validateConfig(configName, newConfig);
                if (!validation.valid) {
                    this.logger.global(
                        `配置验证失败 ${configName}: ${validation.errors.join(', ')}`,
                        'error',
                        'config.validation'
                    );
                    this.emit('config:validationFailed', {
                        configName,
                        errors: validation.errors
                    });
                    return;
                }
                
                // 检查版本（防止重复加载相同配置）
                const newVersion = this._calculateVersion(newConfig);
                const oldVersion = this.configVersions.get(configName);
                
                if (newVersion === oldVersion) {
                    this.logger.global(`配置 ${configName} 内容未变更，跳过重载`, 'debug', 'config.reload');
                    return;
                }
                
                // 获取旧配置用于对比
                const oldConfig = this.configCache.get(configName);
                
                // 更新缓存和版本
                this.configCache.set(configName, newConfig);
                this.configVersions.set(configName, newVersion);
                
                // 计算变更差异
                const changes = this._diffConfig(oldConfig, newConfig);
                
                this.logger.global(
                    `配置 ${configName} 重载成功，版本: ${newVersion}`,
                    'success',
                    'config.reload'
                );
                
                // 发送变更事件
                this.emit('config:changed', {
                    configName,
                    config: newConfig,
                    changes,
                    timestamp: new Date().toISOString()
                });
                
                // 发送特定配置变更事件
                this.emit(`config:changed:${configName}`, {
                    config: newConfig,
                    changes,
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                this.logger.global(
                    `重载配置失败 ${configName}: ${error.message}`,
                    'error',
                    'config.reload'
                );
                this.emit('config:reloadFailed', {
                    configName,
                    error: error.message
                });
            }
        }, this.debounceDelay);
        
        this.debounceTimers.set(configName, timer);
    }
    
    /**
     * 验证配置
     * @private
     */
    _validateConfig(configName, config) {
        const errors = [];
        
        // 判断是全局配置还是账号配置
        const isGlobal = configName === 'global-config.json';
        const rules = isGlobal ? this.validationRules['global-config.json'] : this.validationRules['account'];
        
        // 检查必填字段
        if (rules.required) {
            for (const field of rules.required) {
                if (!(field in config)) {
                    errors.push(`缺少必填字段: ${field}`);
                }
            }
        }
        
        // 检查字段类型
        if (rules.types) {
            for (const [fieldPath, expectedType] of Object.entries(rules.types)) {
                const value = this._getNestedValue(config, fieldPath);
                if (value !== undefined && typeof value !== expectedType) {
                    errors.push(`字段 ${fieldPath} 类型错误，期望 ${expectedType}，实际 ${typeof value}`);
                }
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    /**
     * 获取嵌套对象值
     * @private
     */
    _getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }
    
    /**
     * 计算配置版本（简单哈希）
     * @private
     */
    _calculateVersion(config) {
        const str = JSON.stringify(config);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }
    
    /**
     * 对比配置差异
     * @private
     */
    _diffConfig(oldConfig, newConfig) {
        const changes = [];
        
        if (!oldConfig) {
            return [{ type: 'added', path: 'root', value: newConfig }];
        }
        
        const diff = (oldObj, newObj, path = '') => {
            // 检查所有新对象的键
            for (const key of Object.keys(newObj)) {
                const currentPath = path ? `${path}.${key}` : key;
                
                if (!(key in oldObj)) {
                    changes.push({
                        type: 'added',
                        path: currentPath,
                        value: newObj[key]
                    });
                } else if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
                    if (typeof newObj[key] === 'object' && newObj[key] !== null) {
                        diff(oldObj[key], newObj[key], currentPath);
                    } else {
                        changes.push({
                            type: 'modified',
                            path: currentPath,
                            oldValue: oldObj[key],
                            newValue: newObj[key]
                        });
                    }
                }
            }
            
            // 检查删除的键
            for (const key of Object.keys(oldObj)) {
                const currentPath = path ? `${path}.${key}` : key;
                if (!(key in newObj)) {
                    changes.push({
                        type: 'removed',
                        path: currentPath,
                        oldValue: oldObj[key]
                    });
                }
            }
        };
        
        diff(oldConfig, newConfig);
        return changes;
    }
    
    /**
     * 停止监听配置
     * @param {string} configName - 配置文件名
     */
    unwatchConfig(configName) {
        if (this.watchers.has(configName)) {
            const watcher = this.watchers.get(configName);
            watcher.close();
            this.watchers.delete(configName);
            
            // 清除防抖定时器
            if (this.debounceTimers.has(configName)) {
                clearTimeout(this.debounceTimers.get(configName));
                this.debounceTimers.delete(configName);
            }
            
            this.logger.global(`停止监听配置: ${configName}`, 'info', 'config.watch');
        }
    }
    
    /**
     * 停止所有监听
     */
    unwatchAll() {
        for (const [configName, watcher] of this.watchers) {
            watcher.close();
        }
        this.watchers.clear();
        
        // 清除所有防抖定时器
        for (const [configName, timer] of this.debounceTimers) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
        
        this.logger.global('已停止所有配置监听', 'info', 'config.watch');
    }
    
    /**
     * 加载配置（带缓存）
     * @param {string} configName - 配置文件名
     * @returns {Promise<Object>} 配置对象
     */
    async loadConfig(configName) {
        // 检查缓存
        if (this.configCache.has(configName)) {
            return this.configCache.get(configName);
        }
        
        const configPath = path.join(this.configsDir, configName);
        
        try {
            const content = await fsPromises.readFile(configPath, 'utf8');
            const config = JSON.parse(content);
            
            // 验证配置
            const validation = this._validateConfig(configName, config);
            if (!validation.valid) {
                throw new Error(`配置验证失败: ${validation.errors.join(', ')}`);
            }
            
            // 更新缓存
            this.configCache.set(configName, config);
            this.configVersions.set(configName, this._calculateVersion(config));
            
            return config;
        } catch (error) {
            this.logger.global(`加载配置失败 ${configName}: ${error.message}`, 'error', 'config.load');
            throw error;
        }
    }
    
    /**
     * 保存配置（带版本控制）
     * @param {string} configName - 配置文件名
     * @param {Object} config - 配置对象
     * @param {Object} options - 选项
     */
    async saveConfig(configName, config, options = {}) {
        const { backup = true, validate = true } = options;
        const configPath = path.join(this.configsDir, configName);
        
        try {
            // 验证配置
            if (validate) {
                const validation = this._validateConfig(configName, config);
                if (!validation.valid) {
                    throw new Error(`配置验证失败: ${validation.errors.join(', ')}`);
                }
            }
            
            // 创建备份
            if (backup && fs.existsSync(configPath)) {
                const backupPath = `${configPath}.backup.${Date.now()}`;
                await fsPromises.copyFile(configPath, backupPath);
                
                // 清理旧备份（保留最近5个）
                await this._cleanupBackups(configName);
            }
            
            // 先写入临时文件，再重命名（原子操作）
            const tempPath = `${configPath}.tmp`;
            await fsPromises.writeFile(tempPath, JSON.stringify(config, null, 2), 'utf8');
            await fsPromises.rename(tempPath, configPath);
            
            // 更新缓存
            this.configCache.set(configName, config);
            this.configVersions.set(configName, this._calculateVersion(config));
            
            this.logger.global(`配置保存成功: ${configName}`, 'success', 'config.save');
            
            return true;
        } catch (error) {
            this.logger.global(`保存配置失败 ${configName}: ${error.message}`, 'error', 'config.save');
            throw error;
        }
    }
    
    /**
     * 清理旧备份文件
     * @private
     */
    async _cleanupBackups(configName) {
        try {
            const files = await fsPromises.readdir(this.configsDir);
            const backupFiles = files
                .filter(f => f.startsWith(configName) && f.includes('.backup.'))
                .map(f => ({
                    name: f,
                    path: path.join(this.configsDir, f),
                    time: parseInt(f.match(/\.backup\.(\d+)$/)?.[1] || 0)
                }))
                .sort((a, b) => b.time - a.time);
            
            // 删除旧备份（保留5个）
            for (let i = 5; i < backupFiles.length; i++) {
                await fsPromises.unlink(backupFiles[i].path);
            }
        } catch (error) {
            // 忽略清理错误
        }
    }
    
    /**
     * 获取配置变更历史（基于备份文件）
     * @param {string} configName - 配置文件名
     * @returns {Promise<Array>} 历史记录
     */
    async getConfigHistory(configName) {
        try {
            const files = await fsPromises.readdir(this.configsDir);
            const backupFiles = files
                .filter(f => f.startsWith(configName) && f.includes('.backup.'))
                .map(f => ({
                    name: f,
                    path: path.join(this.configsDir, f),
                    time: parseInt(f.match(/\.backup\.(\d+)$/)?.[1] || 0)
                }))
                .sort((a, b) => b.time - a.time);
            
            return backupFiles;
        } catch (error) {
            return [];
        }
    }
    
    /**
     * 恢复配置到指定版本
     * @param {string} configName - 配置文件名
     * @param {number} timestamp - 备份时间戳
     */
    async restoreConfig(configName, timestamp) {
        const backupPath = path.join(this.configsDir, `${configName}.backup.${timestamp}`);
        
        if (!fs.existsSync(backupPath)) {
            throw new Error(`备份文件不存在: ${backupPath}`);
        }
        
        try {
            const content = await fsPromises.readFile(backupPath, 'utf8');
            const config = JSON.parse(content);
            
            // 保存为当前配置
            await this.saveConfig(configName, config, { backup: false });
            
            this.logger.global(`配置已恢复到版本: ${timestamp}`, 'success', 'config.restore');
            
            return config;
        } catch (error) {
            this.logger.global(`恢复配置失败: ${error.message}`, 'error', 'config.restore');
            throw error;
        }
    }
    
    /**
     * 设置热更新开关
     */
    setHotReload(enabled) {
        this.hotReloadEnabled = enabled;
        this.logger.global(`配置热更新已${enabled ? '启用' : '禁用'}`, 'info', 'config.hotreload');
    }
    
    /**
     * 获取监听的配置列表
     */
    getWatchedConfigs() {
        return Array.from(this.watchers.keys());
    }
    
    /**
     * 获取缓存的配置
     */
    getCachedConfig(configName) {
        return this.configCache.get(configName);
    }
    
    /**
     * 销毁管理器
     */
    destroy() {
        this.unwatchAll();
        this.removeAllListeners();
        this.configCache.clear();
        this.configVersions.clear();
    }
}

module.exports = ConfigManager;
