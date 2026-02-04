class Task {
    constructor(accountId, data) {
        this.id = data.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.accountId = accountId;
        this.name = data.name || '未命名任务';
        this.goodsId = data.goodsId || '';
        this.skuId = data.skuId || '';
        this.quantity = data.quantity || 1;
        this.time = data.time || '00:00:00.000';
        this.enabled = data.enabled !== false;
        
        // 执行状态
        this.status = data.status || 'idle'; // idle, scheduled, running, success, error
        this.lastRun = data.lastRun || null;
        this.nextRun = data.nextRun || null;
        this.result = data.result || null;
        
        // 创建时间
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
    }
    
    // 解析时间字符串
    parseTime() {
        const timeRegex = /^(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/;
        const match = this.time.match(timeRegex);
        
        if (!match) return null;
        
        const [, hour, minute, second, millisecond = '0'] = match;
        
        return {
            hour: parseInt(hour),
            minute: parseInt(minute),
            second: parseInt(second),
            millisecond: parseInt(millisecond.padEnd(3, '0')),
            totalMs: parseInt(hour) * 3600000 + 
                     parseInt(minute) * 60000 + 
                     parseInt(second) * 1000 + 
                     parseInt(millisecond.padEnd(3, '0'))
        };
    }
    
    // 验证任务数据
    validate() {
        const errors = [];
        
        if (!this.name || this.name.trim() === '') {
            errors.push('任务名称不能为空');
        }
        
        if (!this.goodsId || this.goodsId.trim() === '') {
            errors.push('商品ID不能为空');
        }
        
        if (!this.skuId || this.skuId.trim() === '') {
            errors.push('SKU ID不能为空');
        }
        
        const parsedTime = this.parseTime();
        if (!parsedTime) {
            errors.push('时间格式错误，请使用 HH:mm:ss.SSS 格式');
        } else {
            if (parsedTime.hour < 0 || parsedTime.hour > 23) errors.push('小时必须在0-23之间');
            if (parsedTime.minute < 0 || parsedTime.minute > 59) errors.push('分钟必须在0-59之间');
            if (parsedTime.second < 0 || parsedTime.second > 59) errors.push('秒必须在0-59之间');
            if (parsedTime.millisecond < 0 || parsedTime.millisecond > 999) errors.push('毫秒必须在0-999之间');
        }
        
        if (this.quantity < 1 || this.quantity > 10) {
            errors.push('购买数量必须在1-10之间');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
    
    // 更新状态
    updateStatus(status, result = null) {
        this.status = status;
        this.lastRun = new Date().toISOString();
        this.result = result;
        this.updatedAt = new Date().toISOString();
    }
    
    // 序列化为JSON
    toJSON() {
        return {
            id: this.id,
            accountId: this.accountId,
            name: this.name,
            goodsId: this.goodsId,
            skuId: this.skuId,
            quantity: this.quantity,
            time: this.time,
            enabled: this.enabled,
            status: this.status,
            lastRun: this.lastRun,
            nextRun: this.nextRun,
            result: this.result,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

module.exports = Task;