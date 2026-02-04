const axios = require('axios');
const RequestBuilder = require('./RequestBuilder');
const ResponseParser = require('./ResponseParser');
const RequestRetryManager = require('./RequestRetryManager');

/**
 * 任务执行器 - 重构版
 * 将长函数拆分为多个职责单一的小函数
 */
class TaskExecutor {
    constructor(account, accountManager, logger) {
        this.account = account;
        this.accountManager = accountManager;
        this.logger = logger;
        this.requestBuilder = new RequestBuilder(account, accountManager);
        this.responseParser = new ResponseParser();
        this.retryManager = new RequestRetryManager(logger);
        
        // 执行状态
        this.executionState = {
            shouldStop: false,
            successResult: null,
            lastError: null,
            attemptCount: 0,
            completedRequests: 0
        };
    }
    
    /**
     * 主执行方法
     * @param {Object} task - 任务对象
     * @param {boolean} isImmediate - 是否立即执行模式
     * @returns {Promise<Object>} 执行结果
     */
    async execute(task, isImmediate = false) {
        const startTime = Date.now();
        
        try {
            // 1. 初始化执行环境
            this._initializeExecution(task);
            
            // 2. 准备请求参数
            const requestParams = this._prepareRequestParams(task, isImmediate);
            
            // 3. 记录开始日志
            this._logExecutionStart(task, requestParams, isImmediate);
            
            // 4. 执行并发请求
            await this._executeConcurrentRequests(requestParams, isImmediate, startTime);
            
            // 5. 处理执行结果
            const result = this._processExecutionResult(task, startTime);
            
            // 6. 更新状态并保存
            await this._updateTaskStatus(task, result);
            
            return result;
            
        } catch (error) {
            // 7. 处理执行异常
            return this._handleExecutionError(task, error, startTime);
        }
    }
    
    /**
     * 初始化执行环境
     * @private
     */
    _initializeExecution(task) {
        // 重置执行状态
        this.executionState = {
            shouldStop: false,
            successResult: null,
            lastError: null,
            attemptCount: 0,
            completedRequests: 0
        };
        
        this.logger.account(this.account.id, 
            `开始任务: ${task.name}`, 
            'info', 'task.start', this.account.name);
    }
    
    /**
     * 准备请求参数
     * @private
     */
    _prepareRequestParams(task, isImmediate) {
        const requestSettings = this.requestBuilder.getRequestSettings(isImmediate);

        return {
            orderData: this.requestBuilder.buildOrderData(task),
            submitUrls: this.requestBuilder.buildRequestUrls(),
            headers: this.requestBuilder.generateHeaders(),
            maxRequestCount: requestSettings.maxRequestCount,
            requestInterval: requestSettings.requestInterval,
            maxRequestTime: requestSettings.maxRequestTime,
            timeout: requestSettings.timeout
        };
    }
    
    /**
     * 记录执行开始日志
     * @private
     */
    _logExecutionStart(task, requestParams, isImmediate) {
        const { maxRequestCount, requestInterval, maxRequestTime } = requestParams;
        
        this.logger.account(this.account.id, 
            `请求设置: 最大请求${maxRequestCount}次，间隔${requestInterval}ms，最大时间${maxRequestTime}ms${isImmediate ? ' (立即执行模式)' : ''}`, 
            'info', 'task.settings', this.account.name);
    }
    
    /**
     * 执行并发请求
     * @private
     */
    async _executeConcurrentRequests(requestParams, isImmediate, startTime) {
        const { maxRequestCount, maxRequestTime } = requestParams;
        const requestPromises = [];
        
        // 创建请求队列
        for (let i = 0; i < maxRequestCount; i++) {
            const requestPromise = this._createRequestPromise(i + 1, requestParams, isImmediate, startTime);
            requestPromises.push(requestPromise);
        }
        
        // 创建超时Promise
        const timeoutPromise = this._createTimeoutPromise(maxRequestTime);
        
        // 等待所有请求完成或超时
        await Promise.all([
            Promise.all(requestPromises),
            timeoutPromise
        ]);
    }
    
