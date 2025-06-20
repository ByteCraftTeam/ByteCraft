import { LoggerManager } from './src/utils/logger/logger.js';
import { FileManagerTool } from './src/utils/tools/file-manager.js';

async function testLogger() {
  console.log('🧪 测试Logger和工具...');
  
  // 测试Logger
  const loggerManager = LoggerManager.getInstance();
  const logger = loggerManager.getLogger('test-session');
  
  logger.info('测试开始', { timestamp: new Date().toISOString() });
  logger.warning('测试警告', { test: true });
  logger.error('测试错误', { error: 'test error' });
  
  // 测试文件管理工具
  const fileManager = new FileManagerTool();
  
  try {
    const result = await fileManager.call(JSON.stringify({
      action: 'list',
      path: '.'
    }));
    console.log('文件管理工具调用结果:', result);
  } catch (error) {
    console.error('文件管理工具调用失败:', error);
  }
  
  console.log('📁 日志文件路径:', logger.getLogFilePath());
  console.log('📊 日志文件大小:', logger.getLogFileSize(), '字节');
  
  const logs = logger.readLogs();
  console.log('📝 最新日志内容:');
  logs.slice(-5).forEach((log, index) => {
    console.log(`${index + 1}. ${log}`);
  });
  
  console.log('\n✅ 测试完成！');
}

testLogger().catch(console.error); 