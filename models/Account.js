const path = require('path');
const fs = require('fs');
const encryptionService = require('../utils/encryption');

class Account {
    constructor(data = {}) {
        this.id = data.id || `account_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.name = data.name || `账号${Math.floor(Math.random() * 1000)}`;
        this.description = data.description || '';
        
        // Cookie配置
        this.cookie = data.cookie || '';
        this.pdduid = data.pdduid || '';
        this.userAgent = data.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        this.antiContent = data.antiContent || '';
        this.defaultAddressId = data.defaultAddressId || '';
        this.defaultGroupId = data.defaultGroupId || '153122715481';
        this.defaultActivityId = data.defaultActivityId || '15082569568';
        
        // 请求设置
        this.requestSettings = data.requestSettings || {
            requestCount: 10,
            requestInterval: 500,
            maxRequestTime: 5000,
            timeout: 15000
        };
        
        // 任务列表
        this.tasks = data.tasks || [];
        
        // 状态信息
        this.enabled = data.enabled !== false;
        this.lastActive = data.lastActive || null;
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
        
        // 统计信息
        this.statistics = data.statistics || {
            successCount: 0,
            failCount: 0,
            totalRequests: 0,
            lastRunTime: null
        };
        
        // 解密敏感字段（仅在从存储加载时）
        // 新创建的账号数据是明文的，不需要解密
        if (data._fromStorage) {
            const decrypted = encryptionService.decryptAccountData({
                cookie: this.cookie,
                antiContent: this.antiContent,
                pdduid: this.pdduid,
                defaultAddressId: this.defaultAddressId,
                defaultGroupId: this.defaultGroupId,
                defaultActivityId: this.defaultActivityId
            });
            
            this.cookie = decrypted.cookie;
            this.antiContent = decrypted.antiContent;
            this.pdduid = decrypted.pdduid;
            this.defaultAddressId = decrypted.defaultAddressId;
            this.defaultGroupId = decrypted.defaultGroupId;
            this.defaultActivityId = decrypted.defaultActivityId;
        }
    }
    
    // 从Cookie提取pdduid
    extractPdduid() {
        if (!this.cookie) return '';
        
        try {
            // 尝试从cookie中提取pdduid
            const pdduidMatch = this.cookie.match(/pdd_user_id=([^;]+)/) || 
                               this.cookie.match(/pdduid=([^;]+)/) ||
                               this.cookie.match(/USER_ID=([^;]+)/);
            
            if (pdduidMatch && pdduidMatch[1]) {
                this.pdduid = pdduidMatch[1];
                return this.pdduid;
            }
        } catch (error) {
            console.error('提取pdduid失败:', error);
        }
        
        return '';
    }
    
    // 验证账号配置
    validate() {
        const errors = [];

        // Cookie 可以为空（新创建的账号），但在执行抢购任务前需要配置
        // 如果提供了 Cookie，验证是否能提取用户ID
        if (this.cookie && this.cookie.trim()) {
            if (!this.pdduid) {
                const extracted = this.extractPdduid();
                if (!extracted) {
                    errors.push('无法从Cookie中提取用户ID');
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
    
    // 更新统计信息
    updateStatistics(success = false) {
        if (success) {
            this.statistics.successCount++;
        } else {
            this.statistics.failCount++;
        }
        this.statistics.totalRequests++;
        this.statistics.lastRunTime = new Date().toISOString();
        this.updatedAt = new Date().toISOString();
    }
    
    // 添加任务
    addTask(task) {
        const taskObj = {
            id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            accountId: this.id,
            name: task.name,
            goodsId: task.goodsId,
            skuId: task.skuId,
            quantity: task.quantity || 1,
            time: task.time,
            enabled: task.enabled !== false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.tasks.push(taskObj);
        return taskObj;
    }
    
    // 更新任务
    updateTask(taskId, updates) {
        const taskIndex = this.tasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) return null;
        
        this.tasks[taskIndex] = {
            ...this.tasks[taskIndex],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        
        return this.tasks[taskIndex];
    }
    
    // 删除任务
    deleteTask(taskId) {
        const taskIndex = this.tasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) return false;
        
        const deletedTask = this.tasks[taskIndex];
        this.tasks.splice(taskIndex, 1);
        return deletedTask;
    }
    
    // 获取任务
    getTask(taskId) {
        return this.tasks.find(t => t.id === taskId);
    }
    
    // 获取所有启用的任务
    getEnabledTasks() {
        return this.tasks.filter(t => t.enabled !== false);
    }
    
    // 序列化为JSON
    toJSON() {
        const accountData = {
            id: this.id,
            name: this.name,
            description: this.description,
            cookie: this.cookie,
            pdduid: this.pdduid,
            userAgent: this.userAgent,
            antiContent: this.antiContent,
            defaultAddressId: this.defaultAddressId,
            defaultGroupId: this.defaultGroupId,
            defaultActivityId: this.defaultActivityId,
            requestSettings: this.requestSettings,
            tasks: this.tasks,
            enabled: this.enabled,
            statistics: this.statistics,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
        
        // 加密敏感字段
        return encryptionService.encryptAccountData(accountData);
    }
}

module.exports = Account;