    /**
     * 创建单个请求Promise（同时调用两个API）
     * @private
     */
    _createRequestPromise(requestId, requestParams, isImmediate, startTime) {
        const { orderData, submitUrls, headers, timeout, requestInterval } = requestParams;

        // 立即执行模式下，所有请求同时发送
        if (isImmediate) {
            return this._executeDualRequests(requestId, { orderData, submitUrls, headers, timeout }, startTime);
        }

        // 定时任务模式下，按照间隔发送请求
        return new Promise(resolve => {
            setTimeout(async () => {
                await this._executeDualRequests(requestId, { orderData, submitUrls, headers, timeout }, startTime);
                resolve();
            }, (requestId - 1) * requestInterval);
        });
    }

    /**
     * 同时执行两个API请求
     * @private
     */
    async _executeDualRequests(requestId, requestConfig, startTime) {
        const { orderData, submitUrls, headers, timeout } = requestConfig;

        // 同时向两个API发送请求
        const apiPromises = submitUrls.map((url, index) => {
            const apiName = index === 0 ? 'API1' : 'API2';
            return this._executeSingleApiRequest(requestId, apiName, url, orderData, headers, timeout, startTime);
        });

        // 等待两个API请求完成（无论成功或失败）
        await Promise.allSettled(apiPromises);
    }

    /**
     * 执行单个API请求
     * @private
     */
    async _executeSingleApiRequest(requestId, apiName, url, orderData, headers, timeout, startTime) {
        // 检查是否需要停止
        if (this.executionState.shouldStop) return;

        const requestStartTime = Date.now();
        this._logApiRequestStart(requestId, apiName, requestStartTime);

        try {
            // 使用重试管理器执行请求
            const result = await this.retryManager.execute({
                method: 'post',
                url: url,
                data: orderData,
                headers: headers,
                timeout: timeout
            });

            const requestDuration = Date.now() - requestStartTime;

            if (result.success) {
                this._handleApiRequestSuccess(requestId, apiName, result.response, requestDuration);
            } else {
                this._handleApiRequestFailure(requestId, apiName, result, requestDuration);
            }

        } catch (error) {
            const requestDuration = Date.now() - requestStartTime;
            this._handleApiRequestError(requestId, apiName, error, requestDuration);
        }
    }
    
    /**
     * 创建超时Promise
     * @private
     */
    _createTimeoutPromise(maxRequestTime) {
        return new Promise(resolve => {
            setTimeout(() => {
                this.executionState.shouldStop = true;
                resolve();
            }, maxRequestTime);
        });
    }
    
    /**
     * 执行单次请求
     * @private
     */
    async _executeSingleRequest(requestId, requestConfig, startTime) {
        // 检查是否需要停止
        if (this.executionState.shouldStop) return;
        
        this.executionState.attemptCount++;
        
        // 检查是否超过最大请求时间
        if (this._isTimeoutExceeded(startTime, requestConfig.maxRequestTime)) {
            this._handleTimeout(requestConfig.maxRequestTime);
            return;
        }
        
        const requestStartTime = Date.now();
        this._logRequestStart(requestId, requestStartTime);
        
        try {
            // 使用重试管理器执行请求
            const result = await this.retryManager.execute({
                method: 'post',
                url: requestConfig.submitUrl,
                data: requestConfig.orderData,
                headers: requestConfig.headers,
                timeout: requestConfig.timeout
            });
            
            const requestDuration = Date.now() - requestStartTime;
            
            if (result.success) {
                this._handleRequestSuccess(requestId, result.response, requestDuration);
            } else {
                this._handleRequestFailure(requestId, result, requestDuration);
            }
            
        } catch (error) {
            const requestDuration = Date.now() - requestStartTime;
            this._handleRequestError(requestId, error, requestDuration);
        } finally {
            this.executionState.completedRequests++;
        }
    }
    
    /**
     * 检查是否超时
     * @private
     */
    _isTimeoutExceeded(startTime, maxRequestTime) {
        const currentDuration = Date.now() - startTime;
        return currentDuration > maxRequestTime;
    }
    
    /**
     * 处理超时
     * @private
     */
    _handleTimeout(maxRequestTime) {
        this.logger.account(this.account.id, 
            `达到最大请求时间(${maxRequestTime}ms)，停止后续请求`, 
            'warning', 'task.timeout', this.account.name);
        this.executionState.shouldStop = true;
    }
    
