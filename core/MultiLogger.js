const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');

class MultiLogger {
    constructor(baseDir) {
        this.baseDir = baseDir || process.cwd();
        this.logsDir = path.join(this.baseDir, 'logs');
        
        // 确保日志目录存在
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
        
        // 全局日志文件
        this.globalLogFile = path.join(this.logsDir, 'global.log');
        
        // 简化内存缓存
        this.globalLogCache = [];
        this.maxCacheSize = 500; // 减少缓存大小
    }
    
    // 记录全局日志
    global(message, type = 'info', source = 'system', accountName = null) {
        const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss.SSS');
        const logEntry = {
            timestamp,
            type,
            source,
            message,
            accountName
        };
        
        // 控制台输出
        // Windows控制台对ANSI颜色代码支持有限，且与UTF-8编码可能冲突
        const useColors = process.platform !== 'win32';
        const colors = {
            info: useColors ? '\x1b[36m%s\x1b[0m' : '%s',     // 青色或无色
            success: useColors ? '\x1b[32m%s\x1b[0m' : '%s',   // 绿色或无色
            error: useColors ? '\x1b[31m%s\x1b[0m' : '%s',     // 红色或无色
            warning: useColors ? '\x1b[33m%s\x1b[0m' : '%s',   // 黄色或无色
            debug: useColors ? '\x1b[90m%s\x1b[0m' : '%s'      // 灰色或无色
        };
        
        const accountPrefix = accountName ? `[${accountName}] ` : '';
        const logLine = `[${timestamp}] ${accountPrefix}[${type.toUpperCase()}] [${source}] ${message}`;
        
        // 根据日志级别决定是否输出到控制台
        if (type !== 'debug' || process.env.NODE_ENV === 'development') {
            if (process.platform === 'win32' && process.stdout && process.stdout.write) {
                // Windows上使用Buffer确保UTF-8编码
                try {
                    const output = logLine + '\n';
                    process.stdout.write(Buffer.from(output, 'utf8'));
                } catch (err) {
                    console.log(colors[type] || colors.info, logLine);
                }
            } else {
                console.log(colors[type] || colors.info, logLine);
            }
        }
        
        // 写入全局日志文件
        this.writeToGlobalFile(logEntry);
        
        // 发送到主窗口
        this.sendToRenderer('global', logEntry);
        
        return logEntry;
    }

    account(accountId, message, type = 'info', source = 'account', accountName = null) {
        // 获取账号名称
        let name = accountName;
        if (!name && global.accountManager) {
            const account = global.accountManager.getAccount(accountId);
            if (account) {
                name = account.name;
            }
        }
        
        // 调用全局日志方法
        return this.global(message, type, source, name);
    }
    
    // 简化写入文件方法
    writeToGlobalFile(logEntry) {
        const accountPrefix = logEntry.accountName ? `[${logEntry.accountName}] ` : '';
        
        // 简化日志格式，去除冗余信息
        // 格式: 时间戳 [账号] [类型] [来源] 消息
        const logLine = `${logEntry.timestamp} ${accountPrefix}[${logEntry.type.toUpperCase()}] [${logEntry.source}] ${logEntry.message}\n`;
        
        try {
            fs.appendFileSync(this.globalLogFile, logLine, 'utf8');
            
            // 限制日志文件大小（最多5000行）
            this.rotateLogFileIfNeeded();
        } catch (error) {
            console.error('写入全局日志文件失败:', error);
        }
    }
    
    // 日志文件轮换
    rotateLogFileIfNeeded() {
        try {
            const stats = fs.statSync(this.globalLogFile);
            const maxSize = 10 * 1024 * 1024; // 10MB
            
            if (stats.size > maxSize) {
                // 创建备份文件
                const backupFile = path.join(this.logsDir, `global.${dayjs().format('YYYYMMDD_HHmmss')}.log`);
                fs.copyFileSync(this.globalLogFile, backupFile);
                
                // 清空当前日志文件
                fs.writeFileSync(this.globalLogFile, '', 'utf8');
                
                // 记录轮换信息
                const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss.SSS');
                const logLine = `${timestamp} [INFO] [system] 日志文件轮换完成，创建备份: ${backupFile}\n`;
                fs.appendFileSync(this.globalLogFile, logLine, 'utf8');
            }
        } catch (error) {
            // 忽略文件大小检查错误
        }
    }
    
    // 获取全局日志
    getGlobalLogs(limit = 100) {
        try {
            if (fs.existsSync(this.globalLogFile)) {
                // 读取整个文件
                const content = fs.readFileSync(this.globalLogFile, 'utf8');
                const lines = content.trim().split('\n').filter(line => line.trim());
                
                // 解析日志行
                const logs = [];
                
                // 从最新到最旧解析（文件末尾是最新日志）
                for (let i = lines.length - 1; i >= 0; i--) {
                    const line = lines[i];
                    try {
                        // 格式: 时间戳 [账号名] [类型] [来源] 消息
                        // 例如: 2023-01-01 12:00:00.000 [我的账号] [SUCCESS] [task] 订单创建成功: 123456789
                        
                        // 使用正则表达式解析日志行
                        const regex = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})(?: \[([^\]]+)\])? \[(\w+)\] \[([^\]]+)\] (.+)$/;
                        const match = line.match(regex);
                        
                        if (match) {
                            const [, timestamp, accountName, type, source, message] = match;
                            logs.unshift({
                                timestamp,
                                accountName: accountName || null,
                                type: type.toLowerCase(),
                                source,
                                message
                            });
                        } else {
                            // 尝试简化解析
                            const simpleRegex = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}) (.+)$/;
                            const simpleMatch = line.match(simpleRegex);
                            if (simpleMatch) {
                                logs.unshift({
                                    timestamp: simpleMatch[1],
                                    accountName: null,
                                    type: 'info',
                                    source: 'system',
                                    message: simpleMatch[2]
                                });
                            }
                        }
                    } catch (e) {
                        // 跳过无法解析的行
                        console.warn('无法解析日志行:', line.substring(0, 100));
                    }
                    
                    // 限制返回数量
                    if (logs.length >= limit) {
                        break;
                    }
                }
                
                // 反转顺序，使最新的在最上面
                return logs;
            }
        } catch (error) {
            console.error('读取全局日志失败:', error);
        }
        
        return [];
    }
    
    // 清空全局日志
    clearGlobalLogs() {
        try {
            // 清空文件
            if (fs.existsSync(this.globalLogFile)) {
                fs.writeFileSync(this.globalLogFile, '', 'utf8');
            }
            
            // 清空缓存
            this.globalLogCache = [];
            
            // 记录清空操作
            this.global('全局日志已清空', 'info', 'system');
            
            return true;
        } catch (error) {
            console.error('清空全局日志失败:', error);
            return false;
        }
    }
    
    // 发送日志到渲染进程
    sendToRenderer(channel, logEntry) {
        if (global.sendToRenderer) {
            global.sendToRenderer(channel, logEntry);
        }
    }
    
    // 设置发送函数
    setRendererSender(sendFunction) {
        this.sendToRenderer = sendFunction;
    }
}

module.exports = MultiLogger;