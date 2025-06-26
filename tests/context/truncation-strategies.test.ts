import { ContextManager } from "../../src/utils/context-manager.js";
import { ConversationMessage } from "../../src/types/conversation.js";

/**
 * 三种截断策略专项测试
 * 详细对比 simple_sliding_window, smart_sliding_window, importance_based 三种策略
 */

// 辅助函数：创建测试消息
function createMessage(role: 'user' | 'assistant' | 'system', content: string, timestamp?: string): ConversationMessage {
  return {
    uuid: `test-${Date.now()}-${Math.random()}`,
    parentUuid: null,
    timestamp: timestamp || new Date().toISOString(),
    sessionId: 'truncation-test',
    type: role,
    message: { role, content },
    isSidechain: false,
    userType: 'external',
    cwd: '/test',
    version: '1.0.0'
  };
}

// 辅助函数：创建有特定特征的消息集合
function createTestMessageSet(): ConversationMessage[] {
  const messages: ConversationMessage[] = [];
  
  // 1. 包含重要关键词的消息
  messages.push(createMessage('user', '这是一个重要的error需要修复'));
  messages.push(createMessage('assistant', '我来帮你分析这个错误'));
  
  // 2. 普通对话
  messages.push(createMessage('user', '今天天气怎么样？'));
  messages.push(createMessage('assistant', '今天天气晴朗'));
  
  // 3. 包含配置信息的重要消息
  messages.push(createMessage('user', '帮我setup这个config文件'));
  messages.push(createMessage('assistant', '好的，我来帮你配置'));
  
  // 4. 长消息
  const longContent = '请详细解释这个复杂的概念'.repeat(20);
  messages.push(createMessage('user', longContent));
  messages.push(createMessage('assistant', '这是一个详细的解释...'));
  
  // 5. 包含警告的消息
  messages.push(createMessage('user', '出现了warning需要处理'));
  messages.push(createMessage('assistant', '让我检查一下这个警告'));
  
  // 6. 短消息
  messages.push(createMessage('user', '好'));
  messages.push(createMessage('assistant', '收到'));
  
  // 7. Bug相关的重要消息
  messages.push(createMessage('user', '发现了一个bug需要fix'));
  messages.push(createMessage('assistant', '我来分析这个bug'));
  
  // 8. 普通闲聊
  messages.push(createMessage('user', '你好'));
  messages.push(createMessage('assistant', '你好！'));
  
  return messages;
}

/**
 * 测试1: 简单滑动窗口策略
 */
async function testSimpleSlidingWindow() {
  console.log('\n📊 测试1: Simple Sliding Window 策略');
  
  const contextManager = new ContextManager({
    maxMessages: 8, // 限制为8条消息
    truncationStrategy: 'simple_sliding_window',
    enablePerformanceLogging: true
  });

  const messages = createTestMessageSet();
  console.log(`  原始消息数: ${messages.length}`);
  
  try {
    const startTime = Date.now();
    const optimized = await contextManager.optimizeContext(
      messages,
      '你是AI助手',
      '当前测试消息'
    );
    const endTime = Date.now();

    console.log(`  ✅ 优化后消息数: ${optimized.length - 2} (不含系统和当前消息)`);
    console.log(`  ✅ 处理时间: ${endTime - startTime}ms`);
    
    // 检查是否保留了最近的消息
    const userMessages = optimized.filter(msg => msg.getType() === 'human');
    console.log(`  ✅ 保留的用户消息数: ${userMessages.length}`);
    
  } catch (error) {
    console.error('  ❌ Simple Sliding Window 测试失败:', error);
  }
}

/**
 * 测试2: 智能滑动窗口策略
 */
