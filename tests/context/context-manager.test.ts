import { ContextManager } from "../../src/utils/context-manager.js";
import { ConversationMessage } from "../../src/types/conversation.js";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";

/**
 * 上下文管理器综合测试套件
 * 测试三种截断策略、敏感信息过滤、双重历史策划等功能
 */

// 辅助函数：创建测试消息
function createTestMessage(role: 'user' | 'assistant' | 'system', content: string, sessionId = 'test-session'): ConversationMessage {
  return {
    uuid: `test-${Date.now()}-${Math.random()}`,
    parentUuid: null,
    timestamp: new Date().toISOString(),
    sessionId,
    type: role,
    message: { role, content },
    isSidechain: false,
    userType: 'external',
    cwd: '/test',
    version: '1.0.0'
  };
}

// 辅助函数：创建大量测试消息
function createBulkMessages(count: number): ConversationMessage[] {
  const messages: ConversationMessage[] = [];
  for (let i = 0; i < count; i++) {
    messages.push(createTestMessage('user', `用户消息 ${i + 1}`));
    messages.push(createTestMessage('assistant', `助手回复 ${i + 1}`));
  }
  return messages;
}

/**
 * 测试1: 基础上下文优化功能
 */
async function testBasicOptimization() {
  console.log('\n🧪 测试1: 基础上下文优化功能');
  
  const contextManager = new ContextManager({
    maxMessages: 10,
    enablePerformanceLogging: true
  });

  const messages = [
    createTestMessage('user', '你好'),
    createTestMessage('assistant', '你好！有什么可以帮助您的吗？'),
    createTestMessage('user', '请介绍一下TypeScript'),
    createTestMessage('assistant', 'TypeScript是微软开发的编程语言...'),
    createTestMessage('user', '谢谢'),
    createTestMessage('assistant', '不客气！'),
  ];

  try {
    const optimized = await contextManager.optimizeContext(
      messages,
      '你是一个有用的AI助手',
      '当前消息'
    );

    console.log(`✅ 原始消息数: ${messages.length}`);
    console.log(`✅ 优化后消息数: ${optimized.length}`);
    console.log(`✅ 系统消息已添加: ${optimized[0].getType() === 'system'}`);
    console.log(`✅ 当前消息已添加: ${optimized[optimized.length - 1].getType() === 'human'}`);
    
  } catch (error) {
    console.error('❌ 基础优化测试失败:', error);
  }
}

/**
 * 测试2: 敏感信息过滤功能
 */
async function testSensitiveInfoFiltering() {
  console.log('\n🧪 测试2: 敏感信息过滤功能');
  
  const contextManager = new ContextManager({
    enableSensitiveFiltering: true,
    enablePerformanceLogging: true
  });

  const sensitiveMessages = [
    createTestMessage('user', '我的密码是 password: 123456'),
    createTestMessage('user', '这是我的API密钥 api_key: sk-1234567890abcdef'),
    createTestMessage('user', '访问令牌 access_token: bearer_token_here'),
    createTestMessage('user', '这是普通消息，没有敏感信息'),
  ];

  try {
    const optimized = await contextManager.optimizeContext(
      sensitiveMessages,
      '你是一个安全的AI助手',
      '当前消息'
    );

    console.log('✅ 敏感信息过滤测试完成');
    console.log(`✅ 处理了 ${sensitiveMessages.length} 条包含敏感信息的消息`);
    
    // 检查是否包含[FILTERED]标记
    const hasFiltered = optimized.some(msg => 
      msg.content.toString().includes('[FILTERED]')
    );
    console.log(`✅ 敏感信息已过滤: ${hasFiltered}`);
    
  } catch (error) {
    console.error('❌ 敏感信息过滤测试失败:', error);
  }
}

/**
 * 测试3: 三种截断策略对比
 */
async function testTruncationStrategies() {
  console.log('\n🧪 测试3: 三种截断策略对比');
  
  // 创建超出限制的消息
  const manyMessages = createBulkMessages(15); // 30条消息，超出限制
  const systemPrompt = '你是一个AI助手';
  const currentMessage = '请总结我们的对话';

  const strategies = ['simple_sliding_window', 'smart_sliding_window', 'importance_based'] as const;
  
  for (const strategy of strategies) {
    console.log(`\n  📊 测试策略: ${strategy}`);
    
    const contextManager = new ContextManager({
      maxMessages: 10,
      truncationStrategy: strategy,
      enablePerformanceLogging: true
    });

    try {
      const startTime = Date.now();
      const optimized = await contextManager.optimizeContext(
        manyMessages,
        systemPrompt,
        currentMessage
      );
      const endTime = Date.now();

      console.log(`  ✅ 原始消息: ${manyMessages.length} → 优化后: ${optimized.length}`);
      console.log(`  ✅ 处理时间: ${endTime - startTime}ms`);
      
    } catch (error) {
      console.error(`  ❌ 策略 ${strategy} 测试失败:`, error);
    }
  }
}

/**
 * 测试4: 双重历史策划功能
 */
