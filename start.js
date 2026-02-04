const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('========================================');
console.log('  拼多多多账号抢购助手 v3.3.0');
console.log('========================================\n');

// 检查node_modules是否存在
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
    console.error('错误: 未找到 node_modules 目录');
    console.log('请先运行: npm install');
    process.exit(1);
}

// 检查electron是否存在
const electronPath = path.join(__dirname, 'node_modules', '.bin', 'electron');
const electronCmdPath = `${electronPath}.cmd`;

const electronExecutable = process.platform === 'win32' ? electronCmdPath : electronPath;

if (!fs.existsSync(electronExecutable)) {
    console.error('错误: 未找到 Electron');
    console.log('请先运行: npm install');
    process.exit(1);
}

console.log('正在启动应用程序...\n');

// 启动Electron - 使用shell选项在Windows上
const options = {
    stdio: 'inherit',
    cwd: __dirname
};

// Windows需要使用shell来执行.cmd文件
if (process.platform === 'win32') {
    options.shell = true;
}

const electron = spawn(electronExecutable, ['.'], options);

electron.on('close', (code) => {
    console.log(`\nElectron 进程退出，退出码: ${code}`);
    if (code !== 0) {
        console.log('\n提示: 如果启动失败，请尝试以下操作:');
        console.log('  1. 删除 node_modules 目录并重新运行 npm install');
        console.log('  2. 检查是否有其他程序占用了相关端口');
        console.log('  3. 查看错误日志了解详细信息');
    }
});

electron.on('error', (err) => {
    console.error('\n启动 Electron 失败:', err.message);
    if (err.message.includes('因为在此系统上禁止运行脚本')) {
        console.log('\n需要设置 PowerShell 执行策略:');
        console.log('  1. 以管理员身份打开 PowerShell');
        console.log('  2. 运行: Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser');
        console.log('  3. 输入 Y 确认');
        console.log('  4. 重新运行 start.bat');
    } else {
        console.log('\n可能的解决方案:');
        console.log('  1. 确保已安装 Node.js (版本 >= 16.0.0)');
        console.log('  2. 运行 npm install 安装依赖');
        console.log('  3. 检查系统环境变量配置');
    }
});

// 处理进程退出
process.on('SIGINT', () => {
    console.log('\n正在关闭应用程序...');
    electron.kill();
    process.exit(0);
});

process.on('SIGTERM', () => {
    electron.kill();
    process.exit(0);
});
