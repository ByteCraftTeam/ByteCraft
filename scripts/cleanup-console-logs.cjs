#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 需要保留的console.log模式（错误、警告等重要日志）
const keepPatterns = [
  /console\.log.*错误|error|Error/i,
  /console\.log.*警告|warning|Warning/i,
  /console\.log.*失败|failed|Failed/i,
  /console\.log.*异常|exception|Exception/i,
  /console\.error/,
  /console\.warn/,
  /console\.info/,
];

// 需要注释的文件目录
const targetDirs = [
  'src/new_ui',
  'src/utils/agent-loop.ts',
];

// 统计信息
let stats = {
  totalFiles: 0,
  modifiedFiles: 0,
  commentedLogs: 0,
  keptLogs: 0,
};

function shouldKeepLog(line) {
  return keepPatterns.some(pattern => pattern.test(line));
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let modified = false;
  
  const processedLines = lines.map(line => {
    // 跳过已经注释的行
    if (line.trim().startsWith('//') || line.trim().startsWith('/*')) {
      return line;
    }
    
    // 检查是否包含console.log
    if (line.includes('console.log')) {
      if (shouldKeepLog(line)) {
        stats.keptLogs++;
        return line; // 保留重要日志
      } else {
        stats.commentedLogs++;
        modified = true;
        // 保持原有缩进并注释
        const indent = line.match(/^(\s*)/)[1];
        const trimmedLine = line.trim();
        return `${indent}// ${trimmedLine}`;
      }
    }
    
    return line;
  });
  
  if (modified) {
    fs.writeFileSync(filePath, processedLines.join('\n'));
    stats.modifiedFiles++;
    console.log(`✓ 已处理: ${filePath}`);
  }
  
  stats.totalFiles++;
}

function processDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.log(`⚠️  目录不存在: ${dirPath}`);
    return;
  }
  
  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const stat = fs.statSync(itemPath);
    
    if (stat.isDirectory()) {
      processDirectory(itemPath);
    } else if (stat.isFile() && /\.(ts|tsx|js|jsx)$/.test(item)) {
      processFile(itemPath);
    }
  }
}

console.log('🧹 开始清理调试日志...\n');

// 处理目标目录和文件
for (const target of targetDirs) {
  const targetPath = path.resolve(target);
  
  if (fs.existsSync(targetPath)) {
    const stat = fs.statSync(targetPath);
    
    if (stat.isDirectory()) {
      console.log(`📁 处理目录: ${target}`);
      processDirectory(targetPath);
    } else if (stat.isFile()) {
      console.log(`📄 处理文件: ${target}`);
      processFile(targetPath);
    }
  } else {
    console.log(`⚠️  路径不存在: ${target}`);
  }
}

console.log('\n📊 清理统计:');
console.log('━'.repeat(30));
console.log(`总文件数: ${stats.totalFiles}`);
console.log(`修改文件数: ${stats.modifiedFiles}`);
console.log(`注释日志数: ${stats.commentedLogs}`);
console.log(`保留日志数: ${stats.keptLogs}`);
console.log('\n✅ 调试日志清理完成！');
console.log('�� 重要的错误和警告日志已保留'); 