    /**
     * 记录请求开始日志
     * @private
     */
    _logRequestStart(requestId, requestStartTime) {
        const requestStartFormatted = new Date(requestStartTime).toLocaleTimeString('zh-CN', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 3
        });

        this.logger.account(this.account.id,
            `🔄 第${requestId}次请求开始: ${requestStartFormatted}`,
            'info', 'request.start', this.account.name);
    }

    /**
     * 记录API请求开始日志（带API名称）
     * @private
     */
    _logApiRequestStart(requestId, apiName, requestStartTime) {
        const requestStartFormatted = new Date(requestStartTime).toLocaleTimeString('zh-CN', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 3
        });

        this.logger.account(this.account.id,
            `🔄 第${requestId}次请求[${apiName}]开始: ${requestStartFormatted}`,
            'info', 'request.start', this.account.name);
    }
    
    /**
     * 处理请求成功
     * @private
     */
    _handleRequestSuccess(requestId, response, requestDuration) {
        const responseData = response.data;
        
        // 检查是否有订单号（成功）
        if (responseData.order_info && responseData.order_info.order_sn) {
            const orderSn = responseData.order_info.order_sn;
            
            this.logger.account(this.account.id, 
                `✅ 第${requestId}次请求成功: ${requestDuration}ms, 订单号: ${orderSn}`, 
                'success', 'request.success', this.account.name);
            
            this.executionState.successResult = {
                success: true,
                orderSn: orderSn,
                message: `订单创建成功: ${orderSn}`,
                attemptCount: this.executionState.completedRequests + 1,
                totalDuration: Date.now() - this.executionState.startTime
            };
            
            // 成功时立即停止后续请求
            this.executionState.shouldStop = true;
            return;
        }
        
        // 处理其他响应情况
        this._handleOtherResponses(requestId, responseData, requestDuration);
    }
    
    /**
     * 处理其他响应情况
     * @private
     */
    _handleOtherResponses(requestId, responseData, requestDuration) {
        // 检查是否有错误信息
        if (responseData.error_payload?.view_object?.title) {
            const errorTitle = responseData.error_payload.view_object.title;
            this.logger.account(this.account.id, 
                `❌ 第${requestId}次请求失败: ${requestDuration}ms, 原因: ${errorTitle}`, 
                'error', 'request.fail', this.account.name);
            this.executionState.lastError = errorTitle;
        }
        else if (responseData.error_msg) {
            this.logger.account(this.account.id, 
                `❌ 第${requestId}次请求失败: ${requestDuration}ms, 错误: ${responseData.error_msg}`, 
                'error', 'request.fail', this.account.name);
            this.executionState.lastError = responseData.error_msg;
        }
        else {
            const responseStr = JSON.stringify(responseData).substring(0, 100);
            this.logger.account(this.account.id, 
                `⚠️ 第${requestId}次请求未知响应: ${requestDuration}ms, ${responseStr}`, 
                'warning', 'request.unknown', this.account.name);
            this.executionState.lastError = `未知响应: ${responseStr}`;
        }
    }
    
    /**
     * 处理请求失败
     * @private
     */
    _handleRequestFailure(requestId, result, requestDuration) {
        const error = result.error;
        
        if (error.response?.status === 403) {
            const responseData = error.response.data;
            let errorMsg = 'HTTP 403 禁止访问';
            
            if (responseData?.error_payload?.view_object?.title) {
                errorMsg = responseData.error_payload.view_object.title;
            }
            
            this.logger.account(this.account.id, 
                `❌ 第${requestId}次请求失败: ${requestDuration}ms, 状态: 403, 原因: ${errorMsg}`, 
                'error', 'request.http403', this.account.name);
            
            this.executionState.lastError = errorMsg;
        }
        else if (error.response) {
            this.logger.account(this.account.id, 
                `❌ 第${requestId}次请求失败: ${requestDuration}ms, 状态: ${error.response.status}`, 
                'error', 'request.http', this.account.name);
            this.executionState.lastError = `HTTP ${error.response.status} 错误`;
        }
        else {
            this.logger.account(this.account.id, 
                `❌ 第${requestId}次请求失败: ${requestDuration}ms, ${error.message}`, 
                'error', 'request.fail', this.account.name);
            this.executionState.lastError = error.message;
        }
    }
    
    /**
     * 处理请求异常
     * @private
     */
    _handleRequestError(requestId, error, requestDuration) {
        let errorMsg = '请求异常';
        let errorDetails = '';
        
        if (error.code) {
            errorDetails += `, 错误代码: ${error.code}`;
            errorMsg = this._getErrorMessageByCode(error.code);
        }
        
        if (error.message) {
            errorDetails += `, 错误信息: ${error.message}`;
        }
        
        if (error.response) {
            errorDetails += `, HTTP状态: ${error.response.status}`;
            if (error.response.data) {
                errorDetails += `, 响应数据: ${JSON.stringify(error.response.data).substring(0, 100)}`;
            }
        }
        
        const fullErrorMsg = `${errorMsg}${errorDetails}`;
        
        this.logger.account(this.account.id, 
            `❌ 第${requestId}次请求异常: ${requestDuration}ms, ${fullErrorMsg}`, 
            'error', 'request.error', this.account.name);
        
        this.executionState.lastError = fullErrorMsg;
    }
    
    /**
     * 根据错误代码获取错误消息
     * @private
     */
    _getErrorMessageByCode(code) {
        const errorMessages = {
            'ECONNABORTED': '请求超时',
            'ECONNREFUSED': '连接被拒绝',
            'ENOTFOUND': '域名解析失败',
            'ETIMEDOUT': '请求超时',
            'EPIPE': '连接中断',
            'ECONNRESET': '连接重置'
        };
        return errorMessages[code] || '请求异常';
    }
    
    /**
     * 处理执行结果
     * @private
     */
    _processExecutionResult(task, startTime) {
        const totalDuration = Date.now() - startTime;
        
        if (this.executionState.successResult) {
            return this._createSuccessResult(task, totalDuration);
        } else {
            return this._createFailureResult(task, totalDuration);
        }
    }
    
    /**
     * 创建成功结果
     * @private
     */
    _createSuccessResult(task, totalDuration) {
        const { successResult } = this.executionState;
        
        this.logger.account(this.account.id, 
            `🎉 任务成功: ${task.name}, ${this.executionState.attemptCount}次尝试, ${totalDuration}ms, 订单号: ${successResult.orderSn}`, 
            'success', 'task.complete', this.account.name);
        
        this.logger.global(
            `任务成功: ${this.account.name} - ${task.name} 订单号: ${successResult.orderSn}`, 
            'success', 'task.success', this.account.name);
        
        return successResult;
    }
    
    /**
     * 创建失败结果
     * @private
     */
    _createFailureResult(task, totalDuration) {
        const errorMsg = this.executionState.lastError || 
            `所有${this.executionState.attemptCount}次尝试均失败`;
        
        this.logger.account(this.account.id, 
            `💥 任务失败: ${task.name}, ${this.executionState.attemptCount}次尝试, ${totalDuration}ms, 原因: ${errorMsg}`, 
            'error', 'task.failed', this.account.name);
        
        // 检查是否因为超时
        if (totalDuration >= this.requestBuilder.getRequestSettings().maxRequestTime) {
            this.logger.account(this.account.id, 
                `任务因超时而终止`, 
                'warning', 'task.timeout-final', this.account.name);
        }
        
        this.logger.global(
            `任务失败: ${this.account.name} - ${task.name} 原因: ${errorMsg}`, 
            'error', 'task.failed', this.account.name);
        
        return {
            success: false,
            message: errorMsg,
            attemptCount: this.executionState.attemptCount,
            totalDuration
        };
    }
    
    /**
     * 更新任务状态
     * @private
     */
    async _updateTaskStatus(task, result) {
        task.lastRun = new Date().toISOString();
        task.result = result;
        this.account.updateStatistics(result.success);
        
        // 异步保存，不等待
        setTimeout(() => {
            this.accountManager.saveAccount(this.account.id).catch(err => {
                console.error('保存账号失败:', err);
            });
        }, 0);
    }
    
    /**
     * 处理执行异常
     * @private
     */
    _handleExecutionError(task, error, startTime) {
        const totalDuration = Date.now() - startTime;
        let errorMsg = '任务执行异常';
        let errorDetails = '';
        
        if (error.code) {
            errorDetails += `, 错误代码: ${error.code}`;
        }
        
        if (error.message) {
            errorDetails += `, 错误信息: ${error.message}`;
        }
        
        if (error.stack) {
            const stackLines = error.stack.split('\n').slice(0, 3).join('\n');
            errorDetails += `, 堆栈信息: ${stackLines}`;
        }
        
        const fullErrorMsg = `${errorMsg}${errorDetails}`;
        
        this.logger.account(this.account.id, 
            `💥 任务执行异常: ${task.name}, ${fullErrorMsg}`, 
            'error', 'task.error', this.account.name);
        
        const result = {
            success: false,
            message: fullErrorMsg,
            attemptCount: this.executionState.attemptCount,
            totalDuration,
            errorType: error.name || 'Error',
            errorCode: error.code || null,
            errorStack: error.stack || null
        };
        
        task.lastRun = new Date().toISOString();
        task.result = result;
        this.account.updateStatistics(false);
        
        // 异步保存
        setTimeout(() => {
            this.accountManager.saveAccount(this.account.id).catch(err => {
                console.error('保存账号失败:', err);
            });
        }, 0);
        
        return result;
    }
    
    /**
     * 处理API请求成功
     * @private
     */
    _handleApiRequestSuccess(requestId, apiName, response, requestDuration) {
        const responseData = response.data;

        // 记录API响应状态
        this.logger.account(this.account.id,
            `📡 第${requestId}次请求[${apiName}]响应: HTTP ${response.status}, 耗时: ${requestDuration}ms`,
            'info', 'request.response', this.account.name);

        // 提取关键信息
        const title = responseData.title || responseData.error_title || '';
        const msg = responseData.error_msg || responseData.msg || '';
        const errorCode = responseData.error_code || responseData.code || '';
        const orderSn = responseData.order_sn ||
                       (responseData.order_info && responseData.order_info.order_sn) ||
                       (responseData.result && responseData.result.order_sn);

        // 记录主要信息
        if (title) {
            this.logger.account(this.account.id,
                `📋 第${requestId}次请求[${apiName}]返回标题: ${title}`,
                'info', 'request.info', this.account.name);
        }
        if (msg) {
            this.logger.account(this.account.id,
                `📋 第${requestId}次请求[${apiName}]返回消息: ${msg}`,
                'info', 'request.info', this.account.name);
        }
        if (errorCode) {
            this.logger.account(this.account.id,
                `📋 第${requestId}次请求[${apiName}]错误代码: ${errorCode}`,
                'info', 'request.info', this.account.name);
        }

        // 检查是否有订单号（成功）
        if (orderSn) {
            this.logger.account(this.account.id,
                `✅ 第${requestId}次请求[${apiName}]成功: ${requestDuration}ms, 订单号: ${orderSn}`,
                'success', 'request.success', this.account.name);

            this.executionState.successResult = {
                success: true,
                orderSn: orderSn,
                message: `订单创建成功[${apiName}]: ${orderSn}`,
                attemptCount: this.executionState.attemptCount + 1,
                totalDuration: Date.now() - this.executionState.startTime,
                api: apiName
            };

            // 成功时立即停止后续请求
            this.executionState.shouldStop = true;
            return;
        }

        // HTTP 200 但可能包含其他成功标记
        if (response.status === 200) {
            const hasSuccessFlag = responseData.success === true ||
                                  (responseData.result !== undefined && responseData.result !== null);

            if (hasSuccessFlag) {
                this.logger.account(this.account.id,
                    `✅ 第${requestId}次请求[${apiName}]提交成功: ${requestDuration}ms`,
                    'success', 'request.success', this.account.name);

                this.executionState.successResult = {
                    success: true,
                    orderSn: null,
                    message: `订单提交成功[${apiName}]`,
                    attemptCount: this.executionState.attemptCount + 1,
                    totalDuration: Date.now() - this.executionState.startTime,
                    api: apiName
                };

                this.executionState.shouldStop = true;
                return;
            }
        }

        // 处理其他响应情况
        this._handleApiOtherResponses(requestId, apiName, responseData, requestDuration);
    }

    /**
     * 处理API其他响应情况
     * @private
     */
    _handleApiOtherResponses(requestId, apiName, responseData, requestDuration) {
        // 优先提取详细的错误信息（完整的错误信息解析链）
        let errorTitle = '失败';
        let errorMsg = '';
        let errorCode = responseData.error_code || responseData.code || '';

        // 1. 优先检查 error_payload.view_object.title（最详细的错误信息）
        if (responseData.error_payload?.view_object?.title) {
            errorTitle = responseData.error_payload.view_object.title;
            errorMsg = errorTitle;
            this.logger.account(this.account.id,
                `📋 第${requestId}次请求[${apiName}]详细错误信息: ${errorTitle}`,
                'info', 'request.info', this.account.name);
        }
        // 2. 检查 responseData.title
        else if (responseData.title) {
            errorTitle = responseData.title;
            errorMsg = responseData.title;
        }
        // 3. 检查 responseData.error_msg
        else if (responseData.error_msg) {
            errorMsg = responseData.error_msg;
        }
        // 4. 检查 responseData.msg
        else if (responseData.msg) {
            errorMsg = responseData.msg;
        }
        // 5. 未知响应
        else {
            const responseStr = JSON.stringify(responseData).substring(0, 100);
            errorMsg = `未知响应: ${responseStr}`;
            this.logger.account(this.account.id,
                `⚠️ 第${requestId}次请求[${apiName}]未知响应: ${requestDuration}ms, ${responseStr}`,
                'warning', 'request.unknown', this.account.name);
            this.executionState.lastError = `[${apiName}] ${errorMsg}`;
            return;
        }

        // 构建完整的错误信息
        let fullErrorMsg = `[${apiName}] ${errorTitle}`;
        if (errorCode) {
            fullErrorMsg += ` (错误码: ${errorCode})`;
        }
        if (errorMsg && errorMsg !== errorTitle) {
            fullErrorMsg += ` - ${errorMsg}`;
        }

        this.logger.account(this.account.id,
            `❌ 第${requestId}次请求[${apiName}]失败: ${requestDuration}ms, ${fullErrorMsg}`,
            'error', 'request.fail', this.account.name);

        this.executionState.lastError = fullErrorMsg;
    }

    /**
     * 处理API请求失败
     * @private
     */
    _handleApiRequestFailure(requestId, apiName, result, requestDuration) {
        const error = result.error;

        // 区分超时错误
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            this.logger.account(this.account.id,
                `⏱️ 第${requestId}次请求[${apiName}]超时: ${requestDuration}ms, 超时时间: ${this.account.requestSettings?.timeout || 15000}ms`,
                'warning', 'request.timeout', this.account.name);
            this.executionState.lastError = `[${apiName}] 请求超时 (${this.account.requestSettings?.timeout || 15000}ms)`;
            return;
        }

        if (error.response?.status === 403) {
            const responseData = error.response.data;
            let errorMsg = 'HTTP 403 禁止访问';
            let errorTitle = '';

            // 提取详细的403错误信息
            if (responseData?.error_payload?.view_object?.title) {
                errorTitle = responseData.error_payload.view_object.title;
                errorMsg = errorTitle;
            } else if (responseData?.title) {
                errorTitle = responseData.title;
                errorMsg = errorTitle;
            } else if (responseData?.error_msg) {
                errorMsg = responseData.error_msg;
            } else if (responseData?.msg) {
                errorMsg = responseData.msg;
            }

            const errorCode = responseData?.error_code || responseData?.code || '';
            let fullErrorMsg = `[${apiName}] HTTP 403`;
            if (errorTitle) fullErrorMsg += ` - ${errorTitle}`;
            if (errorCode) fullErrorMsg += ` (错误码: ${errorCode})`;

            this.logger.account(this.account.id,
                `❌ 第${requestId}次请求[${apiName}]失败: ${requestDuration}ms, ${fullErrorMsg}`,
                'error', 'request.http403', this.account.name);

            this.executionState.lastError = fullErrorMsg;
        }
        else if (error.response) {
            const status = error.response.status;
            const responseData = error.response.data;
            let errorMsg = `HTTP ${status}`;

            // 尝试提取错误信息
            if (responseData?.error_payload?.view_object?.title) {
                errorMsg += ` - ${responseData.error_payload.view_object.title}`;
            } else if (responseData?.title) {
                errorMsg += ` - ${responseData.title}`;
            } else if (responseData?.error_msg) {
                errorMsg += ` - ${responseData.error_msg}`;
            } else if (responseData?.msg) {
                errorMsg += ` - ${responseData.msg}`;
            }

            this.logger.account(this.account.id,
                `❌ 第${requestId}次请求[${apiName}]失败: ${requestDuration}ms, ${errorMsg}`,
                'error', 'request.http', this.account.name);
            this.executionState.lastError = `[${apiName}] ${errorMsg}`;
        }
        else {
            // 网络错误或其他错误
            const errorCode = error.code || 'UNKNOWN';
            this.logger.account(this.account.id,
                `❌ 第${requestId}次请求[${apiName}]失败: ${requestDuration}ms, 错误代码: ${errorCode}, ${error.message}`,
                'error', 'request.fail', this.account.name);
            this.executionState.lastError = `[${apiName}] ${errorCode}: ${error.message}`;
        }
    }

    /**
     * 处理API请求异常
     * @private
     */
    _handleApiRequestError(requestId, apiName, error, requestDuration) {
        // 区分超时错误
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            this.logger.account(this.account.id,
                `⏱️ 第${requestId}次请求[${apiName}]超时: ${requestDuration}ms, 超时时间: ${this.account.requestSettings?.timeout || 15000}ms`,
                'warning', 'request.timeout', this.account.name);
            this.executionState.lastError = `[${apiName}] 请求超时 (${this.account.requestSettings?.timeout || 15000}ms)`;
            return;
        }

        let errorMsg = '请求异常';
        let errorDetails = '';
        const errorCode = error.code || 'UNKNOWN';

        // 获取错误代码对应的消息
        if (error.code) {
            errorMsg = this._getErrorMessageByCode(error.code);
            errorDetails += `, 错误代码: ${error.code}`;
        }

        if (error.message) {
            errorDetails += `, 错误信息: ${error.message}`;
        }

        // 提取HTTP响应信息
        if (error.response) {
            errorDetails += `, HTTP状态: ${error.response.status}`;

            // 尝试提取响应中的错误信息
            const responseData = error.response.data;
            if (responseData) {
                if (responseData.error_payload?.view_object?.title) {
                    errorDetails += `, 错误标题: ${responseData.error_payload.view_object.title}`;
                } else if (responseData.title) {
                    errorDetails += `, 错误标题: ${responseData.title}`;
                } else if (responseData.error_msg) {
                    errorDetails += `, 错误消息: ${responseData.error_msg}`;
                } else if (responseData.msg) {
                    errorDetails += `, 消息: ${responseData.msg}`;
                }

                if (responseData.error_code || responseData.code) {
                    errorDetails += `, 错误码: ${responseData.error_code || responseData.code}`;
                }

                // 记录响应数据摘要
                const responseStr = JSON.stringify(responseData).substring(0, 100);
                errorDetails += `, 响应: ${responseStr}`;
            }
        }

        const fullErrorMsg = `${errorMsg}${errorDetails}`;

        this.logger.account(this.account.id,
            `❌ 第${requestId}次请求[${apiName}]异常: ${requestDuration}ms, ${fullErrorMsg}`,
            'error', 'request.error', this.account.name);

        this.executionState.lastError = `[${apiName}] ${errorCode}: ${fullErrorMsg}`;
    }

    /**
     * 获取执行统计
     */
    getExecutionStats() {
        return {
            ...this.executionState,
            retryStats: this.retryManager.getStats()
        };
    }
    
    /**
     * 重置执行器状态
     */
    reset() {
        this.executionState = {
            shouldStop: false,
            successResult: null,
            lastError: null,
            attemptCount: 0,
            completedRequests: 0
        };
        this.retryManager.resetStats();
    }
}

module.exports = TaskExecutor;
