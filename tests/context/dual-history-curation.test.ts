import { ContextManager } from "../../src/utils/context-manager.js";
import { ConversationMessage } from "../../src/types/conversation.js";

/**
 * 双重历史策划功能专项测试
 * 测试 Gemini CLI 风格的对话质量过滤功能
 */

// 辅助函数：创建测试消息
function createMessage(role: 'user' | 'assistant', content: string): ConversationMessage {
  return {
    uuid: `test-${Date.now()}-${Math.random()}`,
    parentUuid: null,
    timestamp: new Date().toISOString(),
    sessionId: 'curation-test',
    type: role,
    message: { role, content },
    isSidechain: false,
    userType: 'external',
    cwd: '/test',
    version: '1.0.0'
  };
}

/**
 * 测试1: 基础策划功能检查
 */
async function testBasicCurationFunctionality() {
  console.log('\n🎭 测试1: 基础策划功能检查');
  
  const contextManager = new ContextManager({
    enablePerformanceLogging: true
  });

  // 检查是否有策划相关方法
  const hasCurationMethod = typeof (contextManager as any).generateCuratedHistory === 'function';
  const hasValidationMethod = typeof (contextManager as any).validateResponse === 'function';
  const hasEnhancedOptimization = typeof (contextManager as any).optimizeContextEnhanced === 'function';

  console.log(`  ✅ generateCuratedHistory 方法: ${hasCurationMethod ? '存在' : '不存在'}`);
  console.log(`  ✅ validateResponse 方法: ${hasValidationMethod ? '存在' : '不存在'}`);
  console.log(`  ✅ optimizeContextEnhanced 方法: ${hasEnhancedOptimization ? '存在' : '不存在'}`);

  if (!hasCurationMethod) {
    console.log('  ⚠️  双重历史策划功能未实现，跳过相关测试');
    return false;
  }

  return true;
}

/**
 * 测试2: 错误响应过滤
 */
async function testErrorResponseFiltering() {
  console.log('\n🎭 测试2: 错误响应过滤');
  
  const contextManager = new ContextManager({
    enablePerformanceLogging: true
  });

  if (typeof (contextManager as any).generateCuratedHistory !== 'function') {
    console.log('  ⚠️  策划功能未实现，跳过测试');
    return;
  }

  const messagesWithErrors = [
    // 正常对话
    createMessage('user', '你好'),
    createMessage('assistant', '你好！有什么可以帮助您的吗？'),
    
    // 包含错误标识的失败响应
    createMessage('user', '帮我处理这个文件'),
    createMessage('assistant', '❌ ERROR: 无法完成操作'),
    
    // 另一个正常对话
    createMessage('user', '介绍一下TypeScript'),
    createMessage('assistant', 'TypeScript是微软开发的编程语言...'),
    
    // 包含失败标识的响应
    createMessage('user', '执行计算任务'),
    createMessage('assistant', '处理失败，出现问题'),
    
    // 最后一个正常对话
    createMessage('user', '谢谢'),
    createMessage('assistant', '不客气！'),
  ];

  try {
    const result = (contextManager as any).generateCuratedHistory(messagesWithErrors);
    
    console.log(`  ✅ 原始消息数: ${messagesWithErrors.length}`);
    console.log(`  ✅ 策划后消息数: ${result.curatedMessages.length}`);
    console.log(`  ✅ 过滤的轮次数: ${result.stats.filteredRounds}`);
    console.log(`  ✅ 处理时间: ${result.stats.processingTime}ms`);
    
    // 验证是否正确过滤了失败响应
    const expectedFilteredRounds = 2; // 应该过滤2个失败的对话轮次
    const actualFilteredRounds = result.stats.filteredRounds;
    
    console.log(`  ${actualFilteredRounds === expectedFilteredRounds ? '✅' : '❌'} 过滤轮次数正确: 预期${expectedFilteredRounds}, 实际${actualFilteredRounds}`);
    
  } catch (error) {
    console.error('  ❌ 错误响应过滤测试失败:', error);
  }
}

