const PerformanceMonitor = require('../../core/PerformanceMonitor');

// Mock logger
const mockLogger = {
  global: jest.fn()
};

describe('PerformanceMonitor', () => {
  let monitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor(mockLogger);
    jest.clearAllMocks();
  });

  afterEach(() => {
    monitor.destroy();
  });

  describe('初始化', () => {
    test('应该使用默认配置初始化', () => {
      expect(monitor.config.collectionInterval).toBe(5000);
      expect(monitor.config.maxDataPoints).toBe(288);
      expect(monitor.isCollecting).toBe(false);
    });

    test('应该使用自定义配置初始化', () => {
      const customMonitor = new PerformanceMonitor(mockLogger, {
        collectionInterval: 10000,
        memoryThreshold: 90
      });
      
      expect(customMonitor.config.collectionInterval).toBe(10000);
      expect(customMonitor.config.alertThresholds.memoryUsage).toBe(90);
    });
  });

  describe('start & stop', () => {
    test('启动后应该开始采集', () => {
      monitor.start();
      expect(monitor.isCollecting).toBe(true);
      expect(mockLogger.global).toHaveBeenCalledWith(
        '性能监控已启动',
        'success',
        'performance'
      );
    });

    test('停止后应该结束采集', () => {
      monitor.start();
      monitor.stop();
      expect(monitor.isCollecting).toBe(false);
    });

    test('重复启动应该给出警告', () => {
      monitor.start();
      monitor.start();
      expect(mockLogger.global).toHaveBeenCalledWith(
        '性能监控已在运行中',
        'warning',
        'performance'
      );
    });
  });

  describe('recordLatency', () => {
    test('应该记录延迟数据', () => {
      monitor.recordLatency(100, true);
      
      expect(monitor.metrics.latency.length).toBe(1);
      expect(monitor.metrics.latency[0].latency).toBe(100);
      expect(monitor.metrics.latency[0].success).toBe(true);
    });

    test('应该更新请求统计', () => {
      monitor.recordLatency(100, true);
      monitor.recordLatency(200, false);
      
      expect(monitor.metrics.requests.total).toBe(2);
      expect(monitor.metrics.requests.success).toBe(1);
      expect(monitor.metrics.requests.failed).toBe(1);
    });
  });

  describe('recordRetry', () => {
    test('应该记录重试次数', () => {
      monitor.recordRetry();
      monitor.recordRetry();
      
      expect(monitor.metrics.requests.retried).toBe(2);
    });
  });

  describe('getStats', () => {
    test('应该返回正确的统计数据', () => {
      // 添加一些测试数据
      monitor.recordLatency(100, true);
      monitor.recordLatency(200, true);
      monitor.recordLatency(300, false);
      
      const stats = monitor.getStats();
      
      expect(stats.requests.total).toBe(3);
      expect(stats.requests.success).toBe(2);
      expect(stats.requests.failed).toBe(1);
      expect(stats.successRate).toBe(67);
    });

    test('应该计算正确的延迟统计', () => {
      monitor.recordLatency(100, true);
      monitor.recordLatency(200, true);
      monitor.recordLatency(300, true);
      
      const stats = monitor.getStats();
      
      expect(stats.latency.average).toBe(200);
      expect(stats.latency.max).toBe(300);
      expect(stats.latency.min).toBe(100);
    });
  });

  describe('reset', () => {
    test('应该重置所有统计数据', () => {
      monitor.recordLatency(100, true);
      monitor.recordRetry();
      
      monitor.reset();
      
      const stats = monitor.getStats();
      expect(stats.requests.total).toBe(0);
      expect(stats.requests.retried).toBe(0);
      expect(monitor.metrics.latency.length).toBe(0);
    });
  });

  describe('updateAlertThresholds', () => {
    test('应该更新告警阈值', () => {
      monitor.updateAlertThresholds({ memoryUsage: 95, cpuUsage: 85 });
      
      expect(monitor.config.alertThresholds.memoryUsage).toBe(95);
      expect(monitor.config.alertThresholds.cpuUsage).toBe(85);
    });
  });

  describe('_calculateAverage', () => {
    test('应该正确计算平均值', () => {
      const data = [
        { value: 10 },
        { value: 20 },
        { value: 30 }
      ];
      
      const avg = monitor._calculateAverage(data, 'value');
      expect(avg).toBe(20);
    });

    test('空数组应该返回0', () => {
      const avg = monitor._calculateAverage([], 'value');
      expect(avg).toBe(0);
    });
  });

  describe('_calculatePercentile', () => {
    test('应该正确计算百分位数', () => {
      const data = [];
      for (let i = 1; i <= 100; i++) {
        data.push({ value: i });
      }
      
      const p95 = monitor._calculatePercentile(data, 'value', 95);
      expect(p95).toBe(95);
      
      const p99 = monitor._calculatePercentile(data, 'value', 99);
      expect(p99).toBe(99);
    });
  });

  describe('generateReport', () => {
    test('应该生成性能报告', () => {
      monitor.recordLatency(100, true);
      
      const report = monitor.generateReport('1h');
      
      expect(report).toHaveProperty('generatedAt');
      expect(report).toHaveProperty('duration', '1h');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('recommendations');
    });
  });
});
