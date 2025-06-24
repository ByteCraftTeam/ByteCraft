import { AgentLoop, StreamingCallback } from '../utils/agent-loop.js';

/**
 * 测试 AgentLoop 回调功能的演示
 */
async function testAgentLoopCallbacks() {
  console.log('🚀 开始测试 AgentLoop 回调功能...\n');

  // 创建 AgentLoop 实例
  const agentLoop = new AgentLoop('deepseek-v3');
  
  try {
    // 等待初始化完成
    console.log('⏳ 等待 AgentLoop 初始化...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (!agentLoop.isReady()) {
      throw new Error('AgentLoop 初始化失败');
    }
    
    console.log('✅ AgentLoop 初始化完成\n');

    // 测试用例1: 基本对话回调
    console.log('📝 测试用例1: 基本对话回调');
    await testBasicConversation(agentLoop);
    console.log('\n' + '━'.repeat(50) + '\n');

    // 测试用例2: 工具调用回调
    console.log('📝 测试用例2: 工具调用回调');
    await testToolCallbacks(agentLoop);
    console.log('\n' + '━'.repeat(50) + '\n');

    // 测试用例3: 错误处理回调
    console.log('📝 测试用例3: 错误处理回调');
    await testErrorCallbacks(agentLoop);
    console.log('\n' + '━'.repeat(50) + '\n');

    // 测试用例4: 完整流程回调
    console.log('📝 测试用例4: 完整流程回调');
    await testCompleteFlow(agentLoop);

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  } finally {
    console.log('\n🎯 回调功能测试完成！');
  }
}

/**
 * 测试基本对话回调
 */
async function testBasicConversation(agentLoop: AgentLoop) {
  console.log('💬 用户: 你好，请简单介绍一下自己');
  
  let tokenCount = 0;
  let toolCallCount = 0;
  let toolResultCount = 0;
  let completeCalled = false;
  let errorCalled = false;

  const callback: StreamingCallback = {
    onToken: (token: string) => {
      tokenCount++;
      process.stdout.write(token);
    },
    onToolCall: (toolName: string, args: any) => {
      toolCallCount++;
      console.log(`\n🛠️  回调: 工具调用 - ${toolName}`);
      console.log(`📝  回调: 参数 - ${JSON.stringify(args, null, 2)}`);
    },
    onToolResult: (toolName: string, result: any) => {
      toolResultCount++;
      console.log(`\n✅ 回调: 工具结果 - ${toolName}`);
      console.log(`📄 回调: 结果 - ${JSON.stringify(result, null, 2)}`);
    },
    onComplete: (finalResponse: string) => {
      completeCalled = true;
      console.log(`\n🎉 回调: 对话完成`);
      console.log(`📊 回调: 最终回复长度 - ${finalResponse.length} 字符`);
    },
    onError: (error: Error) => {
      errorCalled = true;
      console.log(`\n❌ 回调: 发生错误 - ${error.message}`);
    }
  };

  try {
    const response = await agentLoop.processMessage('你好，请简单介绍一下自己', callback);
    
    console.log('\n📊 回调统计:');
    console.log(`  - Token 回调次数: ${tokenCount}`);
    console.log(`  - 工具调用回调次数: ${toolCallCount}`);
    console.log(`  - 工具结果回调次数: ${toolResultCount}`);
    console.log(`  - 完成回调调用: ${completeCalled}`);
    console.log(`  - 错误回调调用: ${errorCalled}`);
    
  } catch (error) {
    console.error('❌ 基本对话测试失败:', error);
  }
}

/**
 * 测试工具调用回调
 */
async function testToolCallbacks(agentLoop: AgentLoop) {
  console.log('💬 用户: 帮我搜索一下最新的 TypeScript 版本信息');
  
  let toolCallDetails: Array<{name: string, args: any}> = [];
  let toolResultDetails: Array<{name: string, result: any}> = [];

  const callback: StreamingCallback = {
    onToken: (token: string) => {
      process.stdout.write(token);
    },
    onToolCall: (toolName: string, args: any) => {
      toolCallDetails.push({ name: toolName, args });
      console.log(`\n🛠️  回调: 检测到工具调用 - ${toolName}`);
    },
    onToolResult: (toolName: string, result: any) => {
      toolResultDetails.push({ name: toolName, result });
      console.log(`\n✅ 回调: 工具执行完成 - ${toolName}`);
    },
    onComplete: (finalResponse: string) => {
      console.log(`\n🎉 回调: 包含工具调用的对话完成`);
      console.log(`📊 回调: 最终回复长度 - ${finalResponse.length} 字符`);
    },
    onError: (error: Error) => {
      console.log(`\n❌ 回调: 工具调用过程中发生错误 - ${error.message}`);
    }
  };

  try {
    const response = await agentLoop.processMessage('帮我搜索一下最新的 TypeScript 版本信息', callback);
    
    console.log('\n📊 工具调用回调统计:');
    console.log(`  - 工具调用次数: ${toolCallDetails.length}`);
    toolCallDetails.forEach((detail, index) => {
      console.log(`    ${index + 1}. ${detail.name}: ${JSON.stringify(detail.args)}`);
    });
    
    console.log(`  - 工具结果次数: ${toolResultDetails.length}`);
    toolResultDetails.forEach((detail, index) => {
      console.log(`    ${index + 1}. ${detail.name}: 结果长度 ${JSON.stringify(detail.result).length} 字符`);
    });
    
  } catch (error) {
    console.error('❌ 工具调用测试失败:', error);
  }
}

/**
 * 测试错误处理回调
 */
