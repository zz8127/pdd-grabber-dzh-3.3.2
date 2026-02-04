const dayjs = require('dayjs');
const TaskExecutor = require('./TaskExecutor');

class MultiTaskScheduler {
    constructor(accountManager, logger) {
        this.accountManager = accountManager;
        this.logger = logger;
        
        // 存储定时任务
        this.scheduledTasks = new Map(); // taskId -> timeout
        this.taskExecutors = new Map(); // accountId -> TaskExecutor实例
        
        // 任务状态
        this.runningTasks = new Set();
        
        // 检查间隔
        this.checkInterval = null;
        this.startIntervalCheck();
    }
    
    // 开始间隔检查
    startIntervalCheck() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
        
        // 每100毫秒检查一次任务执行时间
        this.checkInterval = setInterval(() => {
            this.checkScheduledTasks();
        }, 100);
    }
    
    // 安排任务
    scheduleTask(task) {
        const account = this.accountManager.getAccount(task.accountId);
        if (!account) {
            this.logger.account(task.accountId, `账号不存在，无法安排任务: ${task.name}`, 'error', 'task');
            return null;
        }
        
        // 解析任务时间
        const parsedTime = this.parseTaskTime(task.time);
        if (!parsedTime) {
            this.logger.account(task.accountId, `任务时间格式错误: ${task.time}`, 'error', 'task');
            return null;
        }
        
        // 计算下一次执行时间
        const nextExec = this.calculateNextExecution(parsedTime);
        if (!nextExec) {
            this.logger.account(task.accountId, `无法计算任务执行时间: ${task.time}`, 'error', 'task');
            return null;
        }
        
        // 如果已经有定时器，先清除
        if (this.scheduledTasks.has(task.id)) {
            clearTimeout(this.scheduledTasks.get(task.id));
        }
        
        // 设置定时器
        const timer = setTimeout(async () => {
            await this.executeTask(task);
            // 执行完成后重新安排（如果是重复任务，但这里我们假设是每天一次）
            // 注意：这里为了简单，只执行一次。如果需要重复，可以重新调用scheduleTask
        }, nextExec.delayMs);
        
        // 存储定时器和任务对象
        this.scheduledTasks.set(task.id, { timer, task });
        
        // 更新任务的下次执行时间
        task.nextRun = new Date(Date.now() + nextExec.delayMs).toISOString();
        
        this.logger.account(task.accountId, `任务安排成功: ${task.name}，将在 ${task.nextRun} 执行 (${Math.round(nextExec.delayMs/1000)}秒后)`, 'success', 'task');
        
        return timer;
    }
    
    // 立即执行任务（用于手动触发）
    async executeTaskNow(task) {
        return await this.executeTask(task, true);
    }
    
    // 执行任务
    async executeTask(task, isManual = false) {
        const account = this.accountManager.getAccount(task.accountId);
        if (!account) {
            this.logger.account(task.accountId, `账号不存在，无法执行任务: ${task.name}`, 'error', 'task');
            return;
        }
        
        // 如果任务正在运行，则跳过
        if (this.runningTasks.has(task.id)) {
            this.logger.account(task.accountId, `任务正在运行中: ${task.name}`, 'warning', 'task');
            return;
        }
        
        // 标记为运行中
        this.runningTasks.add(task.id);
        
        try {
            this.logger.account(task.accountId, `开始执行任务: ${task.name}`, 'info', 'task');
            
            // 获取任务执行器
            let executor = this.taskExecutors.get(task.accountId);
            if (!executor) {
                executor = new TaskExecutor(account, this.accountManager, this.logger);
                this.taskExecutors.set(task.accountId, executor);
            }
            
            // 执行任务，手动触发的任务使用立即执行模式
            const result = await executor.execute(task, isManual);
            
            // 更新任务状态
            task.lastRun = new Date().toISOString();
            task.result = result;
            
            // 更新账号统计
            account.updateStatistics(result.success);
            
            // 保存账号配置
            this.accountManager.saveAccount(account.id);
            
            if (result.success) {
                this.logger.account(task.accountId, `任务执行成功: ${task.name}`, 'success', 'task');
            } else {
                this.logger.account(task.accountId, `任务执行失败: ${task.name} - ${result.message}`, 'error', 'task');
            }
            
            return result;
        } catch (error) {
            this.logger.account(task.accountId, `任务执行异常: ${task.name} - ${error.message}`, 'error', 'task');
            return {
                success: false,
                message: error.message
            };
        } finally {
            // 移除运行标记
            this.runningTasks.delete(task.id);
        }
    }
    
    // 停止任务
    stopTask(taskId) {
        if (this.scheduledTasks.has(taskId)) {
            clearTimeout(this.scheduledTasks.get(taskId).timer);
            this.scheduledTasks.delete(taskId);
            return true;
        }
        return false;
    }
    
    // 停止账号的所有任务
    stopAccountTasks(accountId) {
        let count = 0;
        const tasksToRemove = [];
        
        // 先找出所有属于该账号的任务
        for (const [taskId, { timer, task }] of this.scheduledTasks) {
            if (task.accountId === accountId) {
                tasksToRemove.push({ taskId, timer });
            }
        }
        
        // 然后清除这些任务的定时器并从映射中移除
        for (const { taskId, timer } of tasksToRemove) {
            clearTimeout(timer);
            this.scheduledTasks.delete(taskId);
            count++;
        }
        
        return count;
    }
    
    // 解析任务时间
    parseTaskTime(timeStr) {
        if (!timeStr) return null;
        
        let timeParts = timeStr.split(':');
        if (timeParts.length < 2) return null;
        
        let hour = parseInt(timeParts[0]) || 0;
        let minute = parseInt(timeParts[1]) || 0;
        let second = 0;
        let millisecond = 0;
        
        if (timeParts.length > 2) {
            let secParts = timeParts[2].split('.');
            second = parseInt(secParts[0]) || 0;
            millisecond = parseInt(secParts[1]) || 0;
        }
        
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || 
            second < 0 || second > 59 || millisecond < 0 || millisecond > 999) {
            return null;
        }
        
        return {
            hour,
            minute,
            second,
            millisecond,
            totalMs: hour * 3600000 + minute * 60000 + second * 1000 + millisecond
        };
    }
    
    // 计算下一次执行时间
    calculateNextExecution(parsedTime) {
        if (!parsedTime) return null;
        
        const now = new Date();
        const nowMs = now.getHours() * 3600000 + 
                     now.getMinutes() * 60000 + 
                     now.getSeconds() * 1000 + 
                     now.getMilliseconds();
        
        let delayMs = parsedTime.totalMs - nowMs;
        
        if (delayMs <= 0) {
            delayMs += 24 * 3600000; // 第二天
        }
        
        return {
            executionTime: new Date(now.getTime() + delayMs),
            delayMs
        };
    }
    
    // 检查定时任务
    checkScheduledTasks() {
        // 这里可以添加更精确的时间检查，但我们已经使用了setTimeout，所以这里主要做监控
    }
    
    // 获取所有定时任务
    getScheduledTasks() {
        return Array.from(this.scheduledTasks.entries()).map(([taskId, timer]) => ({
            taskId,
            // 这里可以返回更多信息，比如任务对象
        }));
    }
    
    // 销毁
    destroy() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
        
        // 清除所有定时器
        for (const [taskId, { timer }] of this.scheduledTasks) {
            clearTimeout(timer);
        }
        this.scheduledTasks.clear();
    }
}

module.exports = MultiTaskScheduler;
