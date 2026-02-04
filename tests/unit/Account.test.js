const Account = require('../../models/Account');
const fs = require('fs');
const path = require('path');

// Mock encryption service
jest.mock('../../utils/encryption', () => ({
  encryptAccountData: (data) => data,
  decryptAccountData: (data) => data
}));

describe('Account Model', () => {
  describe('构造函数', () => {
    test('应该使用默认值创建账号', () => {
      const account = new Account();
      
      expect(account.id).toMatch(/^account_\d+_[a-z0-9]+$/);
      expect(account.name).toMatch(/^账号\d+$/);
      expect(account.cookie).toBe('');
      expect(account.enabled).toBe(true);
      expect(account.tasks).toEqual([]);
      expect(account.statistics.successCount).toBe(0);
      expect(account.statistics.failCount).toBe(0);
    });

    test('应该使用提供的数据创建账号', () => {
      const data = {
        name: '测试账号',
        cookie: 'test_cookie=123;',
        pdduid: '12345',
        userAgent: 'Test Agent'
      };
      
      const account = new Account(data);
      
      expect(account.name).toBe('测试账号');
      expect(account.cookie).toBe('test_cookie=123;');
      expect(account.pdduid).toBe('12345');
      expect(account.userAgent).toBe('Test Agent');
    });

    test('从存储加载时应该解密数据', () => {
      const data = {
        name: '测试账号',
        cookie: 'encrypted_cookie',
        _fromStorage: true
      };
      
      const account = new Account(data);
      expect(account.name).toBe('测试账号');
    });
  });

  describe('extractPdduid', () => {
    test('应该从cookie中提取pdduid', () => {
      const account = new Account({
        cookie: 'pdd_user_id=12345; other=value;'
      });
      
      const pdduid = account.extractPdduid();
      expect(pdduid).toBe('12345');
      expect(account.pdduid).toBe('12345');
    });

    test('应该支持pdduid格式', () => {
      const account = new Account({
        cookie: 'pdduid=67890; other=value;'
      });
      
      const pdduid = account.extractPdduid();
      expect(pdduid).toBe('67890');
    });

    test('cookie为空时返回空字符串', () => {
      const account = new Account();
      expect(account.extractPdduid()).toBe('');
    });
  });

  describe('validate', () => {
    test('有效账号应该通过验证', () => {
      const account = new Account({
        name: '测试账号',
        cookie: 'pdd_user_id=12345;',
        pdduid: '12345'
      });
      
      const result = account.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('缺少cookie应该验证失败', () => {
      const account = new Account({
        name: '测试账号'
      });
      
      const result = account.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Cookie不能为空');
    });

    test('无法提取pdduid应该验证失败', () => {
      const account = new Account({
        name: '测试账号',
        cookie: 'some_other_cookie=value;'
      });
      
      const result = account.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('无法从Cookie中提取用户ID');
    });
  });

  describe('updateStatistics', () => {
    test('应该更新成功统计', () => {
      const account = new Account();
      
      account.updateStatistics(true);
      
      expect(account.statistics.successCount).toBe(1);
      expect(account.statistics.failCount).toBe(0);
      expect(account.statistics.totalRequests).toBe(1);
      expect(account.statistics.lastRunTime).not.toBeNull();
    });

    test('应该更新失败统计', () => {
      const account = new Account();
      
      account.updateStatistics(false);
      
      expect(account.statistics.successCount).toBe(0);
      expect(account.statistics.failCount).toBe(1);
      expect(account.statistics.totalRequests).toBe(1);
    });
  });

  describe('任务管理', () => {
    let account;

    beforeEach(() => {
      account = new Account({
        name: '测试账号',
        cookie: 'test=value;'
      });
    });

    test('应该添加任务', () => {
      const task = account.addTask({
        name: '测试任务',
        goodsId: '123',
        skuId: '456',
        time: '12:00:00.000'
      });
      
      expect(task).toBeDefined();
      expect(task.id).toMatch(/^task_\d+_[a-z0-9]+$/);
      expect(task.name).toBe('测试任务');
      expect(account.tasks).toHaveLength(1);
    });

    test('应该更新任务', () => {
      const task = account.addTask({
        name: '测试任务',
        goodsId: '123',
        skuId: '456',
        time: '12:00:00.000'
      });
      
      const updated = account.updateTask(task.id, { name: '更新后的任务' });
      
      expect(updated.name).toBe('更新后的任务');
      expect(updated.goodsId).toBe('123'); // 其他字段保持不变
    });

    test('应该删除任务', () => {
      const task = account.addTask({
        name: '测试任务',
        goodsId: '123',
        skuId: '456',
        time: '12:00:00.000'
      });
      
      const deleted = account.deleteTask(task.id);
      
      expect(deleted).toBeDefined();
      expect(account.tasks).toHaveLength(0);
    });

    test('应该获取启用的任务', () => {
      account.addTask({
        name: '启用任务',
        goodsId: '123',
        skuId: '456',
        time: '12:00:00.000',
        enabled: true
      });
      
      account.addTask({
        name: '禁用任务',
        goodsId: '789',
        skuId: '012',
        time: '13:00:00.000',
        enabled: false
      });
      
      const enabledTasks = account.getEnabledTasks();
      expect(enabledTasks).toHaveLength(1);
      expect(enabledTasks[0].name).toBe('启用任务');
    });
  });

  describe('toJSON', () => {
    test('应该正确序列化为JSON', () => {
      const account = new Account({
        name: '测试账号',
        cookie: 'test=value;',
        pdduid: '12345'
      });
      
      const json = account.toJSON();
      
      expect(json.name).toBe('测试账号');
      expect(json.cookie).toBe('test=value;');
      expect(json.pdduid).toBe('12345');
      expect(json.id).toBeDefined();
    });
  });
});
