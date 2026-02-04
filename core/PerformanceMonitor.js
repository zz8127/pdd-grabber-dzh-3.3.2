const EventEmitter = require('events');
const os = require('os');

/**
 * 性能监控器
 * 实时监控系统运行状态和性能指标
 */
class PerformanceMonitor extends EventEmitter {
    constructor(logger, options = {}) {
        super();
        
        this.logger = logger;
        
        // 配置
        this.config = {
            collectionInterval: options.collectionInterval || 5000,  // 数据采集间隔(ms)
            maxDataPoints: options.maxDataPoints || 288,             // 最大数据点数量(24小时，每5分钟一个点)
            alertThresholds: {
                memoryUsage: options.memoryThreshold || 80,          // 内存使用率告警阈值(%)
                cpuUsage: options.cpuThreshold || 80,                // CPU使用率告警阈值(%)
                latency: options.latencyThreshold || 500,            // 延迟告警阈值(ms)
                successRate: options.successRateThreshold || 90      // 成功率告警阈值(%)
            }
        };
        
        // 性能数据存储
        this.metrics = {
            memory: [],           // 内存使用历史
            cpu: [],              // CPU使用历史
            latency: [],          // 请求延迟历史
            successRate: [],      // 成功率历史
            requests: {           // 请求统计
                total: 0,
                success: 0,
                failed: 0,
                retried: 0
            }
        };
        
        // 当前状态
        this.currentStatus = {
            memoryUsage: 0,
            cpuUsage: 0,
            rss: 0,
            heapUsed: 0,
            heapTotal: 0,
            external: 0,
            lastUpdate: null
        };
        
        // 采集定时器
        this.collectionTimer = null;
        
        // 是否正在采集
        this.isCollecting = false;
        
        // 告警状态
        this.alertStatus = {
            memory: false,
            cpu: false,
            latency: false,
            successRate: false
        };
    }
    
    /**
     * 开始性能监控
     */
    start() {
        if (this.isCollecting) {
            this.logger.global('性能监控已在运行中', 'warning', 'performance');
            return;
        }
        
        this.isCollecting = true;
        
        // 立即采集一次
        this.collectMetrics();
        
        // 启动定时采集
        this.collectionTimer = setInterval(() => {
            this.collectMetrics();
        }, this.config.collectionInterval);
        
        this.logger.global('性能监控已启动', 'success', 'performance');
        this.emit('monitoring:started');
    }
    
    /**
     * 停止性能监控
     */
    stop() {
        if (this.collectionTimer) {
            clearInterval(this.collectionTimer);
            this.collectionTimer = null;
        }
        
        this.isCollecting = false;
        this.logger.global('性能监控已停止', 'info', 'performance');
        this.emit('monitoring:stopped');
    }
    
    /**
     * 采集性能指标
     */
    collectMetrics() {
        try {
            const timestamp = new Date().toISOString();
            
            // 采集内存使用
            const memoryUsage = this._collectMemoryMetrics(timestamp);
            
            // 采集CPU使用
            const cpuUsage = this._collectCPUMetrics(timestamp);
            
            // 更新当前状态
            this.currentStatus = {
                memoryUsage: memoryUsage.percentage,
                cpuUsage: cpuUsage.percentage,
                rss: memoryUsage.rss,
                heapUsed: memoryUsage.heapUsed,
                heapTotal: memoryUsage.heapTotal,
                external: memoryUsage.external,
                lastUpdate: timestamp
            };
            
            // 检查告警阈值
            this._checkAlertThresholds();
            
            // 发送采集事件
            this.emit('metrics:collected', {
                timestamp,
                memory: memoryUsage,
                cpu: cpuUsage
            });
            
        } catch (error) {
            this.logger.global(`性能数据采集失败: ${error.message}`, 'error', 'performance');
        }
    }
    
    /**
     * 采集内存指标
     * @private
     */
    _collectMemoryMetrics(timestamp) {
        const usage = process.memoryUsage();
        const systemTotal = os.totalmem();
        const systemFree = os.freemem();
        
        const metrics = {
            timestamp,
            rss: Math.round(usage.rss / 1024 / 1024),           // RSS内存(MB)
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // 堆内存总量(MB)
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024),  // 堆内存使用(MB)
            external: Math.round(usage.external / 1024 / 1024),  // 外部内存(MB)
            systemTotal: Math.round(systemTotal / 1024 / 1024),  // 系统总内存(MB)
            systemFree: Math.round(systemFree / 1024 / 1024),    // 系统空闲内存(MB)
            percentage: Math.round((usage.rss / systemTotal) * 100) // 内存使用率(%)
        };
        
