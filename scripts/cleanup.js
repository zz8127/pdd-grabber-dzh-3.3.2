/**
 * 项目清理脚本
 * 删除开发过程中产生的临时文件和目录
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

// 需要清理的文件和目录模式
const patternsToClean = [
  // 日志备份
  'logs/*.log.*',
  'logs/*.old',
  
  // 配置备份（保留最近5个）
  'configs/*.backup.*',
  
  // 临时文件
  '*.tmp',
  '*.temp',
  '*.log',
  
  // 编辑器临时文件
  '*~',
  '*.swp',
  '*.swo',
  '.DS_Store',
  'Thumbs.db',
  
  // 调试文件
  'debug.log',
  'npm-debug.log*',
  'yarn-debug.log*',
  'yarn-error.log*'
];

// 需要保留的文件
const keepPatterns = [
  '.gitignore',
  'README.md',
  'package.json'
];

console.log('========================================');
console.log('  项目清理工具');
console.log('========================================\n');

let cleanedCount = 0;
let errorCount = 0;

/**
 * 递归查找匹配的文件
 */
function findFiles(dir, pattern) {
  const files = [];
  const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // 跳过 node_modules 和 .git
        if (item === 'node_modules' || item === '.git' || item === 'dist') {
          continue;
        }
        files.push(...findFiles(fullPath, pattern));
      } else if (regex.test(item)) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`读取目录失败 ${dir}:`, error.message);
  }
  
  return files;
}

/**
 * 清理配置文件备份（只保留最近5个）
 */
function cleanConfigBackups() {
  const configsDir = path.join(projectRoot, 'configs');
  
  if (!fs.existsSync(configsDir)) {
    return;
  }
  
  try {
    const files = fs.readdirSync(configsDir);
    const backupFiles = files
      .filter(f => f.includes('.backup.'))
      .map(f => ({
        name: f,
        path: path.join(configsDir, f),
        time: parseInt(f.match(/\.backup\.(\d+)$/)?.[1] || 0)
      }))
      .sort((a, b) => b.time - a.time);
    
    // 删除旧备份（保留5个）
    if (backupFiles.length > 5) {
      console.log(`[信息] 发现 ${backupFiles.length} 个配置备份，清理旧备份...`);
      
      for (let i = 5; i < backupFiles.length; i++) {
        try {
          fs.unlinkSync(backupFiles[i].path);
          console.log(`[删除] ${backupFiles[i].name}`);
          cleanedCount++;
        } catch (error) {
          console.error(`[错误] 删除失败 ${backupFiles[i].name}:`, error.message);
          errorCount++;
        }
      }
    }
  } catch (error) {
    console.error('[错误] 清理配置备份失败:', error.message);
  }
}

/**
 * 清理日志文件（只保留最近7天的）
 */
function cleanOldLogs() {
  const logsDir = path.join(projectRoot, 'logs');
  
  if (!fs.existsSync(logsDir)) {
    return;
  }
  
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  
  try {
    const files = fs.readdirSync(logsDir);
    
    for (const file of files) {
      if (file.endsWith('.log')) {
        const filePath = path.join(logsDir, file);
        const stat = fs.statSync(filePath);
        
        // 如果日志文件超过7天且大于10MB，进行清理
        if (stat.mtime.getTime() < sevenDaysAgo && stat.size > 10 * 1024 * 1024) {
          try {
            // 清空文件而不是删除
            fs.writeFileSync(filePath, '');
            console.log(`[清理] 清空旧日志: ${file}`);
            cleanedCount++;
          } catch (error) {
            console.error(`[错误] 清理日志失败 ${file}:`, error.message);
            errorCount++;
          }
        }
      }
    }
  } catch (error) {
    console.error('[错误] 清理日志失败:', error.message);
  }
}

/**
 * 清理临时文件
 */
function cleanTempFiles() {
  const tempPatterns = ['*.tmp', '*.temp', '*~', '*.swp', '*.swo'];
  
  for (const pattern of tempPatterns) {
    const files = findFiles(projectRoot, pattern);
    
    for (const file of files) {
      // 检查是否应该保留
      const fileName = path.basename(file);
      if (keepPatterns.includes(fileName)) {
        continue;
      }
      
      try {
        fs.unlinkSync(file);
        console.log(`[删除] ${path.relative(projectRoot, file)}`);
        cleanedCount++;
      } catch (error) {
        console.error(`[错误] 删除失败 ${file}:`, error.message);
        errorCount++;
      }
    }
  }
}

/**
 * 清理系统文件
 */
function cleanSystemFiles() {
  const systemFiles = ['.DS_Store', 'Thumbs.db'];
  
  for (const fileName of systemFiles) {
    const files = findFiles(projectRoot, fileName);
    
    for (const file of files) {
      try {
        fs.unlinkSync(file);
        console.log(`[删除] ${path.relative(projectRoot, file)}`);
        cleanedCount++;
      } catch (error) {
        console.error(`[错误] 删除失败 ${file}:`, error.message);
        errorCount++;
      }
    }
  }
}

// 执行清理
console.log('[1/4] 清理配置备份...');
cleanConfigBackups();

console.log('\n[2/4] 清理旧日志...');
cleanOldLogs();

console.log('\n[3/4] 清理临时文件...');
cleanTempFiles();

console.log('\n[4/4] 清理系统文件...');
cleanSystemFiles();

// 输出结果
console.log('\n========================================');
console.log('  清理完成');
console.log('========================================');
console.log(`清理文件数: ${cleanedCount}`);
console.log(`错误数: ${errorCount}`);
console.log('');

if (cleanedCount === 0 && errorCount === 0) {
  console.log('项目已经很干净了，无需清理！');
} else if (errorCount === 0) {
  console.log('✅ 清理成功！');
} else {
  console.log('⚠️ 清理完成，但有一些错误');
}

process.exit(errorCount > 0 ? 1 : 0);
