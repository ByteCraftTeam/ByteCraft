import { AgentLoop } from "../src/utils/agent-loop.js";

/**
 * 简单的AgentLoop测试
 */
async function testAgentLoop() {
  console.log('🧪 开始测试 AgentLoop...');
  
  try {
    // 创建AgentLoop实例
    const agentLoop = new AgentLoop();
    
    // 检查初始化状态
    console.log('✅ AgentLoop 初始化状态:', agentLoop.isReady());
    
    // 创建新会话
    const sessionId = await agentLoop.createNewSession();
    console.log('✅ 创建新会话:', sessionId?.slice(0, 8));
    
    // 获取当前会话ID
    const currentSessionId = agentLoop.getCurrentSessionId();
    console.log('✅ 当前会话ID:', currentSessionId?.slice(0, 8));
    
    // 获取会话列表
    const sessions = await agentLoop.listSessions();
    console.log('✅ 会话列表长度:', sessions.length);
    
    // 测试会话存在性检查
    const exists = await agentLoop.sessionExists(sessionId!);
    console.log('✅ 会话存在性检查:', exists);
    
    // 获取会话信息
    const sessionInfo = await agentLoop.getSessionInfo(sessionId!);
    console.log('✅ 会话信息:', sessionInfo?.title);
    
    // 获取对话历史
    const history = await agentLoop.getCurrentSessionHistory();
    console.log('✅ 对话历史长度:', history.length);
    
    console.log('🎉 AgentLoop 测试完成！');
    
  } catch (error) {
    console.error('❌ AgentLoop 测试失败:', error);
  }
}

// 如果直接运行此文件，执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  testAgentLoop();
}

export { testAgentLoop }; 