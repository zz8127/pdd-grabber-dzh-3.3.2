const { contextBridge, ipcRenderer } = require('electron');

// 从URL获取账号ID
const urlParams = new URLSearchParams(window.location.search);
const accountId = urlParams.get('accountId');

// 暴露安全的API给登录窗口
contextBridge.exposeInMainWorld('loginAPI', {
    // 获取账号ID
    getAccountId: () => accountId,

    // ==================== 登录相关操作 ====================
    // 将提取的Cookie数据应用到账号配置
    applyCookieData: (cookieData) => {
        return ipcRenderer.invoke('apply-cookie-data', accountId, cookieData);
    },

    // 获取完整的Cookie（包括HttpOnly Cookie）
    getFullCookies: () => {
        return ipcRenderer.invoke('get-login-window-cookies', accountId);
    },

    // 打开对应的账号窗口
    openAccountWindow: () => {
        return ipcRenderer.invoke('open-account-window', accountId);
    },

    // 获取账号信息
    getAccountInfo: () => {
        return ipcRenderer.invoke('get-account', accountId);
    },

    // ==================== 调试相关 ====================
    // 发送错误日志到主进程
    sendErrorLog: (type, error) => {
        try {
            // 提取错误信息
            const errorInfo = {
                type: type,
                message: error?.message || String(error),
                stack: error?.stack || '',
                timestamp: new Date().toISOString()
            };
            return ipcRenderer.invoke('send-error-log', errorInfo);
        } catch (e) {
            console.error('发送错误日志失败:', e);
            return Promise.reject(e);
        }
    }
});