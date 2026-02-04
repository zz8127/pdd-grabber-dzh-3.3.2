class ResponseParser {
    /**
     * 解析API响应（简化版）
     * @param {object} responseData API响应数据
     * @returns {object} 解析结果 {success, orderSn?, needSecondRequest?, errorDetails?}
     */
    parseApiResponse(responseData) {
        if (!responseData) {
            return { success: false, errorDetails: { error_message: '空响应' } };
        }
        
        // 检查是否成功 - 根据拼多多API实际响应结构
        if (responseData.success === true || responseData.status === 'success') {
            // 检查是否有订单号
            if (responseData.order_sn) {
                return { 
                    success: true, 
                    orderSn: responseData.order_sn 
                };
            }
            
            if (responseData.data && responseData.data.order_sn) {
                return { 
                    success: true, 
                    orderSn: responseData.data.order_sn 
                };
            }
            
            // 返回成功但无订单号，可能需要二次请求
            return { 
                success: true,
                needSecondRequest: true
            };
        }
        
        // 检查是否有错误信息
        const errorDetails = {};
        if (responseData.error_msg) errorDetails.error_message = responseData.error_msg;
        if (responseData.msg) errorDetails.message = responseData.msg;
        if (responseData.title) errorDetails.title = responseData.title;
        if (responseData.errorCode) errorDetails.errorCode = responseData.errorCode;
        if (responseData.message) errorDetails.message = responseData.message;
        
        // 尝试从常见错误结构中提取
        if (responseData.error && responseData.error.message) {
            errorDetails.message = responseData.error.message;
        }
        
        if (responseData.data && responseData.data.error_msg) {
            errorDetails.error_message = responseData.data.error_msg;
        }
        
        return {
            success: false,
            errorDetails: Object.keys(errorDetails).length > 0 ? errorDetails : { error_message: '未知错误' }
        };
    }

    /**
     * 提取错误信息用于日志记录
     * @param {object} errorDetails 错误详情
     * @returns {string} 格式化后的错误信息
     */
    formatErrorForLog(errorDetails) {
        if (!errorDetails) return '未知错误';
        
        const parts = [];
        if (errorDetails.error_message) parts.push(`错误: ${errorDetails.error_message}`);
        if (errorDetails.message) parts.push(`消息: ${errorDetails.message}`);
        if (errorDetails.title) parts.push(`标题: ${errorDetails.title}`);
        if (errorDetails.errorCode) parts.push(`错误码: ${errorDetails.errorCode}`);
        
        return parts.length > 0 ? parts.join(', ') : '未知错误';
    }

    /**
     * 检查是否需要二次请求
     * @param {object} parsedResponse 解析后的响应
     * @returns {boolean} 是否需要二次请求
     */
    needsSecondRequest(parsedResponse) {
        return parsedResponse.success && parsedResponse.needSecondRequest === true;
    }

    /**
     * 检查是否成功获取订单号
     * @param {object} parsedResponse 解析后的响应
     * @returns {boolean} 是否成功获取订单号
     */
    hasOrderSn(parsedResponse) {
        return parsedResponse.success && !!parsedResponse.orderSn;
    }

    /**
     * 从HTTP响应中提取错误信息
     * @param {object} error Axios错误对象
     * @returns {object} 标准化错误信息
     */
    extractErrorFromHttpError(error) {
        if (error.response) {
            // 服务器响应了错误状态码
            return {
                type: 'http_error',
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            };
        } else if (error.request) {
            // 请求已发送但无响应
            return {
                type: 'network_error',
                message: '网络请求失败，无响应'
            };
        } else {
            // 请求配置错误
            return {
                type: 'config_error',
                message: error.message
            };
        }
    }
    
    /**
     * 将HTTP错误转换为AppError
     * @param {object} httpError HTTP错误对象
     * @returns {AppError} 标准化的AppError
     */
    createAppErrorFromHttpError(httpError) {
        const { ErrorFactory, ErrorTypes } = require('../utils/errors');
        
        if (httpError.type === 'network_error') {
            return ErrorFactory.networkError(
                httpError.message || '网络请求失败',
                null,
                httpError.status
            );
        } else if (httpError.type === 'config_error') {
            return ErrorFactory.configError(
                httpError.message || '请求配置错误',
                null,
                'http_request'
            );
        } else {
            return ErrorFactory.systemError(
                `HTTP错误: ${httpError.status || '未知状态'}`,
                'http_client',
                'request'
            );
        }
    }
}

module.exports = ResponseParser;