async function testDualHistoryCuration() {
  console.log('\n🧪 测试4: 双重历史策划功能');
  
  const contextManager = new ContextManager({
    enablePerformanceLogging: true
  });

  // 创建包含失败响应的对话
  const messagesWithFailures = [
    createTestMessage('user', '你好'),
    createTestMessage('assistant', '你好！有什么可以帮助您的吗？'),
    
    // 失败的对话轮次
    createTestMessage('user', '帮我处理这个文件'),
    createTestMessage('assistant', '❌ ERROR: 无法完成操作'),
    
    createTestMessage('user', '请解释JavaScript'),
    createTestMessage('assistant', 'JavaScript是一种编程语言...'),
    
    // 另一个失败的轮次
    createTestMessage('user', '计算1+1'),
    createTestMessage('assistant', '...思考中...'),
    
    createTestMessage('user', '谢谢'),
    createTestMessage('assistant', '不客气！'),
  ];

  try {
    // 检查是否有generateCuratedHistory方法
    if (typeof (contextManager as any).generateCuratedHistory === 'function') {
      const curationResult = (contextManager as any).generateCuratedHistory(messagesWithFailures);
      
      console.log(`✅ 原始消息数: ${messagesWithFailures.length}`);
      console.log(`✅ 策划后消息数: ${curationResult.curatedMessages.length}`);
      console.log(`✅ 过滤的轮次数: ${curationResult.stats.filteredRounds}`);
      console.log(`✅ 处理时间: ${curationResult.stats.processingTime}ms`);
    } else {
      console.log('⚠️  双重历史策划功能未启用，跳过测试');
    }
    
  } catch (error) {
    console.error('❌ 双重历史策划测试失败:', error);
  }
}

/**
 * 测试5: 性能基准测试
 */
async function testPerformanceBenchmark() {
  console.log('\n🧪 测试5: 性能基准测试');
  
  const contextManager = new ContextManager({
    enablePerformanceLogging: false // 关闭日志以提高测试精度
  });

  const testSizes = [10, 50, 100, 200];
  
  for (const size of testSizes) {
    const messages = createBulkMessages(size);
    const iterations = 5;
    let totalTime = 0;

    console.log(`\n  📏 测试规模: ${size * 2} 条消息`);
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      await contextManager.optimizeContext(
        messages,
        '系统提示',
        '当前消息'
      );
      const endTime = Date.now();
      totalTime += (endTime - startTime);
    }

    const avgTime = totalTime / iterations;
    const throughput = (size * 2) / avgTime;
    
    console.log(`  ✅ 平均处理时间: ${avgTime.toFixed(2)}ms`);
    console.log(`  ✅ 处理吞吐量: ${throughput.toFixed(2)} 消息/ms`);
  }
}

/**
 * 测试6: 边界情况测试
 */
async function testEdgeCases() {
  console.log('\n🧪 测试6: 边界情况测试');
  
  const contextManager = new ContextManager({
    enablePerformanceLogging: true
  });

  // 测试空消息数组
  try {
    const emptyResult = await contextManager.optimizeContext([], '系统提示', '当前消息');
    console.log(`✅ 空消息处理: ${emptyResult.length} 条消息`);
  } catch (error) {
    console.error('❌ 空消息测试失败:', error);
  }

  // 测试超长消息
  try {
    const longMessage = 'x'.repeat(10000);
    const longMessages = [createTestMessage('user', longMessage)];
    const longResult = await contextManager.optimizeContext(longMessages, '系统提示', '当前消息');
    console.log(`✅ 超长消息处理: ${longResult.length} 条消息`);
  } catch (error) {
    console.error('❌ 超长消息测试失败:', error);
  }

  // 测试特殊字符
  try {
    const specialChars = '🚀💻🎯❌✅🔧📊🧪🎉';
    const specialMessages = [createTestMessage('user', specialChars)];
    const specialResult = await contextManager.optimizeContext(specialMessages, '系统提示', '当前消息');
    console.log(`✅ 特殊字符处理: ${specialResult.length} 条消息`);
  } catch (error) {
    console.error('❌ 特殊字符测试失败:', error);
  }
}

/**
 * 主测试函数
 */
async function runAllContextManagerTests() {
  console.log('🎬 开始运行上下文管理器测试套件...\n');
  
  try {
    await testBasicOptimization();
    await testSensitiveInfoFiltering();
    await testTruncationStrategies();
    await testDualHistoryCuration();
    await testPerformanceBenchmark();
    await testEdgeCases();
    
    console.log('\n🎉 所有上下文管理器测试完成！');
    
  } catch (error) {
    console.error('\n💥 测试套件执行失败:', error);
  }
}

// 如果直接运行此文件，执行所有测试
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllContextManagerTests();
}

export { 
  runAllContextManagerTests,
  testBasicOptimization,
  testSensitiveInfoFiltering,
  testTruncationStrategies,
  testDualHistoryCuration,
  testPerformanceBenchmark,
  testEdgeCases
};