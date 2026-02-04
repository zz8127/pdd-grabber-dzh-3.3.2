const RequestRetryManager = require('../../core/RequestRetryManager');

// Mock logger
const mockLogger = {
  global: jest.fn()
};

describe('RequestRetryManager', () => {
  let retryManager;

  beforeEach(() => {
    retryManager = new RequestRetryManager(mockLogger);
    jest.clearAllMocks();
  });

  describe('初始化', () => {
    test('应该使用默认配置初始化', () => {
      const config = retryManager.getConfig();
      expect(config.maxRetries).toBe(3);
      expect(config.baseDelay).toBe(100);
      expect(config.maxDelay).toBe(5000);
      expect(config.jitter).toBe(true);
    });

    test('应该使用自定义配置初始化', () => {
      const customManager = new RequestRetryManager(mockLogger, {
        maxRetries: 5,
        baseDelay: 200,
        maxDelay: 10000
      });
      
      const config = customManager.getConfig();
      expect(config.maxRetries).toBe(5);
      expect(config.baseDelay).toBe(200);
      expect(config.maxDelay).toBe(10000);
    });
  });

  describe('_calculateDelay', () => {
    test('应该正确计算指数退避延迟', () => {
      const config = retryManager.getConfig();
      
      // 第0次尝试: baseDelay * 2^0 = 100ms
      const delay0 = retryManager._calculateDelay(0, config);
      expect(delay0).toBeGreaterThanOrEqual(100);
      expect(delay0).toBeLessThan(100 + config.jitterRange);
      
      // 第1次尝试: baseDelay * 2^1 = 200ms
      const delay1 = retryManager._calculateDelay(1, config);
      expect(delay1).toBeGreaterThanOrEqual(200);
      expect(delay1).toBeLessThan(200 + config.jitterRange);
      
      // 第2次尝试: baseDelay * 2^2 = 400ms
      const delay2 = retryManager._calculateDelay(2, config);
      expect(delay2).toBeGreaterThanOrEqual(400);
      expect(delay2).toBeLessThan(400 + config.jitterRange);
    });

    test('延迟不应超过最大值', () => {
      const config = retryManager.getConfig();
      
      // 第10次尝试，延迟应该被限制在maxDelay
      const delay = retryManager._calculateDelay(10, config);
      expect(delay).toBeLessThanOrEqual(config.maxDelay + config.jitterRange);
    });
  });

  describe('getStats', () => {
    test('初始统计应该为零', () => {
      const stats = retryManager.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.successfulRequests).toBe(0);
      expect(stats.failedRequests).toBe(0);
      expect(stats.successRate).toBe('0.00%');
    });
  });

  describe('resetStats', () => {
    test('应该重置所有统计数据', () => {
      // 模拟一些请求
      retryManager.stats.totalRequests = 10;
      retryManager.stats.successfulRequests = 8;
      
      retryManager.resetStats();
      
      const stats = retryManager.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.successfulRequests).toBe(0);
    });
  });

  describe('updateConfig', () => {
    test('应该更新配置', () => {
      retryManager.updateConfig({ maxRetries: 10, baseDelay: 500 });
      
      const config = retryManager.getConfig();
      expect(config.maxRetries).toBe(10);
      expect(config.baseDelay).toBe(500);
    });
  });
});