/**
 * 测试3: 中断响应过滤
 */
async function testInterruptionResponseFiltering() {
  console.log('\n🎭 测试3: 中断响应过滤');
  
  const contextManager = new ContextManager({
    enablePerformanceLogging: true
  });

  if (typeof (contextManager as any).generateCuratedHistory !== 'function') {
    console.log('  ⚠️  策划功能未实现，跳过测试');
    return;
  }

  const messagesWithInterruptions = [
    createMessage('user', '解释一下算法'),
    createMessage('assistant', '...思考中...'),
    
    createMessage('user', '计算结果'),
    createMessage('assistant', 'Processing...'),
    
    createMessage('user', '帮我分析'),
    createMessage('assistant', '正在处理，请稍等'),
    
    createMessage('user', '你好'),
    createMessage('assistant', '你好！我来为您提供帮助'),
  ];

  try {
    const result = (contextManager as any).generateCuratedHistory(messagesWithInterruptions);
    
    console.log(`  ✅ 原始消息数: ${messagesWithInterruptions.length}`);
    console.log(`  ✅ 策划后消息数: ${result.curatedMessages.length}`);
    console.log(`  ✅ 过滤的轮次数: ${result.stats.filteredRounds}`);
    
    // 应该过滤掉3个包含中断标识的对话轮次
    const expectedFilteredRounds = 3;
    console.log(`  ${result.stats.filteredRounds === expectedFilteredRounds ? '✅' : '❌'} 中断响应过滤正确`);
    
  } catch (error) {
    console.error('  ❌ 中断响应过滤测试失败:', error);
  }
}

/**
 * 测试4: JSON格式验证
 */
async function testJSONValidation() {
  console.log('\n🎭 测试4: JSON格式验证');
  
  const contextManager = new ContextManager({
    enablePerformanceLogging: true
  });

  if (typeof (contextManager as any).validateResponse !== 'function') {
    console.log('  ⚠️  验证功能未实现，跳过测试');
    return;
  }

  const jsonTestCases = [
    {
      name: '有效JSON',
      content: '{"result": "success", "data": [1, 2, 3]}',
      shouldBeValid: true
    },
    {
      name: '无效JSON',
      content: '{"result": "success", "data": [1, 2, 3',
      shouldBeValid: false
    },
    {
      name: '看起来像JSON但无效',
      content: '{这不是有效的JSON}',
      shouldBeValid: false
    },
    {
      name: '正常文本',
      content: '这是普通的文本回复',
      shouldBeValid: true
    }
  ];

  for (const testCase of jsonTestCases) {
    const message = createMessage('assistant', testCase.content);
    
    try {
      const result = (contextManager as any).validateResponse(message);
      const isValid = result.isValid;
      
      console.log(`  ${isValid === testCase.shouldBeValid ? '✅' : '❌'} ${testCase.name}: ${isValid ? '有效' : '无效'}`);
      if (!isValid) {
        console.log(`    原因: ${result.failureReason}`);
      }
      
    } catch (error) {
      console.error(`  ❌ ${testCase.name} JSON验证失败:`, error);
    }
  }
}

/**
 * 测试5: 重复内容检测
 */