async function testErrorCallbacks(agentLoop: AgentLoop) {
  console.log('💬 用户: 测试错误处理（故意发送空消息）');
  
  let errorDetails: any = null;

  const callback: StreamingCallback = {
    onToken: (token: string) => {
      process.stdout.write(token);
    },
    onToolCall: (toolName: string, args: any) => {
      console.log(`\n🛠️  回调: 工具调用 - ${toolName}`);
    },
    onToolResult: (toolName: string, result: any) => {
      console.log(`\n✅ 回调: 工具结果 - ${toolName}`);
    },
    onComplete: (finalResponse: string) => {
      console.log(`\n🎉 回调: 对话完成`);
    },
    onError: (error: Error) => {
      errorDetails = error;
      console.log(`\n❌ 回调: 错误处理被触发`);
      console.log(`📝 回调: 错误类型 - ${error.constructor.name}`);
      console.log(`📝 回调: 错误消息 - ${error.message}`);
    }
  };

  try {
    // 故意发送空消息来测试错误处理
    const response = await agentLoop.processMessage('', callback);
    
    if (errorDetails) {
      console.log('\n📊 错误处理回调统计:');
      console.log(`  - 错误回调被调用: 是`);
      console.log(`  - 错误类型: ${errorDetails?.constructor?.name || 'Unknown'}`);
      console.log(`  - 错误消息: ${errorDetails?.message || 'Unknown error'}`);
    } else {
      console.log('\n📊 错误处理回调统计:');
      console.log(`  - 错误回调被调用: 否`);
    }
    
  } catch (error) {
    console.log('\n📊 错误处理回调统计:');
    console.log(`  - 错误回调被调用: 是`);
    console.log(`  - 错误类型: ${error instanceof Error ? error.constructor.name : 'Unknown'}`);
    console.log(`  - 错误消息: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 测试完整流程回调
 */
async function testCompleteFlow(agentLoop: AgentLoop) {
  console.log('💬 用户: 请帮我写一个简单的计算器函数，并解释代码');
  
  const flowLog: string[] = [];
  let startTime = Date.now();

  const callback: StreamingCallback = {
    onToken: (token: string) => {
      flowLog.push(`Token: ${token}`);
      process.stdout.write(token);
    },
    onToolCall: (toolName: string, args: any) => {
      flowLog.push(`Tool Call: ${toolName}`);
      console.log(`\n🛠️  流程回调: 工具调用 - ${toolName}`);
    },
    onToolResult: (toolName: string, result: any) => {
      flowLog.push(`Tool Result: ${toolName}`);
      console.log(`\n✅ 流程回调: 工具完成 - ${toolName}`);
    },
    onComplete: (finalResponse: string) => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      flowLog.push(`Complete: ${finalResponse.length} chars`);
      
      console.log(`\n🎉 流程回调: 完整对话流程结束`);
      console.log(`⏱️  流程回调: 总耗时 - ${duration}ms`);
      console.log(`📊 流程回调: 最终回复长度 - ${finalResponse.length} 字符`);
      console.log(`📝 流程回调: 流程步骤数 - ${flowLog.length}`);
      
      console.log('\n📋 完整流程日志:');
      flowLog.forEach((log, index) => {
        console.log(`  ${index + 1}. ${log}`);
      });
    },
    onError: (error: Error) => {
      flowLog.push(`Error: ${error.message}`);
      console.log(`\n❌ 流程回调: 流程中发生错误 - ${error.message}`);
    }
  };

  try {
    const response = await agentLoop.processMessage('请帮我写一个简单的计算器函数，并解释代码', callback);
    
    console.log('\n📊 完整流程测试统计:');
    console.log(`  - 流程步骤总数: ${flowLog.length}`);
    console.log(`  - Token 步骤数: ${flowLog.filter(log => log.startsWith('Token:')).length}`);
    console.log(`  - 工具调用步骤数: ${flowLog.filter(log => log.startsWith('Tool Call:')).length}`);
    console.log(`  - 工具结果步骤数: ${flowLog.filter(log => log.startsWith('Tool Result:')).length}`);
    console.log(`  - 完成步骤: ${flowLog.filter(log => log.startsWith('Complete:')).length}`);
    console.log(`  - 错误步骤: ${flowLog.filter(log => log.startsWith('Error:')).length}`);
    
  } catch (error) {
    console.error('❌ 完整流程测试失败:', error);
  }
}

/**
 * 测试回调性能
 */
async function testCallbackPerformance(agentLoop: AgentLoop) {
  console.log('💬 用户: 测试回调性能（发送长文本）');
  
  const longMessage = '请详细解释一下什么是人工智能，包括其历史发展、主要技术、应用领域、未来趋势等方面。请尽可能详细地回答，包括具体的例子和技术细节。';
  
  let tokenCount = 0;
  let callbackTimes: number[] = [];
  let startTime = Date.now();

  const callback: StreamingCallback = {
    onToken: (token: string) => {
      const callbackTime = Date.now();
      callbackTimes.push(callbackTime);
      tokenCount++;
      process.stdout.write(token);
    },
    onComplete: (finalResponse: string) => {
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      console.log(`\n🎉 性能测试完成`);
      console.log(`⏱️  总耗时: ${totalTime}ms`);
      console.log(`📊 Token 数量: ${tokenCount}`);
      console.log(`📈 平均回调间隔: ${callbackTimes.length > 1 ? 
        (callbackTimes[callbackTimes.length - 1] - callbackTimes[0]) / (callbackTimes.length - 1) : 0}ms`);
    }
  };

  try {
    const response = await agentLoop.processMessage(longMessage, callback);
    
  } catch (error) {
    console.error('❌ 性能测试失败:', error);
  }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  testAgentLoopCallbacks().catch(console.error);
} 