async function testSmartSlidingWindow() {
  console.log('\n📊 测试2: Smart Sliding Window 策略');
  
  const contextManager = new ContextManager({
    maxMessages: 8,
    truncationStrategy: 'smart_sliding_window',
    systemMessageHandling: 'always_keep',
    enablePerformanceLogging: true
  });

  const messages = createTestMessageSet();
  
  try {
    const startTime = Date.now();
    const optimized = await contextManager.optimizeContext(
      messages,
      '你是智能AI助手',
      '当前测试消息'
    );
    const endTime = Date.now();

    console.log(`  ✅ 优化后消息数: ${optimized.length - 2}`);
    console.log(`  ✅ 处理时间: ${endTime - startTime}ms`);
    
    // 检查系统消息处理
    const systemMessages = optimized.filter(msg => msg.getType() === 'system');
    console.log(`  ✅ 系统消息数: ${systemMessages.length}`);
    
  } catch (error) {
    console.error('  ❌ Smart Sliding Window 测试失败:', error);
  }
}

/**
 * 测试3: 基于重要性的截断策略
 */
async function testImportanceBasedTruncation() {
  console.log('\n📊 测试3: Importance Based 策略');
  
  const contextManager = new ContextManager({
    maxMessages: 8,
    truncationStrategy: 'importance_based',
    enablePerformanceLogging: true
  });

  const messages = createTestMessageSet();
  
  try {
    const startTime = Date.now();
    const optimized = await contextManager.optimizeContext(
      messages,
      '你是AI助手',
      '当前测试消息'
    );
    const endTime = Date.now();

    console.log(`  ✅ 优化后消息数: ${optimized.length - 2}`);
    console.log(`  ✅ 处理时间: ${endTime - startTime}ms`);
    
    // 分析保留的消息内容
    const keptMessages = optimized.slice(1, -1); // 排除系统消息和当前消息
    const importantKeywords = ['error', 'bug', 'fix', 'important', 'warning', 'config', 'setup'];
    
    let importantMessageCount = 0;
    for (const msg of keptMessages) {
      const content = msg.content.toString().toLowerCase();
      if (importantKeywords.some(keyword => content.includes(keyword))) {
        importantMessageCount++;
      }
    }
    
    console.log(`  ✅ 保留的重要消息数: ${importantMessageCount}/${keptMessages.length}`);
    
  } catch (error) {
    console.error('  ❌ Importance Based 测试失败:', error);
  }
}

/**
 * 测试4: 三种策略对比测试
 */
async function testStrategyComparison() {
  console.log('\n📊 测试4: 三种策略对比分析');
  
  const messages = createTestMessageSet();
  const strategies = [
    'simple_sliding_window',
    'smart_sliding_window', 
    'importance_based'
  ] as const;

  const results: Record<string, any> = {};
  
  for (const strategy of strategies) {
    const contextManager = new ContextManager({
      maxMessages: 8,
      truncationStrategy: strategy,
      enablePerformanceLogging: false
    });

    try {
      const startTime = Date.now();
      const optimized = await contextManager.optimizeContext(
        messages,
        '你是AI助手',
        '测试消息'
      );
      const endTime = Date.now();

      // 分析保留的消息特征
      const keptMessages = optimized.slice(1, -1);
      const importantKeywords = ['error', 'bug', 'fix', 'important', 'warning', 'config'];
      
      let importantCount = 0;
      let totalLength = 0;
      
      for (const msg of keptMessages) {
        const content = msg.content.toString();
        totalLength += content.length;
        if (importantKeywords.some(keyword => content.toLowerCase().includes(keyword))) {
          importantCount++;
        }
      }

      results[strategy] = {
        keptCount: keptMessages.length,
        importantCount,
        avgLength: Math.round(totalLength / keptMessages.length),
        processingTime: endTime - startTime
      };
      
    } catch (error) {
      console.error(`  ❌ ${strategy} 对比测试失败:`, error);
    }
  }

  // 输出对比结果
  console.log('\n  📋 策略对比结果:');
  console.log('  策略名称                | 保留消息 | 重要消息 | 平均长度 | 处理时间');
  console.log('  ----------------------|---------|---------|---------|--------');
  
  for (const [strategy, result] of Object.entries(results)) {
    const name = strategy.padEnd(20);
    console.log(`  ${name} | ${result.keptCount.toString().padStart(7)} | ${result.importantCount.toString().padStart(7)} | ${result.avgLength.toString().padStart(7)} | ${result.processingTime.toString().padStart(6)}ms`);
  }
}

/**
 * 测试5: 极限情况下的策略表现
 */
