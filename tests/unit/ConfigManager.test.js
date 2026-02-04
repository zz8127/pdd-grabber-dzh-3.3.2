const ConfigManager = require('../../core/ConfigManager');
const fs = require('fs');
const path = require('path');

// Mock logger
const mockLogger = {
  global: jest.fn()
};

// 临时测试目录
const testDir = path.join(__dirname, 'test-configs');

describe('ConfigManager', () => {
  let configManager;

  beforeAll(() => {
    // 创建测试目录
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    // 清理测试目录
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  beforeEach(() => {
    configManager = new ConfigManager(testDir, mockLogger);
    jest.clearAllMocks();
  });

  afterEach(() => {
    configManager.destroy();
  });

  describe('初始化', () => {
    test('应该正确初始化', () => {
      expect(configManager.configsDir).toBe(path.join(testDir, 'configs'));
      expect(configManager.watchers.size).toBe(0);
      expect(configManager.configCache.size).toBe(0);
    });
  });

  describe('_calculateVersion', () => {
    test('应该为相同配置生成相同的版本号', () => {
      const config1 = { a: 1, b: 2 };
      const config2 = { a: 1, b: 2 };
      
      const version1 = configManager._calculateVersion(config1);
      const version2 = configManager._calculateVersion(config2);
      
      expect(version1).toBe(version2);
    });

    test('应该为不同配置生成不同的版本号', () => {
      const config1 = { a: 1, b: 2 };
      const config2 = { a: 1, b: 3 };
      
      const version1 = configManager._calculateVersion(config1);
      const version2 = configManager._calculateVersion(config2);
      
      expect(version1).not.toBe(version2);
    });
  });

  describe('_diffConfig', () => {
    test('应该检测新增字段', () => {
      const oldConfig = { a: 1 };
      const newConfig = { a: 1, b: 2 };
      
      const changes = configManager._diffConfig(oldConfig, newConfig);
      
      expect(changes).toContainEqual({
        type: 'added',
        path: 'b',
        value: 2
      });
    });

    test('应该检测修改的字段', () => {
      const oldConfig = { a: 1 };
      const newConfig = { a: 2 };
      
      const changes = configManager._diffConfig(oldConfig, newConfig);
      
      expect(changes).toContainEqual({
        type: 'modified',
        path: 'a',
        oldValue: 1,
        newValue: 2
      });
    });

    test('应该检测删除的字段', () => {
      const oldConfig = { a: 1, b: 2 };
      const newConfig = { a: 1 };
      
      const changes = configManager._diffConfig(oldConfig, newConfig);
      
      expect(changes).toContainEqual({
        type: 'removed',
        path: 'b',
        oldValue: 2
      });
    });
  });

  describe('_validateConfig', () => {
    test('应该验证必填字段', () => {
      const config = { name: 'test' };
      const result = configManager._validateConfig('account', config);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('缺少必填字段: id');
    });

    test('应该验证字段类型', () => {
      const config = {
        id: 'test',
        name: 'test',
        cookie: 'test',
        enabled: 'true' // 应该是boolean
      };
      const result = configManager._validateConfig('account', config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('类型错误'))).toBe(true);
    });
  });

  describe('loadConfig & saveConfig', () => {
    test('应该能保存和加载配置', async () => {
      const configName = 'test-config.json';
      const config = { id: 'test', name: 'Test Config', value: 123 };
      
      // 保存配置
      await configManager.saveConfig(configName, config, { backup: false });
      
      // 清除缓存
      configManager.configCache.delete(configName);
      
      // 加载配置
      const loadedConfig = await configManager.loadConfig(configName);
      
      expect(loadedConfig).toEqual(config);
    });
  });

  describe('setHotReload', () => {
    test('应该能切换热更新状态', () => {
      configManager.setHotReload(false);
      expect(configManager.hotReloadEnabled).toBe(false);
      
      configManager.setHotReload(true);
      expect(configManager.hotReloadEnabled).toBe(true);
    });
  });
});