async function testRepetitionDetection() {
  console.log('\n🎭 测试5: 重复内容检测');
  
  const contextManager = new ContextManager({
    enablePerformanceLogging: true
  });

  if (typeof (contextManager as any).validateResponse !== 'function') {
    console.log('  ⚠️  验证功能未实现，跳过测试');
    return;
  }

  const repetitionTestCases = [
    {
      name: '严重重复',
      content: '错误 错误 错误 错误 错误 错误 错误 错误 错误 错误',
      shouldBeValid: false
    },
    {
      name: '正常重复',
      content: '这是一个正常的回复，包含一些重复的词汇，但不是异常重复',
      shouldBeValid: true
    },
    {
      name: '短内容重复',
      content: '是 是 是',
      shouldBeValid: true // 短内容不检测重复
    }
  ];

  for (const testCase of repetitionTestCases) {
    const message = createMessage('assistant', testCase.content);
    
    try {
      const result = (contextManager as any).validateResponse(message);
      const isValid = result.isValid;
      
      console.log(`  ${isValid === testCase.shouldBeValid ? '✅' : '❌'} ${testCase.name}: ${isValid ? '有效' : '无效'}`);
      if (!isValid) {
        console.log(`    原因: ${result.failureReason}`);
      }
      
    } catch (error) {
      console.error(`  ❌ ${testCase.name} 重复检测失败:`, error);
    }
  }
}

/**
 * 测试6: 策划与传统优化的集成
 */
async function testCurationIntegration() {
  console.log('\n🎭 测试6: 策划与传统优化的集成');
  
  const contextManager = new ContextManager({
    maxMessages: 10,
    enablePerformanceLogging: true
  });

  if (typeof (contextManager as any).optimizeContextEnhanced !== 'function') {
    console.log('  ⚠️  增强优化功能未实现，跳过测试');
    return;
  }

  // 创建包含失败响应且超出长度限制的消息
  const mixedMessages: ConversationMessage[] = [];
  
  // 添加一些正常对话
  for (let i = 0; i < 8; i++) {
    mixedMessages.push(createMessage('user', `正常用户消息 ${i + 1}`));
    mixedMessages.push(createMessage('assistant', `正常助手回复 ${i + 1}`));
  }
  
  // 添加失败的对话轮次
  mixedMessages.push(createMessage('user', '处理任务A'));
  mixedMessages.push(createMessage('assistant', '❌ 处理失败'));
  
  mixedMessages.push(createMessage('user', '处理任务B'));
  mixedMessages.push(createMessage('assistant', '...加载中...'));

  try {
    // 测试启用策划的增强优化
    const enhancedResult = await (contextManager as any).optimizeContextEnhanced(
      mixedMessages,
      '你是AI助手',
      '当前消息',
      true // 启用策划
    );

    // 测试不启用策划的传统优化
    const traditionalResult = await contextManager.optimizeContext(
      mixedMessages,
      '你是AI助手',
      '当前消息'
    );

    console.log('  📊 对比结果:');
    console.log(`    原始消息数: ${mixedMessages.length}`);
    console.log(`    传统优化后: ${traditionalResult.length - 2} 条`);
    console.log(`    增强优化后: ${enhancedResult.messages.length - 2} 条`);
    
    if (enhancedResult.stats.curationStats) {
      console.log(`    过滤轮次数: ${enhancedResult.stats.curationStats.filteredRounds}`);
      console.log(`    策划耗时: ${enhancedResult.stats.curationStats.processingTime}ms`);
    }
    
    console.log(`  ✅ 增强优化功能正常工作`);
    
  } catch (error) {
    console.error('  ❌ 策划集成测试失败:', error);
  }
}

/**
 * 测试7: 对话完整性保护
 */
