import { AgentLoop } from '../utils/agent-loop.js';

async function testWorkflowStreaming() {
  console.log('🧪 测试工作流流式输出功能...\n');
  
  const agentLoop = new AgentLoop('deepseek-v3');
  
  try {
    // 等待初始化
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (!agentLoop.isReady()) {
      console.log('❌ AgentLoop 未初始化完成');
      return;
    }
    
    console.log('✅ AgentLoop 初始化完成\n');
    
    // 测试流式输出
    let tokenCount = 0;
    let toolCallCount = 0;
    
    const result = await agentLoop.processMessage(
      '请帮我写一个简单的 TypeScript 函数来计算斐波那契数列',
      {
        onToken: (token: string) => {
          process.stdout.write(token);
          tokenCount++;
        },
        onToolCall: (toolName: string, args: any) => {
          console.log(`\n🛠️  调用工具: ${toolName}`);
          console.log(`📝  参数: ${JSON.stringify(args, null, 2)}`);
          toolCallCount++;
        },
        onToolResult: (toolName: string, result: any) => {
          console.log(`✅ 工具 ${toolName} 执行完成`);
        },
        onComplete: (finalResponse: string) => {
          console.log(`\n\n🎉 完成！总共输出 ${tokenCount} 个 token，调用 ${toolCallCount} 次工具`);
        },
        onError: (error: Error) => {
          console.error(`❌ 错误: ${error.message}`);
        }
      }
    );
    
    console.log(`\n📝 最终结果: ${result.substring(0, 100)}...`);
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
testWorkflowStreaming().catch(console.error); 