        // 添加到历史数据
        this.metrics.memory.push(metrics);
        this._trimData(this.metrics.memory);
        
        return metrics;
    }
    
    /**
     * 采集CPU指标
     * @private
     */
    _collectCPUMetrics(timestamp) {
        const cpus = os.cpus();
        let totalIdle = 0;
        let totalTick = 0;
        
        cpus.forEach(cpu => {
            for (const type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        });
        
        const percentage = Math.round(100 - (100 * totalIdle / totalTick));
        
        const metrics = {
            timestamp,
            percentage: Math.min(percentage, 100),
            count: cpus.length,
            model: cpus[0]?.model || 'Unknown'
        };
        
        // 添加到历史数据
        this.metrics.cpu.push(metrics);
        this._trimData(this.metrics.cpu);
        
        return metrics;
    }
    
    /**
     * 记录请求延迟
     */
    recordLatency(latency, success = true) {
        const metrics = {
            timestamp: new Date().toISOString(),
            latency: Math.round(latency),
            success
        };
        
        this.metrics.latency.push(metrics);
        this._trimData(this.metrics.latency);
        
        // 更新请求统计
        this.metrics.requests.total++;
        if (success) {
            this.metrics.requests.success++;
        } else {
            this.metrics.requests.failed++;
        }
        
        // 计算当前成功率
        this._updateSuccessRate();
        
        this.emit('latency:recorded', metrics);
    }
    
    /**
     * 记录重试
     */
    recordRetry() {
        this.metrics.requests.retried++;
        this.emit('retry:recorded');
    }
    
    /**
     * 更新成功率
     * @private
     */
    _updateSuccessRate() {
        const { total, success } = this.metrics.requests;
        if (total === 0) return;
        
        const rate = Math.round((success / total) * 100);
        
        this.metrics.successRate.push({
            timestamp: new Date().toISOString(),
            rate
        });
        
        this._trimData(this.metrics.successRate);
    }
    
    /**
     * 检查告警阈值
     * @private
     */
    _checkAlertThresholds() {
        const { alertThresholds } = this.config;
        const { memoryUsage, cpuUsage } = this.currentStatus;
        
        // 检查内存告警
        if (memoryUsage > alertThresholds.memoryUsage) {
            if (!this.alertStatus.memory) {
                this.alertStatus.memory = true;
                this._triggerAlert('memory', `内存使用率超过阈值: ${memoryUsage}% > ${alertThresholds.memoryUsage}%`);
            }
        } else if (this.alertStatus.memory) {
            this.alertStatus.memory = false;
            this._resolveAlert('memory', '内存使用率恢复正常');
        }
        
        // 检查CPU告警
        if (cpuUsage > alertThresholds.cpuUsage) {
            if (!this.alertStatus.cpu) {
                this.alertStatus.cpu = true;
                this._triggerAlert('cpu', `CPU使用率超过阈值: ${cpuUsage}% > ${alertThresholds.cpuUsage}%`);
            }
        } else if (this.alertStatus.cpu) {
            this.alertStatus.cpu = false;
            this._resolveAlert('cpu', 'CPU使用率恢复正常');
        }
    }
    
    /**
     * 触发告警
     * @private
     */
    _triggerAlert(type, message) {
        this.logger.global(`[告警] ${message}`, 'warning', `performance.alert.${type}`);
        this.emit('alert:triggered', { type, message, timestamp: new Date().toISOString() });
    }
    
    /**
     * 解除告警
     * @private
     */
    _resolveAlert(type, message) {
        this.logger.global(`[告警解除] ${message}`, 'success', `performance.alert.${type}`);
        this.emit('alert:resolved', { type, message, timestamp: new Date().toISOString() });
    }
    
    /**
     * 修剪数据数组，保持最大长度
     * @private
     */
    _trimData(dataArray) {
        if (dataArray.length > this.config.maxDataPoints) {
            dataArray.splice(0, dataArray.length - this.config.maxDataPoints);
        }
    }
    
    /**
     * 获取性能统计
     */
    getStats() {
        const { memory, cpu, latency, requests } = this.metrics;
        
        return {
            current: this.currentStatus,
            memory: {
                current: memory.length > 0 ? memory[memory.length - 1] : null,
                average: this._calculateAverage(memory, 'percentage'),
                peak: this._calculatePeak(memory, 'percentage'),
                min: this._calculateMin(memory, 'percentage')
            },
            cpu: {
                current: cpu.length > 0 ? cpu[cpu.length - 1] : null,
                average: this._calculateAverage(cpu, 'percentage'),
                peak: this._calculatePeak(cpu, 'percentage'),
                min: this._calculateMin(cpu, 'percentage')
            },
            latency: {
                average: this._calculateAverage(latency, 'latency'),
                p95: this._calculatePercentile(latency, 'latency', 95),
                p99: this._calculatePercentile(latency, 'latency', 99),
                max: this._calculatePeak(latency, 'latency'),
                min: this._calculateMin(latency, 'latency')
            },
            requests: { ...requests },
            successRate: requests.total > 0 ? Math.round((requests.success / requests.total) * 100) : 0,
            alertStatus: { ...this.alertStatus }
        };
    }
    
    /**
     * 获取历史数据
     */
    getHistory(metricType, duration = '1h') {
        const durationMap = {
            '1h': 60 * 60 * 1000,
            '6h': 6 * 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000
        };
        
        const cutoff = Date.now() - (durationMap[duration] || durationMap['1h']);
        const data = this.metrics[metricType] || [];
        
        return data.filter(item => new Date(item.timestamp).getTime() > cutoff);
    }
    
    /**
     * 计算平均值
     * @private
     */
    _calculateAverage(data, field) {
        if (data.length === 0) return 0;
        const sum = data.reduce((acc, item) => acc + (item[field] || 0), 0);
        return Math.round(sum / data.length);
    }
    
    /**
     * 计算峰值
     * @private
     */
    _calculatePeak(data, field) {
        if (data.length === 0) return 0;
        return Math.max(...data.map(item => item[field] || 0));
    }
    
    /**
     * 计算最小值
     * @private
     */
    _calculateMin(data, field) {
        if (data.length === 0) return 0;
        return Math.min(...data.map(item => item[field] || 0));
    }
    
    /**
     * 计算百分位数
     * @private
     */
    _calculatePercentile(data, field, percentile) {
        if (data.length === 0) return 0;
        
        const sorted = data
            .map(item => item[field] || 0)
            .sort((a, b) => a - b);
        
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[Math.max(0, index)];
    }
    
    /**
     * 更新告警阈值
     */
    updateAlertThresholds(thresholds) {
        this.config.alertThresholds = {
            ...this.config.alertThresholds,
            ...thresholds
        };
        
        this.logger.global('告警阈值已更新', 'info', 'performance');
        this.emit('thresholds:updated', this.config.alertThresholds);
    }
    
    /**
     * 重置统计数据
     */
    reset() {
        this.metrics = {
            memory: [],
            cpu: [],
            latency: [],
            successRate: [],
            requests: {
                total: 0,
                success: 0,
                failed: 0,
                retried: 0
            }
        };
        
        this.alertStatus = {
            memory: false,
            cpu: false,
            latency: false,
            successRate: false
        };
        
        this.logger.global('性能统计数据已重置', 'info', 'performance');
        this.emit('metrics:reset');
    }
    
    /**
     * 生成性能报告
     */
    generateReport(duration = '24h') {
        const stats = this.getStats();
        const history = {
            memory: this.getHistory('memory', duration),
            cpu: this.getHistory('cpu', duration),
            latency: this.getHistory('latency', duration)
        };
        
        const report = {
            generatedAt: new Date().toISOString(),
            duration,
            summary: stats,
            history,
            recommendations: this._generateRecommendations(stats)
        };
        
        return report;
    }
    
    /**
     * 生成优化建议
     * @private
     */
    _generateRecommendations(stats) {
        const recommendations = [];
        
        if (stats.memory.average > 70) {
            recommendations.push({
                type: 'memory',
                level: 'warning',
                message: '内存使用率较高，建议优化内存使用或增加系统内存'
            });
        }
        
        if (stats.cpu.average > 70) {
            recommendations.push({
                type: 'cpu',
                level: 'warning',
                message: 'CPU使用率较高，建议优化任务调度或减少并发数'
            });
        }
        
        if (stats.latency.p95 > 500) {
            recommendations.push({
                type: 'latency',
                level: 'warning',
                message: '请求延迟较高，建议检查网络连接或优化请求策略'
            });
        }
        
        if (stats.successRate < 90) {
            recommendations.push({
                type: 'successRate',
                level: 'critical',
                message: '请求成功率较低，建议检查账号状态或调整请求参数'
            });
        }
        
        return recommendations;
    }
    
    /**
     * 销毁监控器
     */
    destroy() {
        this.stop();
        this.removeAllListeners();
    }
}

module.exports = PerformanceMonitor;
