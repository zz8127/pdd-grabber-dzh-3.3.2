# 🛒 拼多多多账号抢购助手 v3.3.2

[![Version](https://img.shields.io/badge/version-3.3.2-blue.svg)](./package.json)
[![Electron](https://img.shields.io/badge/Electron-25.0.0-47848F.svg)](https://www.electronjs.org/)
[![Vue](https://img.shields.io/badge/Vue-3.3.4-4FC08D.svg)](https://vuejs.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

> 基于 Electron + Vue 3 的自动化抢购工具，支持毫秒级定时、智能重试、双API并发请求，专为拼多多秒杀活动设计。

---

## 📋 目录

- [✨ 功能特性](#-功能特性)
- [🏗️ 系统架构](#️-系统架构)
- [🛠️ 技术栈](#️-技术栈)
- [📁 项目结构](#-项目结构)
- [🚀 快速开始](#-快速开始)
- [⚙️ 配置说明](#️-配置说明)
- [📖 使用教程](#-使用教程)
- [🔧 故障排除](#-故障排除)
- [⚠️ 免责声明](#️-免责声明)
- [📝 更新日志](#-更新日志)

---

## ✨ 功能特性

### 核心功能

| 功能模块 | 描述 | 状态 |
|---------|------|------|
| 🎯 **毫秒级定时** | 支持 HH:mm:ss.SSS 格式，精确到毫秒的定时任务调度 | ✅ 可用 |
| 👥 **多账号管理** | 支持多个拼多多账号同时管理，独立配置和任务 | ✅ 可用 |
| 🔄 **智能重试** | 指数退避算法，自动重试失败的请求 | ✅ 可用 |
| 🔀 **双API并发** | 同时调用两个下单API，提高成功率 | ✅ 可用 |
| ⏰ **NTP时间同步** | 自动与NTP服务器同步时间，确保抢购精准 | ✅ 可用 |
| 📊 **性能监控** | 实时监控CPU、内存、请求延迟等指标 | ✅ 可用 |
| 📝 **详细日志** | 分级分类日志，支持导出和实时查看 | ✅ 可用 |
| 🔐 **安全登录** | 内置登录窗口，自动获取有效Cookie | ✅ 可用 |

### 界面特性

- 🎨 **现代化UI** - Vue 3 + Element Plus，响应式设计
- 🌙 **暗黑模式** - 支持浅色/深色主题切换
- 📱 **多窗口管理** - 独立账号窗口、登录窗口
- 📈 **数据可视化** - ECharts 实时图表展示

---

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        表现层 (Renderer)                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Dashboard│ │ Accounts │ │  Tasks   │ │QuickBuy  │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│  Vue 3 + Element Plus + Vue Router + Pinia                     │
└─────────────────────────────────────────────────────────────────┘
                              │ IPC通信
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        主进程层 (Main)                           │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐     │
│  │ MultiAccount   │  │ MultiTask      │  │ Performance    │     │
│  │   Manager      │  │  Scheduler     │  │   Monitor      │     │
│  └───────┬────────┘  └───────┬────────┘  └────────────────┘     │
│          │                   │                                   │
│          ▼                   ▼                                   │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐     │
│  │ TaskExecutor   │  │ RequestBuilder │  │ ResponseParser │     │
│  └────────────────┘  └────────────────┘  └────────────────┘     │
│  Electron + Node.js + Axios                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        数据层 (Data)                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Account   │  │    Task     │  │    Logs     │             │
│  │   Models    │  │   Models    │  │   Files     │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│  JSON配置文件 + 本地日志存储                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ 技术栈

### 核心技术

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| **桌面框架** | Electron | 25.0.0 | 跨平台桌面应用 |
| **前端框架** | Vue.js | 3.3.4 | 用户界面构建 |
| **UI组件库** | Element Plus | 2.3.14 | 组件库 |
| **状态管理** | Pinia | 2.1.6 | Vue状态管理 |
| **路由管理** | Vue Router | 4.2.4 | 前端路由 |
| **构建工具** | Vite | 4.4.9 | 前端构建 |
| **HTTP客户端** | Axios | 1.6.0 | 网络请求 |
| **图表库** | ECharts | 5.4.3 | 数据可视化 |
| **测试框架** | Jest | 29.7.0 | 单元测试 |
| **打包工具** | electron-builder | 23.6.0 | 应用打包 |

---

## 📁 项目结构

```
pdd-grabber/
├── 📄 入口文件
│   ├── main.js                      # Electron主进程入口
│   ├── preload.js                   # 主窗口预加载脚本
│   ├── preload-account.js           # 账号窗口预加载脚本
│   ├── preload-login.js             # 登录窗口预加载脚本
│   ├── index.html                   # 主界面
│   ├── account-window.html          # 账号管理窗口
│   ├── login-window.html            # 登录窗口
│   └── package.json                 # 项目配置
│
├── 📁 core/                         # 核心业务逻辑
│   ├── MultiAccountManager.js       # 多账号管理器
│   ├── MultiTaskScheduler.js        # 多任务调度器
│   ├── TaskExecutor.js              # 任务执行器
│   ├── MultiLogger.js               # 多日志管理器
│   ├── ConfigManager.js             # 配置管理器
│   ├── PerformanceMonitor.js        # 性能监控器
│   ├── RequestBuilder.js            # 请求构建器
│   ├── RequestRetryManager.js       # 请求重试管理器
│   ├── ResponseParser.js            # 响应解析器
│   └── ServiceLocator.js            # 服务定位器
│
├── 📁 models/                       # 数据模型
│   ├── Account.js                   # 账号数据模型
│   └── Task.js                      # 任务数据模型
│
├── 📁 utils/                        # 工具模块
│   ├── encryption.js                # 加密服务
│   └── errors.js                    # 错误处理模块
│
├── 📁 src/                          # Vue前端源码
│   ├── App.vue                      # 根组件
│   ├── main.js                      # Vue入口
│   ├── components/                  # 可复用组件
│   │   ├── AccountDialog.vue
│   │   └── TaskDialog.vue
│   ├── views/                       # 页面视图
│   │   ├── Dashboard.vue            # 仪表盘
│   │   ├── Accounts.vue             # 账号管理
│   │   ├── Tasks.vue                # 任务管理
│   │   ├── QuickBuy.vue             # 快速抢购
│   │   ├── Settings.vue             # 系统设置
│   │   ├── Logs.vue                 # 日志查看
│   │   └── Performance.vue          # 性能监控
│   ├── layouts/                     # 布局组件
│   │   └── MainLayout.vue
│   └── router/                      # 路由配置
│       └── index.js
│
├── 📁 tests/                        # 测试目录
│   ├── unit/                        # 单元测试
│   │   ├── ConfigManager.test.js
│   │   ├── PerformanceMonitor.test.js
│   │   ├── RequestRetryManager.test.js
│   │   └── TaskExecutor.test.js
│   └── setup.js                     # 测试初始化
│
├── 📁 scripts/                      # 脚本工具
│   └── cleanup.js                   # 项目清理脚本
│
├── 📁 configs/                      # 配置文件目录(运行时生成)
│   ├── global-config.json           # 全局配置
│   └── account_*.json               # 账号配置
│
├── 📁 logs/                         # 日志目录(运行时生成)
│   └── global.log
│
└── 📁 dist/                         # 构建输出目录
    └── 拼多多多账号抢购助手 Setup 3.3.2.exe
```

---

## 🚀 快速开始

### 环境要求

- **Node.js**: >= 16.0.0
- **npm**: >= 8.0.0 或 **yarn**: >= 1.22.0
- **操作系统**: Windows 7+ / macOS 10.10+ / Linux (Ubuntu 16.04+)

### 安装步骤

#### 1. 克隆项目

```bash
git clone <项目地址>
cd pdd-grabber
```

#### 2. 安装依赖

```bash
# 使用 npm
npm install

# 或使用淘宝镜像(国内用户推荐)
npm install --registry=https://registry.npmmirror.com

# 或使用 yarn
yarn install
```

#### 3. 启动应用

```bash
# 开发模式(带热重载)
npm run dev

# 或生产模式
npm start
```

#### 4. 构建应用

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux

# 所有平台
npm run build
```

### 可用脚本

| 命令 | 说明 |
|------|------|
| `npm start` | 启动应用 |
| `npm run dev` | 开发模式(带日志) |
| `npm run build` | 构建所有平台 |
| `npm run build:win` | 构建 Windows 版本 |
| `npm run test` | 运行单元测试 |
| `npm run test:coverage` | 运行测试并生成覆盖率报告 |
| `npm run clean` | 清理构建目录 |

---

## ⚙️ 配置说明

### 全局配置 (global-config.json)

```json
{
  "timeSync": {
    "enabled": true,           // 是否启用时间同步
    "autoSync": true,          // 是否自动同步
    "syncInterval": 5,         // 同步间隔(分钟)
    "lastSync": null,          // 上次同步时间
    "offset": 0,               // 时间偏移量(毫秒)
    "ntpServer": null,         // 当前使用的NTP服务器
    "ntpServers": [            // NTP服务器列表
      "time.windows.com",
      "time.apple.com",
      "pool.ntp.org",
      "cn.pool.ntp.org"
    ]
  },
  "logSettings": {
    "level": "info",           // 日志级别: debug/info/warning/error
    "maxSize": 10,             // 单个日志文件最大大小(MB)
    "maxFiles": 10,            // 最大日志文件数
    "retentionDays": 30        // 日志保留天数
  },
  "version": "3.3.2"
}
```

### 账号配置 (account_xxx.json)

```json
{
  "id": "account_xxx",
  "name": "我的主账号",
  "description": "账号描述",
  "cookie": "完整的Cookie字符串",
  "pdduid": "用户ID",
  "userAgent": "Mozilla/5.0 ...",
  "antiContent": "anti_content值",
  "defaultAddressId": "默认地址ID",
  "defaultGroupId": "153122715481",
  "defaultActivityId": "15082569568",
  "requestSettings": {
    "requestCount": 10,        // 请求次数
    "requestInterval": 500,    // 请求间隔(ms)
    "maxRequestTime": 5000,    // 最大请求时间(ms)
    "timeout": 15000           // 请求超时时间(ms)
  },
  "tasks": [
    {
      "id": "task_xxx",
      "name": "抢购iPhone 15",
      "goodsId": "854807475667",
      "skuId": "1815623669404",
      "quantity": 1,
      "time": "20:00:00.500",
      "enabled": true
    }
  ],
  "statistics": {
    "successCount": 5,
    "failCount": 2,
    "totalRequests": 7,
    "lastRunTime": null
  },
  "enabled": true
}
```

### 高级配置建议

#### 抢购场景配置

| 场景 | 请求次数 | 间隔(ms) | 最大时长(ms) |
|------|----------|----------|--------------|
| 普通秒杀 | 10-15 | 300-500 | 5000 |
| 热门商品 | 15-20 | 200-300 | 3000 |
| 测试 | 1-3 | 1000 | 3000 |

#### 双API并发说明

系统默认同时调用两个下单API：
- `https://mobile.yangkeduo.com/proxy/api/api/vancouver/order_and_prepay`
- `https://mobile.yangkeduo.com/proxy/api/order`

两个API并发执行，任一成功即视为下单成功，提高抢购成功率。

#### 时间同步建议

- 抢购前5分钟进行手动同步
- 时间偏移控制在 ±50ms 以内
- 长期运行建议启用5分钟自动同步

---

## 📖 使用教程

### 1️⃣ 首次使用配置

#### 添加账号（推荐方式）

1. 打开应用，进入"账号管理"页面
2. 点击"添加账号"按钮
3. 填写账号名称和描述
4. 点击"登录获取Cookie"按钮
5. 在弹出的登录窗口中完成拼多多登录
6. 系统自动获取并保存Cookie

#### 手动添加账号（备用方式）

1. 使用浏览器登录拼多多网站
2. 按 F12 打开开发者工具
3. 切换到 Network(网络) 标签
4. 刷新页面，找到任意请求
5. 复制请求头中的 Cookie 字段
6. 在添加账号弹窗中粘贴Cookie

### 2️⃣ 添加定时任务

1. 进入"任务管理"页面
2. 点击"添加任务"按钮
3. 填写任务信息:
   - **任务名称**: 便于识别的名称
   - **商品ID**: 拼多多商品ID
   - **SKU ID**: 商品规格ID
   - **抢购时间**: 格式为 `HH:mm:ss.SSS` (如 20:00:00.500)
   - **购买数量**: 1-10
4. 保存任务

### 3️⃣ 快速抢购

1. 进入"快速抢购"页面
2. 选择要使用的账号
3. 输入商品ID和SKU ID
4. 设置购买数量
5. 点击"立即抢购"按钮

### 4️⃣ 时间同步

1. 进入"系统设置" → "时间同步"
2. 点击"立即同步时间"按钮
3. 查看时间偏移量，建议控制在 ±100ms 以内
4. 启用"自动同步"(推荐)
5. 点击"保存自动同步设置"按钮保存配置

### 5️⃣ 监控与日志

- **性能监控**: 进入"性能监控"页面查看实时指标
- **日志查看**: 进入"日志查看"页面查看详细日志
- **日志统计**: 日志总条数固定在左下角显示
- **日志导出**: 在日志页面点击"导出"按钮

---

## 🔧 故障排除

### 常见问题与解决方案

#### Q1: Cookie 无效或过期
**现象**: 提示"Cookie无效"或"登录已过期"

**解决方案**:
1. 使用内置登录窗口重新登录
2. 登录窗口会自动获取包含HttpOnly的有效Cookie
3. 或手动复制浏览器中的新Cookie更新配置

#### Q2: 请求失败或超时
**现象**: 抢购请求失败，提示网络错误

**解决方案**:
1. 检查网络连接是否正常
2. 降低请求频率(增加请求间隔)
3. 更换网络环境(如使用移动数据)
4. 检查是否被防火墙拦截

#### Q3: 时间不同步
**现象**: 抢购时间不准确，错过抢购

**解决方案**:
1. 手动点击"立即同步时间"
2. 检查时区设置是否正确(应为北京时间)
3. 启用"自动同步"功能并保存设置
4. 确保时间偏移在 ±50ms 以内

#### Q4: 被平台检测
**现象**: 频繁出现验证码或账号受限

**解决方案**:
1. 降低请求频率(增加间隔时间)
2. 减少并发请求数量
3. 更换账号或暂停使用一段时间

#### Q5: 应用无法启动
**现象**: 双击应用无反应或报错

**解决方案**:
1. 检查 Node.js 版本是否 >= 16.0.0
2. 删除 `node_modules` 目录重新安装依赖
3. 检查是否有杀毒软件拦截
4. 查看日志文件了解详细错误

#### Q6: 添加账号后输入框无法编辑
**现象**: 删除所有账号后，添加账号弹窗的输入框无法编辑

**解决方案**:
1. 此问题已在最新版本修复
2. 如仍遇到问题，请重启应用后重试

### 日志文件位置

| 操作系统 | 日志路径 |
|----------|----------|
| Windows | `%APPDATA%\pdd-seckill-assistant\logs\` |
| macOS | `~/Library/Application Support/pdd-seckill-assistant/logs/` |
| Linux | `~/.config/pdd-seckill-assistant/logs/` |

### 联系支持

如遇到无法解决的问题，请:
1. 查看应用日志获取详细错误信息
2. 提交 Issue 到项目仓库
3. 提供操作系统版本、应用版本、错误截图等信息

---

## ⚠️ 免责声明

**重要提示**: 本工具仅供学习研究使用，请遵守以下原则:

1. **合规使用**: 遵守拼多多用户协议和相关法律法规
2. **风险自负**: 使用本工具可能导致账号被封禁，风险由用户自行承担
3. **禁止商用**: 不得用于商业用途或非法牟利
4. **隐私保护**: 妥善保管 Cookie 等敏感信息，不要泄露给他人
5. **合理使用**: 避免频繁请求，不要对平台造成过大压力
6. **及时停止**: 如平台明令禁止此类工具，请立即停止使用

**作者不对因使用本工具造成的任何损失负责，包括但不限于:**
- 账号被封禁或限制
- 经济损失
- 法律纠纷

---

## 📝 更新日志

### v3.3.2 (2024-02)
- ✨ 新增双API并发请求功能，同时调用两个下单接口提高成功率
- ✨ 优化Cookie获取机制，使用Electron session API获取HttpOnly Cookie
- ✨ 登录窗口支持同时打开多个独立窗口
- ✨ 添加账号时Cookie改为可选，支持登录后自动获取
- 🐛 修复删除所有账号后添加账号输入框无法编辑的问题
- 🐛 修复时间同步设置保存按钮失效问题
- 🐛 修复日志显示换行问题，改为单行显示
- 🐛 修复日志统计栏位置问题，固定在左下角
- 🐛 优化日志容器高度，调整边框间距
- 🐛 优化响应解析逻辑，支持error_payload链式错误信息提取
- 🗑️ 移除设备指纹功能及相关代码
- 📚 更新文档和配置说明

### v3.3.1 (2024-02)
- ✨ 新增NTP时间同步功能，支持多服务器自动切换
- ✨ 侧边栏固定，内容区独立滚动
- ✨ 账号卡片按钮优化，使用图标按钮组
- ✨ 支持同时打开多个独立登录窗口
- ✨ 登录窗口新增开发者工具和清除缓存功能
- ✨ 设备指纹策略优化（仅在登录阶段使用）
- 🐛 修复终端中文乱码问题
- 🐛 修复参数提取机制
- 📚 更新文档和配置说明

### v3.3.0 (2024-02)
- ✨ 全新 Vue 3 + Element Plus 界面
- ✨ 新增性能监控面板
- ✨ 新增设备指纹轮换功能
- ✨ 重构任务执行器，代码更清晰
- ✨ 新增请求重试管理器
- ✨ 新增配置热更新功能
- 🐛 修复多个已知问题
- 📚 完善文档和注释

### v3.2.0
- ✨ 全新界面设计，更加直观易用
- ✨ 改进的任务成功/失败识别机制
- ✨ 实时日志系统
- ✨ 优化的设备指纹生成算法
- 🐛 修复多个已知问题和稳定性改进

### v3.0.0
- 🎉 首次发布
- ✨ 多账号管理功能
- ✨ 毫秒级定时任务
- ✨ 设备指纹伪装
- ✨ 自动时间同步

---

## 🤝 贡献指南

欢迎提交 Pull Request 和 Issue!

### 开发流程

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

### 代码规范

- 遵循 ESLint 规范
- 添加必要的代码注释
- 编写单元测试
- 更新相关文档

---

## 📄 许可证

本项目基于 [MIT License](./LICENSE) 开源协议。

---

## 💖 致谢

感谢所有贡献者和用户的支持!

如果本项目对您有帮助，请给个 ⭐ Star 支持一下!

---

**⚠️ 再次提醒: 请合理使用本工具，遵守平台规则，仅供学习交流，风险自负。**
