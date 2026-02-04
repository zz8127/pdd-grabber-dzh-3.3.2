const MultiAccountManager = require('../../core/MultiAccountManager');
const fs = require('fs');
const path = require('path');

// Mock encryption service
jest.mock('../../utils/encryption', () => ({
  encryptAccountData: (data) => data,
  decryptAccountData: (data) => data
}));

// Mock ntp-client
jest.mock('ntp-client', () => ({
  getNetworkTime: jest.fn((server, port, callback) => {
    callback(null, new Date());
  })
}));

describe('MultiAccountManager', () => {
  let manager;
  let testDir;

  beforeEach(async () => {
    // 创建临时测试目录
    testDir = path.join(__dirname, 'test-data', `test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
    
    manager = new MultiAccountManager(testDir);
    await manager.initialize();
  });

  afterEach(() => {
    // 清理测试目录
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('初始化', () => {
    test('应该正确初始化', () => {
      expect(manager.accounts).toBeInstanceOf(Map);
      expect(manager.globalConfig).toBeDefined();
      expect(manager.configsDir).toBe(path.join(testDir, 'configs'));
    });

    test('应该创建必要的目录', () => {
      expect(fs.existsSync(manager.configsDir)).toBe(true);
      expect(fs.existsSync(manager.logsDir)).toBe(true);
    });
  });

  describe('createAccount', () => {
    test('应该成功创建账号', async () => {
      const accountData = {
        name: '测试账号',
        cookie: 'pdd_user_id=12345; test=value;',
        pdduid: '12345'
      };

      const result = await manager.createAccount(accountData);

      expect(result.success).toBe(true);
      expect(result.account).toBeDefined();
      expect(result.account.name).toBe('测试账号');
      expect(result.message).toBe('账号创建成功');
    });

    test('缺少账号名称应该失败', async () => {
      const accountData = {
        cookie: 'pdd_user_id=12345;'
      };

      const result = await manager.createAccount(accountData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('账号名称不能为空');
    });

    test('缺少cookie应该失败', async () => {
      const accountData = {
        name: '测试账号'
      };

      const result = await manager.createAccount(accountData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Cookie不能为空');
    });

    test('无效的cookie应该失败', async () => {
      const accountData = {
        name: '测试账号',
        cookie: 'invalid_cookie_without_user_id;'
      };

      const result = await manager.createAccount(accountData);

      expect(result.success).toBe(false);
      expect(result.message).toContain('账号验证失败');
    });

    test('创建的账号应该保存到文件', async () => {
      const accountData = {
        name: '测试账号',
        cookie: 'pdd_user_id=12345; test=value;',
        pdduid: '12345'
      };

      const result = await manager.createAccount(accountData);
      
      // 验证文件是否创建
      const configPath = path.join(manager.configsDir, `${result.account.id}.json`);
      expect(fs.existsSync(configPath)).toBe(true);
      
      // 验证文件内容
      const savedData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(savedData.name).toBe('测试账号');
    });

    test('创建的账号应该添加到内存', async () => {
      const accountData = {
        name: '测试账号',
        cookie: 'pdd_user_id=12345; test=value;',
        pdduid: '12345'
      };

      const result = await manager.createAccount(accountData);
      
      const account = manager.getAccount(result.account.id);
      expect(account).toBeDefined();
      expect(account.name).toBe('测试账号');
    });
  });

  describe('getAllAccounts', () => {
    test('应该返回所有账号', async () => {
      // 创建两个账号
      await manager.createAccount({
        name: '账号1',
        cookie: 'pdd_user_id=1;',
        pdduid: '1'
      });
      
      await manager.createAccount({
        name: '账号2',
        cookie: 'pdd_user_id=2;',
        pdduid: '2'
      });

      const accounts = manager.getAllAccounts();
      
      expect(accounts).toHaveLength(2);
      expect(accounts.map(a => a.name)).toContain('账号1');
      expect(accounts.map(a => a.name)).toContain('账号2');
    });

    test('空账号列表应该返回空数组', () => {
      const accounts = manager.getAllAccounts();
      expect(accounts).toEqual([]);
    });
  });

  describe('getAccount', () => {
    test('应该获取指定账号', async () => {
      const result = await manager.createAccount({
        name: '测试账号',
        cookie: 'pdd_user_id=12345;',
        pdduid: '12345'
      });

      const account = manager.getAccount(result.account.id);
      
      expect(account).toBeDefined();
      expect(account.name).toBe('测试账号');
    });

    test('不存在的账号应该返回undefined', () => {
      const account = manager.getAccount('non-existent-id');
      expect(account).toBeUndefined();
    });
  });

  describe('updateAccount', () => {
    test('应该更新账号信息', async () => {
      const createResult = await manager.createAccount({
        name: '原始名称',
        cookie: 'pdd_user_id=12345;',
        pdduid: '12345'
      });

      const updateResult = await manager.updateAccount(createResult.account.id, {
        name: '新名称',
        description: '新描述'
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.account.name).toBe('新名称');
      expect(updateResult.account.description).toBe('新描述');
    });

    test('更新不存在的账号应该失败', async () => {
      const result = await manager.updateAccount('non-existent-id', {
        name: '新名称'
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('账号不存在');
    });
  });

  describe('deleteAccount', () => {
    test('应该删除账号', async () => {
      const createResult = await manager.createAccount({
        name: '测试账号',
        cookie: 'pdd_user_id=12345;',
        pdduid: '12345'
      });

      const deleteResult = await manager.deleteAccount(createResult.account.id);

      expect(deleteResult.success).toBe(true);
      expect(manager.getAccount(createResult.account.id)).toBeUndefined();
    });

    test('删除不存在的账号应该失败', async () => {
      const result = await manager.deleteAccount('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.message).toBe('账号不存在');
    });

    test('删除账号应该同时删除配置文件', async () => {
      const createResult = await manager.createAccount({
        name: '测试账号',
        cookie: 'pdd_user_id=12345;',
        pdduid: '12345'
      });

      const configPath = path.join(manager.configsDir, `${createResult.account.id}.json`);
      expect(fs.existsSync(configPath)).toBe(true);

      await manager.deleteAccount(createResult.account.id);

      expect(fs.existsSync(configPath)).toBe(false);
    });
  });

  describe('getGlobalStats', () => {
    test('应该返回正确的统计信息', async () => {
      // 创建两个账号
      await manager.createAccount({
        name: '账号1',
        cookie: 'pdd_user_id=1;',
        pdduid: '1'
      });
      
      await manager.createAccount({
        name: '账号2',
        cookie: 'pdd_user_id=2;',
        pdduid: '2'
      });

      const stats = manager.getGlobalStats();

      expect(stats.totalAccounts).toBe(2);
      expect(stats.totalTasks).toBe(0);
      expect(stats.totalEnabledTasks).toBe(0);
    });
  });

  describe('时间同步', () => {
    test('应该同步NTP时间', async () => {
      const result = await manager.syncServerTime();

      expect(result.success).toBe(true);
      expect(result.offset).toBeDefined();
      expect(result.server).toBeDefined();
    });

    test('应该获取NTP时间', () => {
      const ntpTime = manager.getCurrentNtpTime();
      expect(ntpTime).toBeInstanceOf(Date);
    });
  });
});
