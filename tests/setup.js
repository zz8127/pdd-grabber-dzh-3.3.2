// Jest 测试环境设置

// 设置测试超时
jest.setTimeout(10000);

// 全局 mock
global.console = {
  ...console,
  // 忽略 console.log，但保留错误和警告
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: console.warn,
  error: console.error
};

// 清理函数
afterEach(() => {
  jest.clearAllMocks();
});
