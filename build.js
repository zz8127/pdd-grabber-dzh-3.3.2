const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('  拼多多多账号抢购助手 - 打包工具');
console.log('========================================\n');

// 获取命令行参数
const args = process.argv.slice(2);
const platform = args[0] || 'win';

// 支持的打包平台
const platforms = {
    'win': { name: 'Windows', cmd: 'win' },
    'mac': { name: 'macOS', cmd: 'mac' },
    'linux': { name: 'Linux', cmd: 'linux' },
    'all': { name: '所有平台', cmd: '' }
};

// 检查平台参数
if (!platforms[platform]) {
    console.log('用法: node build.js [平台]');
    console.log('\n支持的平台:');
    Object.keys(platforms).forEach(key => {
        console.log(`  ${key.padEnd(6)} - ${platforms[key].name}`);
    });
    console.log('\n示例:');
    console.log('  node build.js win    # 打包 Windows 版本');
    console.log('  node build.js mac    # 打包 macOS 版本');
    console.log('  node build.js all    # 打包所有平台');
    process.exit(1);
}

// 检查node_modules
if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
    console.error('[错误] 未找到 node_modules 目录');
    console.log('请先运行: npm install\n');
    process.exit(1);
}

// 检查electron-builder
if (!fs.existsSync(path.join(__dirname, 'node_modules', '.bin', 'electron-builder.cmd'))) {
    console.error('[错误] 未找到 electron-builder');
    console.log('请先运行: npm install\n');
    process.exit(1);
}

// 检查并清理旧的构建目录
const distPath = path.join(__dirname, 'dist');
let distLocked = false;

if (fs.existsSync(distPath)) {
    console.log('[信息] 检测到旧的构建目录，尝试清理...');
    
    // 尝试终止可能占用文件的进程
    try {
        if (process.platform === 'win32') {
            execSync('taskkill /F /IM electron.exe 2>nul', { stdio: 'ignore' });
            execSync('taskkill /F /IM app-builder.exe 2>nul', { stdio: 'ignore' });
        }
    } catch (e) {
        // 忽略错误
    }
    
    // 等待进程终止
    const start = Date.now();
    while (Date.now() - start < 2000) {
        // 阻塞等待2秒
    }
    
    // 尝试删除目录
    try {
        fs.rmSync(distPath, { recursive: true, force: true });
        console.log('[成功] 清理完成\n');
    } catch (err) {
        console.warn('[警告] 无法删除 dist 目录:', err.message);
        console.log('[提示] 目录可能被其他进程锁定\n');
        distLocked = true;
    }
}

// 如果 dist 目录被锁定，使用临时配置
let buildCmd;
let tempConfigPath = null;
let tempOutputDir = null;

if (distLocked) {
    const timestamp = Date.now();
    tempOutputDir = `dist_build_${timestamp}`;
    console.log(`[信息] 使用备用输出目录: ${tempOutputDir}\n`);
    
    // 创建临时配置文件 (JSON格式)
    tempConfigPath = path.join(__dirname, `electron-builder-${timestamp}.json`);
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    const originalConfig = packageJson.build;
    const tempConfig = {
        ...originalConfig,
        directories: {
            ...originalConfig.directories,
            output: tempOutputDir
        }
    };
    
    // 写入临时配置文件
    fs.writeFileSync(tempConfigPath, JSON.stringify(tempConfig, null, 2));
    
    // 构建命令使用临时配置
    const platformCmd = platforms[platform].cmd;
    buildCmd = `npx electron-builder --config "${tempConfigPath}"${platformCmd ? ' --' + platformCmd : ''}`;
} else {
    // 使用 package.json 中的配置
    const platformCmd = platforms[platform].cmd;
    buildCmd = `npx electron-builder${platformCmd ? ' --' + platformCmd : ''}`;
}

// 开始打包
console.log(`[信息] 开始打包 ${platforms[platform].name} 版本...\n`);
console.log(`[命令] ${buildCmd}\n`);

try {
    execSync(buildCmd, {
        stdio: 'inherit',
        cwd: __dirname,
        shell: true,
        env: {
            ...process.env,
            ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES: 'true'
        }
    });

    console.log('\n========================================');
    console.log('[成功] 打包完成！');
    console.log('========================================\n');

    // 确定输出目录
    let finalDistPath;
    let outputDirName;
    if (distLocked && tempOutputDir) {
        finalDistPath = path.join(__dirname, tempOutputDir);
        outputDirName = tempOutputDir;
    } else {
        finalDistPath = distPath;
        outputDirName = 'dist';
    }
    
    if (fs.existsSync(finalDistPath)) {
        console.log(`输出目录: ${outputDirName}/`);
        console.log('\n生成的文件:');
        
        const files = fs.readdirSync(finalDistPath);
        if (files.length === 0) {
            console.log('  (目录为空)');
        } else {
            files.forEach(file => {
                const filePath = path.join(finalDistPath, file);
                const stats = fs.statSync(filePath);
                const size = formatFileSize(stats.size);
                const type = stats.isDirectory() ? '<DIR>' : '     ';
                console.log(`  ${type} ${file.padEnd(40)} ${size}`);
            });
        }
        console.log('');
        
        // 如果使用了备用目录，提示用户
        if (distLocked) {
            console.log('[提示] 由于 dist 目录被锁定，使用了备用输出目录');
            console.log('[建议] 您可以手动删除或重命名被锁定的 dist 目录');
            console.log('');
        }
    }

    // 清理临时配置文件
    if (tempConfigPath && fs.existsSync(tempConfigPath)) {
        fs.unlinkSync(tempConfigPath);
    }

} catch (error) {
    // 清理临时配置文件
    if (tempConfigPath && fs.existsSync(tempConfigPath)) {
        fs.unlinkSync(tempConfigPath);
    }
    
    console.error('\n========================================');
    console.error('[错误] 打包失败！');
    console.error('========================================\n');
    console.error('错误信息:', error.message);
    console.log('\n可能的解决方案:');
    console.log('  1. 确保已安装所有依赖: npm install');
    console.log('  2. 检查 package.json 中的 build 配置');
    console.log('  3. 确保有足够的磁盘空间');
    console.log('  4. 检查是否有杀毒软件阻止了打包过程');
    console.log('  5. 关闭所有正在运行的应用实例');
    console.log('  6. 手动删除 dist 目录后重试');
    console.log('  7. 重启电脑后重试\n');
    process.exit(1);
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
