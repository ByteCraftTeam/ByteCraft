import { ContextManager } from "../../src/utils/context-manager.js";
import { ConversationMessage } from "../../src/types/conversation.js";

/**
 * 敏感信息过滤专项测试
 * 详细测试各种敏感信息模式的过滤效果
 */

// 辅助函数：创建测试消息
function createMessage(role: 'user' | 'assistant', content: string): ConversationMessage {
  return {
    uuid: `test-${Date.now()}-${Math.random()}`,
    parentUuid: null,
    timestamp: new Date().toISOString(),
    sessionId: 'sensitive-test',
    type: role,
    message: { role, content },
    isSidechain: false,
    userType: 'external',
    cwd: '/test',
    version: '1.0.0'
  };
}

/**
 * 测试1: 基础敏感模式过滤
 */
async function testBasicSensitivePatterns() {
  console.log('\n🔒 测试1: 基础敏感模式过滤');
  
  const contextManager = new ContextManager({
    enableSensitiveFiltering: true,
    enablePerformanceLogging: true
  });

  const testCases = [
    {
      name: 'Password 过滤',
      input: '我的登录密码是 password: mySecretPass123',
      expected: 'password: [FILTERED]'
    },
    {
      name: 'API Key 过滤',
      input: '这是API密钥 api_key: sk-1234567890abcdef',
      expected: 'api_key: [FILTERED]'
    },
    {
      name: 'Access Token 过滤',
      input: '访问令牌 access_token: bearer_xyz789',
      expected: 'access_token: [FILTERED]'
    },
    {
      name: 'Secret 过滤',
      input: '密钥配置 secret: ultra-secret-key',
      expected: 'secret: [FILTERED]'
    },
    {
      name: 'Token 过滤',
      input: '认证令牌 token: jwt.token.here',
      expected: 'token: [FILTERED]'
    }
  ];

  for (const testCase of testCases) {
    const messages = [createMessage('user', testCase.input)];
    
    try {
      const optimized = await contextManager.optimizeContext(
        messages,
        '你是安全的AI助手',
        '测试消息'
      );

      // 检查用户消息是否被过滤（第2个消息，第1个是系统消息）
      const filteredContent = optimized[1].content.toString();
      const isFiltered = filteredContent.includes('[FILTERED]');
      
      console.log(`  ${isFiltered ? '✅' : '❌'} ${testCase.name}: ${isFiltered ? '已过滤' : '未过滤'}`);
      if (isFiltered) {
        console.log(`    原文: ${testCase.input}`);
        console.log(`    过滤后: ${filteredContent}`);
      }
      
    } catch (error) {
      console.error(`  ❌ ${testCase.name} 测试失败:`, error);
    }
  }
}

/**
 * 测试2: 复杂格式的敏感信息
 */
async function testComplexSensitiveFormats() {
  console.log('\n🔒 测试2: 复杂格式的敏感信息');
  
  const contextManager = new ContextManager({
    enableSensitiveFiltering: true,
    enablePerformanceLogging: true
  });

  const complexTestCases = [
    '配置文件中的 API_KEY=sk-proj-abcd1234',
    'Bearer token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    'refresh_token = rt_1234567890abcdef',
    'Authorization: Bearer your-token-here',
    'SECRET_KEY: "your-ultra-secret-key-123"'
  ];

  for (const [index, testInput] of complexTestCases.entries()) {
    const messages = [createMessage('user', testInput)];
    
    try {
      const optimized = await contextManager.optimizeContext(
        messages,
        '你是安全的AI助手',
        '测试消息'
      );

      const filteredContent = optimized[1].content.toString();
      const isFiltered = filteredContent.includes('[FILTERED]');
      
      console.log(`  ${isFiltered ? '✅' : '⚠️'} 复杂格式 ${index + 1}: ${isFiltered ? '已过滤' : '可能遗漏'}`);
      console.log(`    原文: ${testInput}`);
      console.log(`    结果: ${filteredContent}`);
      
    } catch (error) {
      console.error(`  ❌ 复杂格式 ${index + 1} 测试失败:`, error);
    }
  }
}

/**
 * 测试3: 正常内容不被误过滤
 */
async function testNormalContentNotFiltered() {
  console.log('\n🔒 测试3: 正常内容不被误过滤');
  
  const contextManager = new ContextManager({
    enableSensitiveFiltering: true,
    enablePerformanceLogging: true
  });

  const normalTestCases = [
    '我想了解password这个英文单词的含义',
    '请帮我生成一个安全的password策略',
    'API key的最佳实践是什么？',
    '如何安全地存储access token？',
    '讨论一下secret管理的方法',
    '这是一个关于token认证的技术问题'
  ];

  for (const [index, testInput] of normalTestCases.entries()) {
    const messages = [createMessage('user', testInput)];
    
    try {
      const optimized = await contextManager.optimizeContext(
        messages,
        '你是AI助手',
        '测试消息'
      );

      const filteredContent = optimized[1].content.toString();
      const isFiltered = filteredContent.includes('[FILTERED]');
      
      console.log(`  ${!isFiltered ? '✅' : '❌'} 正常内容 ${index + 1}: ${!isFiltered ? '未误过滤' : '被误过滤'}`);
      if (isFiltered) {
        console.log(`    原文: ${testInput}`);
        console.log(`    误过滤结果: ${filteredContent}`);
      }
      
    } catch (error) {
      console.error(`  ❌ 正常内容 ${index + 1} 测试失败:`, error);
    }
  }
}

