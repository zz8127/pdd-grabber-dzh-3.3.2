/**
 * 统一错误处理模块
 */

/**
 * 错误类型枚举
 */
const ErrorTypes = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',      // 数据验证错误
    CONFIG_ERROR: 'CONFIG_ERROR',              // 配置错误
    NETWORK_ERROR: 'NETWORK_ERROR',            // 网络错误
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR', // 认证错误
    BUSINESS_ERROR: 'BUSINESS_ERROR',          // 业务逻辑错误
    SYSTEM_ERROR: 'SYSTEM_ERROR',              // 系统错误
    IO_ERROR: 'IO_ERROR',                      // 文件IO错误
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'             // 未知错误
};

/**
 * 错误严重级别
 */
const ErrorSeverity = {
    LOW: 'LOW',        // 低 - 可忽略或自动恢复
    MEDIUM: 'MEDIUM',  // 中 - 需要用户注意
    HIGH: 'HIGH',      // 高 - 功能受限
    CRITICAL: 'CRITICAL' // 致命 - 应用无法继续
};

/**
 * 自定义错误类
 */
class AppError extends Error {
    constructor(type, message, details = {}, severity = ErrorSeverity.MEDIUM) {
        super(message);
        this.name = 'AppError';
        this.type = type;
        this.details = details;
        this.severity = severity;
        this.timestamp = new Date().toISOString();
        
        // 保持正确的堆栈追踪
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AppError);
        }
    }

    /**
     * 转换为JSON格式
     */
    toJSON() {
        return {
            name: this.name,
            type: this.type,
            message: this.message,
            details: this.details,
            severity: this.severity,
            timestamp: this.timestamp,
            stack: this.stack
        };
    }

    /**
     * 转换为日志字符串
     */
    toLogString() {
        return `[${this.type}] ${this.message} (Severity: ${this.severity})`;
    }
}

/**
 * 错误工厂函数
 */
const ErrorFactory = {
    /**
     * 验证错误
     */
    validationError(message, errors = [], field = null) {
        return new AppError(
            ErrorTypes.VALIDATION_ERROR,
            message,
            { errors, field },
            ErrorSeverity.MEDIUM
        );
    },

    /**
     * 配置错误
     */
    configError(message, configPath = null, configKey = null) {
        return new AppError(
            ErrorTypes.CONFIG_ERROR,
            message,
            { configPath, configKey },
            ErrorSeverity.HIGH
        );
    },

    /**
     * 网络错误
     */
    networkError(message, url = null, statusCode = null) {
        return new AppError(
            ErrorTypes.NETWORK_ERROR,
            message,
            { url, statusCode },
            ErrorSeverity.MEDIUM
        );
    },

    /**
     * 认证错误
     */
    authenticationError(message, accountId = null, authType = null) {
        return new AppError(
            ErrorTypes.AUTHENTICATION_ERROR,
            message,
            { accountId, authType },
            ErrorSeverity.HIGH
        );
    },

    /**
     * 业务错误（如拼多多API返回的错误）
     */
    businessError(message, errorCode = null, apiResponse = null) {
        return new AppError(
            ErrorTypes.BUSINESS_ERROR,
            message,
            { errorCode, apiResponse },
            ErrorSeverity.MEDIUM
        );
    },

    /**
     * 系统错误
     */
    systemError(message, module = null, operation = null) {
        return new AppError(
            ErrorTypes.SYSTEM_ERROR,
            message,
            { module, operation },
            ErrorSeverity.CRITICAL
        );
    },

    /**
     * IO错误
     */
    ioError(message, filePath = null, operation = null) {
        return new AppError(
            ErrorTypes.IO_ERROR,
            message,
            { filePath, operation },
            ErrorSeverity.HIGH
        );
    },

    /**
     * 从普通Error对象创建AppError
     */
    fromError(error, type = ErrorTypes.UNKNOWN_ERROR, details = {}) {
        if (error instanceof AppError) {
            return error;
        }
        
        return new AppError(
            type,
            error.message,
            { ...details, originalError: error.toString() },
            ErrorSeverity.MEDIUM
        );
    }
};

/**
 * 错误处理器
 */
class ErrorHandler {
    constructor(logger) {
        this.logger = logger;
    }

