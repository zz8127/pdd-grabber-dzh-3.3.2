class RequestBuilder {
    constructor(account, accountManager) {
        this.account = account;
        this.accountManager = accountManager;
    }

    /**
     * 生成页面ID
     * @returns {string} 页面ID
     */
    generatePageId() {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substr(2, 10);
        return `10004_${timestamp}_${randomStr}`;
    }

    /**
     * 生成请求头
     * @returns {object} 请求头对象
     */
    generateHeaders() {
        const account = this.account;
        let headers = {
            'User-Agent': account.userAgent,
            'Cookie': account.cookie,
            'Referer': 'https://mobile.yangkeduo.com/',
            'Origin': 'https://mobile.yangkeduo.com',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/json'
        };
        
        if (account.antiContent) {
            headers['Anti-Content'] = account.antiContent;
        }
        
        if (account.pdduid) {
            headers['PDDUID'] = account.pdduid;
            headers['X-PDD-UID'] = account.pdduid;
        }
        
        return headers;
    }

    /**
     * 构建订单数据
     * @param {object} task 任务对象
     * @returns {object} 订单数据
     */
    buildOrderData(task) {
        const { goodsId, skuId, quantity = 1 } = task;
        const account = this.account;
        
        return {
            address_id: account.defaultAddressId || "",
            goods: [{
                sku_id: parseInt(skuId),
                sku_number: quantity,
                goods_id: goodsId
            }],
            group_id: account.defaultGroupId || "153122715481",
            anti_content: account.antiContent,
            page_id: this.generatePageId(),
            activity_id: account.defaultActivityId || "15082569568"
        };
    }

    /**
     * 构建请求URL
     * @returns {string} 请求URL
     */
    buildRequestUrl() {
        return `https://mobile.yangkeduo.com/proxy/api/api/vancouver/order_and_prepay?pdduid=${this.account.pdduid}`;
    }

    /**
     * 构建请求URL列表（同时调用两个下单API）
     * @returns {Array<string>} 请求URL数组
     */
    buildRequestUrls() {
        return [
            `https://mobile.yangkeduo.com/proxy/api/api/vancouver/order_and_prepay?pdduid=${this.account.pdduid}`,
            `https://mobile.yangkeduo.com/proxy/api/order?pdduid=${this.account.pdduid}`
        ];
    }

    /**
     * 获取请求设置
     * @param {boolean} isImmediate 是否立即执行模式
     * @returns {object} 请求设置
     */
    getRequestSettings(isImmediate = false) {
        const requestSettings = this.account.requestSettings || {
            requestCount: 10,
            requestInterval: 500,
            maxRequestTime: 5000,
            timeout: 15000
        };
        
        // 立即执行按钮只执行一次请求，忽略请求设置
        return {
            maxRequestCount: isImmediate ? 1 : Math.min(requestSettings.requestCount || 10, 20),
            requestInterval: requestSettings.requestInterval || 500,
            maxRequestTime: requestSettings.maxRequestTime || 5000,
            timeout: requestSettings.timeout || 15000
        };
    }
}

module.exports = RequestBuilder;