/**
 * 测试4: 过滤功能开关测试
 */
async function testFilterToggle() {
  console.log('\n🔒 测试4: 过滤功能开关测试');
  
  const testInput = '我的API密钥是 api_key: sk-test123456';
  const messages = [createMessage('user', testInput)];

  // 测试开启过滤
  const contextManagerOn = new ContextManager({
    enableSensitiveFiltering: true
  });

  // 测试关闭过滤
  const contextManagerOff = new ContextManager({
    enableSensitiveFiltering: false
  });

  try {
    // 开启过滤的结果
    const optimizedOn = await contextManagerOn.optimizeContext(
      messages,
      '系统提示',
      '测试消息'
    );
    const contentOn = optimizedOn[1].content.toString();
    const isFilteredOn = contentOn.includes('[FILTERED]');

    // 关闭过滤的结果
    const optimizedOff = await contextManagerOff.optimizeContext(
      messages,
      '系统提示',
      '测试消息'
    );
    const contentOff = optimizedOff[1].content.toString();
    const isFilteredOff = contentOff.includes('[FILTERED]');

    console.log(`  ✅ 过滤开启时: ${isFilteredOn ? '已过滤' : '未过滤'}`);
    console.log(`  ✅ 过滤关闭时: ${isFilteredOff ? '已过滤' : '未过滤'}`);
    console.log(`  ${isFilteredOn && !isFilteredOff ? '✅' : '❌'} 开关功能正常`);
    
  } catch (error) {
    console.error('  ❌ 过滤开关测试失败:', error);
  }
}

/**
 * 测试5: 性能影响测试
 */
async function testFilteringPerformance() {
  console.log('\n🔒 测试5: 过滤功能性能影响');
  
  // 创建包含敏感信息的大量消息
  const sensitiveMessages: ConversationMessage[] = [];
  for (let i = 0; i < 100; i++) {
    sensitiveMessages.push(createMessage('user', `消息${i}: api_key: sk-test${i}`));
    sensitiveMessages.push(createMessage('assistant', `回复${i}: 收到你的消息`));
  }

  const iterations = 5;

  // 测试开启过滤的性能
  const contextManagerOn = new ContextManager({
    enableSensitiveFiltering: true
  });

  let totalTimeOn = 0;
  for (let i = 0; i < iterations; i++) {
    const startTime = Date.now();
    await contextManagerOn.optimizeContext(
      sensitiveMessages,
      '系统提示',
      '测试消息'
    );
    totalTimeOn += Date.now() - startTime;
  }

  // 测试关闭过滤的性能
  const contextManagerOff = new ContextManager({
    enableSensitiveFiltering: false
  });

  let totalTimeOff = 0;
  for (let i = 0; i < iterations; i++) {
    const startTime = Date.now();
    await contextManagerOff.optimizeContext(
      sensitiveMessages,
      '系统提示',
      '测试消息'
    );
    totalTimeOff += Date.now() - startTime;
  }

  const avgTimeOn = totalTimeOn / iterations;
  const avgTimeOff = totalTimeOff / iterations;
  const overhead = ((avgTimeOn - avgTimeOff) / avgTimeOff * 100).toFixed(2);

  console.log(`  ✅ 开启过滤平均时间: ${avgTimeOn.toFixed(2)}ms`);
  console.log(`  ✅ 关闭过滤平均时间: ${avgTimeOff.toFixed(2)}ms`);
  console.log(`  ✅ 性能开销: ${overhead}%`);
}

/**
 * 主测试函数
 */
async function runSensitiveInfoFilterTests() {
  console.log('🔐 开始运行敏感信息过滤测试套件...');
  
  try {
    await testBasicSensitivePatterns();
    await testComplexSensitiveFormats();
    await testNormalContentNotFiltered();
    await testFilterToggle();
    await testFilteringPerformance();
    
    console.log('\n🎉 敏感信息过滤测试完成！');
    
  } catch (error) {
    console.error('\n💥 敏感信息过滤测试套件执行失败:', error);
  }
}

// 如果直接运行此文件，执行测试
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  runSensitiveInfoFilterTests();
}

export { 
  runSensitiveInfoFilterTests,
  testBasicSensitivePatterns,
  testComplexSensitiveFormats,
  testNormalContentNotFiltered,
  testFilterToggle,
  testFilteringPerformance
};