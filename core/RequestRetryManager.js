const axios = require('axios');
const { ErrorFactory, ErrorTypes } = require('../utils/errors');

/**
 * 请求重试管理器
 * 实现指数退避重试策略，提高请求成功率
 */
class RequestRetryManager {
    constructor(logger, options = {}) {
        this.logger = logger;
        
        // 默认配置
        this.config = {
            maxRetries: options.maxRetries || 3,           // 最大重试次数
            baseDelay: options.baseDelay || 100,           // 基础延迟(ms)
            maxDelay: options.maxDelay || 5000,            // 最大延迟(ms)
            jitter: options.jitter !== false,              // 是否启用抖动
            jitterRange: options.jitterRange || 100,       // 抖动范围(ms)
            timeout: options.timeout || 15000,             // 请求超时(ms)
            retryableStatuses: options.retryableStatuses || [408, 429, 500, 502, 503, 504],
            retryableErrors: options.retryableErrors || ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EPIPE']
        };
        
        // 统计信息
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            retriedRequests: 0,
            totalRetries: 0
        };
    }
    
    /**
     * 执行带重试的请求
     * @param {Object} requestConfig - axios请求配置
     * @param {Object} options - 本次请求的覆盖配置
     * @returns {Promise<Object>} 响应结果
     */
    async execute(requestConfig, options = {}) {
        const config = { ...this.config, ...options };
        const startTime = Date.now();
        let lastError = null;
        
        this.stats.totalRequests++;
        
        for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
            try {
                const response = await this._executeRequest(requestConfig, config.timeout);
                
                // 检查HTTP状态码是否需要重试
                if (this._shouldRetryByStatus(response.status, config)) {
                    if (attempt < config.maxRetries) {
                        const delay = this._calculateDelay(attempt, config);
                        this.logger.global(
                            `HTTP ${response.status} 错误，${delay}ms后第${attempt + 1}次重试`,
                            'warning',
                            'request.retry'
                        );
                        await this._sleep(delay);
                        this.stats.retriedRequests++;
                        this.stats.totalRetries++;
                        continue;
                    }
                }
                
                // 请求成功
                this.stats.successfulRequests++;
                return {
                    success: true,
                    response: response,
                    attempts: attempt + 1,
                    duration: Date.now() - startTime
                };
                
            } catch (error) {
                lastError = error;
                
                // 判断是否应该重试
                if (attempt < config.maxRetries && this._shouldRetry(error, config)) {
                    const delay = this._calculateDelay(attempt, config);
                    const errorCode = error.code || 'UNKNOWN';
                    
                    this.logger.global(
                        `请求失败(${errorCode})，${delay}ms后第${attempt + 1}次重试`,
                        'warning',
                        'request.retry'
                    );
                    
                    await this._sleep(delay);
                    this.stats.retriedRequests++;
                    this.stats.totalRetries++;
                } else {
                    // 不需要重试或已达到最大重试次数
                    break;
                }
            }
        }
        
        // 所有重试都失败了
        this.stats.failedRequests++;
        return {
            success: false,
            error: lastError,
            attempts: config.maxRetries + 1,
            duration: Date.now() - startTime,
            message: lastError ? lastError.message : '请求失败'
        };
    }
    
    /**
     * 执行单次请求
     * @private
     */
    async _executeRequest(requestConfig, timeout) {
        const config = {
            ...requestConfig,
            timeout: timeout,
            validateStatus: () => true // 让所有状态码都进入then，由我们判断
        };
        
        return await axios(config);
    }
    
    /**
     * 判断是否应该重试
     * @private
     */
    _shouldRetry(error, config) {
        // 网络错误
        if (error.code && config.retryableErrors.includes(error.code)) {
            return true;
        }
        
        // HTTP状态码错误
        if (error.response && config.retryableStatuses.includes(error.response.status)) {
            return true;
        }
        
        // 超时错误
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            return true;
        }
        
        return false;
    }
    
    /**
     * 根据HTTP状态码判断是否重试
     * @private
     */
    _shouldRetryByStatus(status, config) {
        return config.retryableStatuses.includes(status);
    }
    
    /**
     * 计算延迟时间（指数退避 + 抖动）
     * @private
     */
    _calculateDelay(attempt, config) {
        // 指数退避: baseDelay * (2 ^ attempt)
        let delay = config.baseDelay * Math.pow(2, attempt);
        
        // 限制最大延迟
        delay = Math.min(delay, config.maxDelay);
        
        // 添加抖动（避免雪崩效应）
        if (config.jitter) {
            const jitter = Math.random() * config.jitterRange;
            delay += jitter;
        }
        
        return Math.floor(delay);
    }
    
    /**
     * 睡眠函数
     * @private
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 批量执行请求（并发控制）
     * @param {Array<Object>} requestConfigs - 请求配置数组
     * @param {Object} options - 配置选项
     * @returns {Promise<Array<Object>>} 结果数组
     */
    async executeBatch(requestConfigs, options = {}) {
        const { concurrency = 5, ...retryOptions } = options;
        
        const results = [];
        const executing = [];
        
        for (let i = 0; i < requestConfigs.length; i++) {
            const promise = this.execute(requestConfigs[i], retryOptions).then(result => {
                results[i] = result;
                return result;
            });
            
            executing.push(promise);
            
            // 控制并发数
            if (executing.length >= concurrency) {
                await Promise.race(executing);
                executing.splice(executing.findIndex(p => p === promise), 1);
            }
        }
        
        await Promise.all(executing);
        return results;
    }
    
    /**
     * 获取统计信息
     */
    getStats() {
        const successRate = this.stats.totalRequests > 0 
            ? (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2)
            : 0;
            
        const retryRate = this.stats.totalRequests > 0
            ? (this.stats.retriedRequests / this.stats.totalRequests * 100).toFixed(2)
            : 0;
        
        return {
            ...this.stats,
            successRate: `${successRate}%`,
            retryRate: `${retryRate}%`,
            averageRetries: this.stats.retriedRequests > 0
                ? (this.stats.totalRetries / this.stats.retriedRequests).toFixed(2)
                : 0
        };
    }
    
    /**
     * 重置统计信息
     */
    resetStats() {
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            retriedRequests: 0,
            totalRetries: 0
        };
    }
    
    /**
     * 更新配置
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.logger.global('请求重试配置已更新', 'info', 'request.retry');
    }
    
    /**
     * 获取当前配置
     */
    getConfig() {
        return { ...this.config };
    }
}

module.exports = RequestRetryManager;
