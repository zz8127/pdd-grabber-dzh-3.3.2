const TaskExecutor = require('../../core/TaskExecutor');
const Account = require('../../models/Account');

// Mock logger
const mockLogger = {
  account: jest.fn(),
  global: jest.fn()
};

// Mock account manager
const mockAccountManager = {
  saveAccount: jest.fn().mockResolvedValue(true)
};

describe('TaskExecutor', () => {
  let executor;
  let mockAccount;

  beforeEach(() => {
    mockAccount = new Account({
      id: 'test-account',
      name: 'Test Account',
      pdduid: '12345',
      cookie: 'test-cookie',
      requestSettings: {
        requestCount: 3,
        requestInterval: 100,
        maxRequestTime: 5000
      }
    });
    
    executor = new TaskExecutor(mockAccount, mockAccountManager, mockLogger);
    jest.clearAllMocks();
  });

  describe('初始化', () => {
    test('应该正确初始化', () => {
      expect(executor.account).toBe(mockAccount);
      expect(executor.accountManager).toBe(mockAccountManager);
      expect(executor.logger).toBe(mockLogger);
    });

    test('应该初始化执行状态', () => {
      const state = executor.executionState;
      expect(state.shouldStop).toBe(false);
      expect(state.successResult).toBeNull();
      expect(state.lastError).toBeNull();
      expect(state.attemptCount).toBe(0);
      expect(state.completedRequests).toBe(0);
    });
  });

  describe('_calculateDelay', () => {
    test('应该正确计算延迟（立即执行模式）', () => {
      const params = { requestInterval: 100 };
      const isImmediate = true;
      
      // 立即执行模式下，所有请求同时发送
      const promise = executor._createRequestPromise(1, params, isImmediate, Date.now());
      expect(promise).toBeInstanceOf(Promise);
    });

    test('应该正确计算延迟（定时任务模式）', () => {
      const params = { requestInterval: 100 };
      const isImmediate = false;
      
      // 定时任务模式下，请求按间隔发送
      const promise = executor._createRequestPromise(2, params, isImmediate, Date.now());
      expect(promise).toBeInstanceOf(Promise);
    });
  });

  describe('_isTimeoutExceeded', () => {
    test('应该正确检测超时', () => {
      const startTime = Date.now() - 6000; // 6秒前开始
      const maxRequestTime = 5000; // 最大5秒
      
      const isTimeout = executor._isTimeoutExceeded(startTime, maxRequestTime);
      expect(isTimeout).toBe(true);
    });

    test('应该正确检测未超时', () => {
      const startTime = Date.now() - 1000; // 1秒前开始
      const maxRequestTime = 5000; // 最大5秒
      
      const isTimeout = executor._isTimeoutExceeded(startTime, maxRequestTime);
      expect(isTimeout).toBe(false);
    });
  });

  describe('_getErrorMessageByCode', () => {
    test('应该返回正确的错误消息', () => {
      expect(executor._getErrorMessageByCode('ECONNABORTED')).toBe('请求超时');
      expect(executor._getErrorMessageByCode('ECONNREFUSED')).toBe('连接被拒绝');
      expect(executor._getErrorMessageByCode('ENOTFOUND')).toBe('域名解析失败');
      expect(executor._getErrorMessageByCode('ETIMEDOUT')).toBe('请求超时');
      expect(executor._getErrorMessageByCode('UNKNOWN')).toBe('请求异常');
    });
  });

  describe('reset', () => {
    test('应该重置执行状态', () => {
      // 修改状态
      executor.executionState.attemptCount = 5;
      executor.executionState.successResult = { success: true };
      
      // 重置
      executor.reset();
      
      // 验证
      expect(executor.executionState.attemptCount).toBe(0);
      expect(executor.executionState.successResult).toBeNull();
      expect(executor.executionState.shouldStop).toBe(false);
    });
  });

  describe('getExecutionStats', () => {
    test('应该返回执行统计', () => {
      const stats = executor.getExecutionStats();
      
      expect(stats).toHaveProperty('shouldStop');
      expect(stats).toHaveProperty('attemptCount');
      expect(stats).toHaveProperty('completedRequests');
      expect(stats).toHaveProperty('retryStats');
    });
  });
});