    /**
     * 处理错误
     */
    handle(error, context = {}) {
        const appError = error instanceof AppError ? error : ErrorFactory.fromError(error);
        
        // 添加上下文信息
        appError.details = {
            ...appError.details,
            ...context,
            handledAt: new Date().toISOString()
        };

        // 根据错误严重级别决定处理方式
        switch (appError.severity) {
            case ErrorSeverity.LOW:
                this.logger.global(appError.toLogString(), 'debug', 'error', context.accountName);
                break;
                
            case ErrorSeverity.MEDIUM:
                this.logger.global(appError.toLogString(), 'warning', 'error', context.accountName);
                break;
                
            case ErrorSeverity.HIGH:
                this.logger.global(appError.toLogString(), 'error', 'error', context.accountName);
                // TODO: 可以考虑发送桌面通知
                break;
                
            case ErrorSeverity.CRITICAL:
                this.logger.global(appError.toLogString(), 'error', 'error.critical', context.accountName);
                // TODO: 应该记录到专门的错误文件并可能触发应用重启
                console.error('CRITICAL ERROR:', appError.toJSON());
                break;
        }

        // 返回处理后的错误，便于进一步处理
        return appError;
       }

 /**
     * 尝试执行操作，自动处理错误
     */
    async tryExecute(operation, operationName, context = {}) {
        try {
            return await operation();
        } catch (error) {
            const handledError = this.handle(error, {
                ...context,
                operation: operationName
            });
            throw handledError; // 重新抛出处理后的错误
        }
    }

    /**
     * 安全执行操作，不抛出错误（用于不重要的操作）
     */
    async safeExecute(operation, operationName, context = {}) {
        try {
            return await operation();
        } catch (error) {
            const handledError = this.handle(error, {
                ...context,
                operation: operationName
            });
            return { success: false, error: handledError };
        }
    }
}

/**
 * 错误工具函数
 */
const ErrorUtils = {
    /**
     * 检查是否为可恢复错误
     */
    isRecoverable(error) {
        if (!(error instanceof AppError)) {
            return false;
        }
        
        const recoverableTypes = [
            ErrorTypes.NETWORK_ERROR,
            ErrorTypes.BUSINESS_ERROR,
            ErrorTypes.VALIDATION_ERROR
        ];
        
        return recoverableTypes.includes(error.type) && error.severity !== ErrorSeverity.CRITICAL;
    },

    /**
     * 检查是否需要用户干预
     */
    requiresUserIntervention(error) {
        if (!(error instanceof AppError)) {
            return true; // 未知错误需要用户干预
        }
        
        return [
            ErrorSeverity.HIGH,
            ErrorSeverity.CRITICAL
        ].includes(error.severity);
    },

    /**
     * 格式化错误信息用于UI显示
     */
    formatForUI(error) {
        if (!(error instanceof AppError)) {
            return {
                title: '系统错误',
                message: error.message || '未知错误',
                type: 'unknown'
            };
        }

        const typeMap = {
            [ErrorTypes.VALIDATION_ERROR]: { title: '验证错误', type: 'warning' },
            [ErrorTypes.CONFIG_ERROR]: { title: '配置错误', type: 'error' },
            [ErrorTypes.NETWORK_ERROR]: { title: '网络错误', type: 'warning' },
            [ErrorTypes.AUTHENTICATION_ERROR]: { title: '认证错误', type: 'error' },
            [ErrorTypes.BUSINESS_ERROR]: { title: '业务错误', type: 'warning' },
            [ErrorTypes.SYSTEM_ERROR]: { title: '系统错误', type: 'error' },
            [ErrorTypes.IO_ERROR]: { title: '文件错误', type: 'error' },
            [ErrorTypes.UNKNOWN_ERROR]: { title: '未知错误', type: 'unknown' }
        };

        const typeInfo = typeMap[error.type] || typeMap[ErrorTypes.UNKNOWN_ERROR];
        
        return {
            title: typeInfo.title,
            message: error.message,
            type: typeInfo.type,
            details: error.details,
            severity: error.severity
        };
    }
};

// 导出模块
module.exports = {
    ErrorTypes,
    ErrorSeverity,
    AppError,
    ErrorFactory,
    ErrorHandler,
    ErrorUtils
};