async function testExtremeScenarios() {
  console.log('\n📊 测试5: 极限情况下的策略表现');
  
  const strategies = ['simple_sliding_window', 'smart_sliding_window', 'importance_based'] as const;
  
  // 场景1: 大量消息
  console.log('\n  🔥 场景1: 大量消息 (200条)');
  const manyMessages: ConversationMessage[] = [];
  for (let i = 0; i < 100; i++) {
    manyMessages.push(createMessage('user', `用户消息 ${i + 1}`));
    manyMessages.push(createMessage('assistant', `助手回复 ${i + 1}`));
  }
  
  for (const strategy of strategies) {
    const contextManager = new ContextManager({
      maxMessages: 10,
      truncationStrategy: strategy
    });

    try {
      const startTime = Date.now();
      const optimized = await contextManager.optimizeContext(
        manyMessages,
        '系统提示',
        '当前消息'
      );
      const endTime = Date.now();
      
      console.log(`    ${strategy}: ${optimized.length - 2} 条消息, ${endTime - startTime}ms`);
      
    } catch (error) {
      console.error(`    ❌ ${strategy} 大量消息测试失败:`, error);
    }
  }

  // 场景2: 超长单条消息
  console.log('\n  🔥 场景2: 超长单条消息');
  const longMessage = 'x'.repeat(5000);
  const longMessages = [createMessage('user', longMessage)];
  
  for (const strategy of strategies) {
    const contextManager = new ContextManager({
      maxBytes: 1000, // 1KB限制
      truncationStrategy: strategy
    });

    try {
      const startTime = Date.now();
      const optimized = await contextManager.optimizeContext(
        longMessages,
        '系统提示',
        '当前消息'
      );
      const endTime = Date.now();
      
      console.log(`    ${strategy}: ${optimized.length - 2} 条消息, ${endTime - startTime}ms`);
      
    } catch (error) {
      console.error(`    ❌ ${strategy} 超长消息测试失败:`, error);
    }
  }
}

/**
 * 测试6: 系统消息处理策略对比
 */
async function testSystemMessageHandling() {
  console.log('\n📊 测试6: 系统消息处理策略对比');
  
  const handlingStrategies = ['always_keep', 'smart_merge', 'latest_only'] as const;
  
  // 创建包含多个系统消息的测试数据
  const messages = [
    createMessage('system', '你是第一个系统消息'),
    createMessage('user', '用户消息1'),
    createMessage('assistant', '助手回复1'),
    createMessage('system', '你是第二个系统消息'),
    createMessage('user', '用户消息2'),
    createMessage('assistant', '助手回复2'),
  ];
  
  for (const handling of handlingStrategies) {
    const contextManager = new ContextManager({
      systemMessageHandling: handling,
      truncationStrategy: 'smart_sliding_window',
      enablePerformanceLogging: true
    });

    try {
      const optimized = await contextManager.optimizeContext(
        messages,
        '主系统提示',
        '当前消息'
      );
      
      const systemCount = optimized.filter(msg => msg.getType() === 'system').length;
      console.log(`  ✅ ${handling}: 系统消息数 = ${systemCount}`);
      
    } catch (error) {
      console.error(`  ❌ ${handling} 系统消息处理测试失败:`, error);
    }
  }
}

/**
 * 主测试函数
 */
async function runTruncationStrategyTests() {
  console.log('✂️  开始运行截断策略测试套件...');
  
  try {
    await testSimpleSlidingWindow();
    await testSmartSlidingWindow(); 
    await testImportanceBasedTruncation();
    await testStrategyComparison();
    await testExtremeScenarios();
    await testSystemMessageHandling();
    
    console.log('\n🎉 截断策略测试完成！');
    
  } catch (error) {
    console.error('\n💥 截断策略测试套件执行失败:', error);
  }
}

// 如果直接运行此文件，执行测试
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  runTruncationStrategyTests();
}

export { 
  runTruncationStrategyTests,
  testSimpleSlidingWindow,
  testSmartSlidingWindow,
  testImportanceBasedTruncation,
  testStrategyComparison,
  testExtremeScenarios,
  testSystemMessageHandling
};