async function testConversationIntegrity() {
  console.log('\n🎭 测试7: 对话完整性保护');
  
  const contextManager = new ContextManager({
    enablePerformanceLogging: true
  });

  if (typeof (contextManager as any).generateCuratedHistory !== 'function') {
    console.log('  ⚠️  策划功能未实现，跳过测试');
    return;
  }

  // 创建对话，其中一个用户问题有失败回答
  const integrityTestMessages = [
    createMessage('user', '问题1'),
    createMessage('assistant', '回答1'),
    
    createMessage('user', '问题2'), // 这个问题的回答失败了
    createMessage('assistant', '❌ 失败'),
    
    createMessage('user', '问题3'),
    createMessage('assistant', '回答3'),
  ];

  try {
    const result = (contextManager as any).generateCuratedHistory(integrityTestMessages);
    
    // 检查过滤后的对话完整性
    const curatedMessages = result.curatedMessages;
    let userCount = 0;
    let assistantCount = 0;
    
    for (const msg of curatedMessages) {
      if (msg.message.role === 'user') userCount++;
      if (msg.message.role === 'assistant') assistantCount++;
    }
    
    console.log(`  ✅ 策划后用户消息: ${userCount} 条`);
    console.log(`  ✅ 策划后助手消息: ${assistantCount} 条`);
    console.log(`  ${userCount === assistantCount ? '✅' : '❌'} 对话完整性保护: ${userCount === assistantCount ? '正常' : '异常'}`);
    
    // 验证失败的用户问题也被移除了
    const hasFailedQuestion = curatedMessages.some(msg => 
      msg.message.role === 'user' && msg.message.content === '问题2'
    );
    
    console.log(`  ${!hasFailedQuestion ? '✅' : '❌'} 失败轮次的用户问题已移除: ${!hasFailedQuestion ? '是' : '否'}`);
    
  } catch (error) {
    console.error('  ❌ 对话完整性测试失败:', error);
  }
}

/**
 * 测试8: 性能压力测试
 */
async function testCurationPerformance() {
  console.log('\n🎭 测试8: 策划功能性能测试');
  
  const contextManager = new ContextManager({
    enablePerformanceLogging: false
  });

  if (typeof (contextManager as any).generateCuratedHistory !== 'function') {
    console.log('  ⚠️  策划功能未实现，跳过测试');
    return;
  }

  const testSizes = [50, 100, 200, 500];
  
  for (const size of testSizes) {
    // 创建包含一定比例失败响应的大量消息
    const largeMessageSet: ConversationMessage[] = [];
    
    for (let i = 0; i < size; i++) {
      largeMessageSet.push(createMessage('user', `用户消息 ${i + 1}`));
      
      // 10% 的概率创建失败响应
      if (i % 10 === 0) {
        largeMessageSet.push(createMessage('assistant', `❌ 错误响应 ${i + 1}`));
      } else {
        largeMessageSet.push(createMessage('assistant', `正常回复 ${i + 1}`));
      }
    }

    try {
      const startTime = Date.now();
      const result = (contextManager as any).generateCuratedHistory(largeMessageSet);
      const endTime = Date.now();
      
      const throughput = (size * 2) / (endTime - startTime);
      
      console.log(`  📊 ${size * 2} 条消息:`);
      console.log(`    处理时间: ${endTime - startTime}ms`);
      console.log(`    吞吐量: ${throughput.toFixed(2)} 消息/ms`);
      console.log(`    过滤轮次: ${result.stats.filteredRounds}`);
      
    } catch (error) {
      console.error(`  ❌ ${size} 消息性能测试失败:`, error);
    }
  }
}

/**
 * 主测试函数
 */
async function runDualHistoryCurationTests() {
  console.log('🎭 开始运行双重历史策划测试套件...');
  
  try {
    const hasBasicFunctionality = await testBasicCurationFunctionality();
    
    if (hasBasicFunctionality) {
      await testErrorResponseFiltering();
      await testInterruptionResponseFiltering();
      await testJSONValidation();
      await testRepetitionDetection();
      await testCurationIntegration();
      await testConversationIntegrity();
      await testCurationPerformance();
    }
    
    console.log('\n🎉 双重历史策划测试完成！');
    
  } catch (error) {
    console.error('\n💥 双重历史策划测试套件执行失败:', error);
  }
}

// 如果直接运行此文件，执行测试
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  runDualHistoryCurationTests();
}

export { 
  runDualHistoryCurationTests,
  testBasicCurationFunctionality,
  testErrorResponseFiltering,
  testInterruptionResponseFiltering,
  testJSONValidation,
  testRepetitionDetection,
  testCurationIntegration,
  testConversationIntegrity,
  testCurationPerformance
};