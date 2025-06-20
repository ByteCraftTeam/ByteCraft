import { Logger, LoggerManager, LogLevel } from "../src/utils/logger/logger";
import fs from 'fs';
import path from 'path';

/**
 * Logger测试
 */
async function testLogger() {
  console.log('🧪 开始测试 Logger...');
  
  const testSessionId = 'test-session-123';
  
  try {
    // 测试Logger类
    console.log('\n📝 测试Logger类...');
    const logger = new Logger(testSessionId);
    
    // 测试基本信息
    console.log('✅ Logger创建成功');
    console.log('✅ 日志文件路径:', logger.getLogFilePath());
    console.log('✅ 日志目录路径:', logger.getLogDir());
    console.log('✅ 日志文件存在:', logger.logFileExists());
    
    // 测试不同级别的日志
    logger.info('这是一条信息日志', { userId: 123, action: 'login' });
    logger.warning('这是一条警告日志', '用户权限不足');
    logger.error('这是一条错误日志', new Error('测试错误'));
    
    // 等待文件写入
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 测试读取日志
    const logs = logger.readLogs();
    console.log('✅ 读取日志成功，日志条数:', logs.length);
    
    // 显示最后几条日志
    console.log('\n📋 最近的日志:');
    logs.slice(-3).forEach((log, index) => {
      console.log(`${index + 1}. ${log}`);
    });
    
    // 测试日志文件大小
    const fileSize = logger.getLogFileSize();
    console.log('✅ 日志文件大小:', fileSize, '字节');
    
    // 测试LoggerManager
    console.log('\n📝 测试LoggerManager...');
    const loggerManager = LoggerManager.getInstance();
    
    // 获取logger
    const logger1 = loggerManager.getLogger(testSessionId);
    const logger2 = loggerManager.getLogger('another-session');
    
    console.log('✅ LoggerManager创建logger成功');
    console.log('✅ 活跃logger数量:', loggerManager.getAllLoggers().size);
    
    // 测试日志写入
    logger1.info('通过LoggerManager写入的日志');
    logger2.warning('另一个会话的警告日志');
    
    // 等待文件写入
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 测试移除logger
    loggerManager.removeLogger(testSessionId);
    console.log('✅ 移除logger后数量:', loggerManager.getAllLoggers().size);
    
    // 测试清空所有logger
    loggerManager.clearAllLoggers();
    console.log('✅ 清空后logger数量:', loggerManager.getAllLoggers().size);
    
    console.log('\n🎉 Logger测试完成！');
    
    // 清理测试文件
    console.log('\n🧹 清理测试文件...');
    if (logger.logFileExists()) {
      logger.clearLogs();
      console.log('✅ 测试日志已清理');
    }
    
  } catch (error) {
    console.error('❌ Logger测试失败:', error);
  }
}

/**
 * 测试日志格式
 */
function testLogFormat() {
  console.log('\n🧪 测试日志格式...');
  
  const testSessionId = 'format-test-456';
  const logger = new Logger(testSessionId);
  
  // 测试不同类型的详细信息
  logger.info('简单信息');
  logger.info('带字符串详细信息', '这是一个字符串');
  logger.info('带对象详细信息', { name: 'test', value: 123 });
  logger.info('带数组详细信息', [1, 2, 3, 'test']);
  logger.warning('带错误对象', new Error('测试错误对象'));
  logger.error('带复杂对象', { 
    error: new Error('嵌套错误'),
    data: { nested: { value: 'deep' } }
  });
  
  console.log('✅ 日志格式测试完成');
}

// 如果直接运行此文件，执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  testLogger().then(() => {
    testLogFormat();
  });
}

export { testLogger, testLogFormat }; 