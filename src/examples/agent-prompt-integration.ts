/**
 * ByteCraft Agent 与新 Prompt 系统的集成示例
 * 展示如何将新的 prompt 系统集成到现有的 Agent 中
 */

import { 
  createAgentPromptIntegration, 
  presetConfigs,
  type AgentConfig 
} from '../prompts/index.js';

// 假设这是现有的 Agent 类接口
interface ExistingAgent {
  tools: Array<{ name: string; description: string }>;
  initializeWithSystemMessage(message: string): Promise<void>;
  addMessage(role: string, content: string): void;
  handleToolResult(toolName: string, success: boolean, result?: string, error?: string): void;
}

/**
 * Agent 适配器 - 将新的 prompt 系统适配到现有 Agent
 */
export class AgentPromptAdapter {
  private integration: ReturnType<typeof createAgentPromptIntegration>;
  private agent: ExistingAgent;

  constructor(agent: ExistingAgent, config?: Partial<AgentConfig>) {
    this.agent = agent;
    
    // 创建 prompt 集成，使用预设配置或自定义配置
    this.integration = createAgentPromptIntegration({
      ...presetConfigs.developer,
      ...config
    });
  }

  /**
   * 初始化 Agent 系统消息
   */
  async initialize(): Promise<void> {
    // 获取系统消息
    const systemMessage = await this.integration.initializeSystemMessage(this.agent.tools);
    
    // 应用到现有 Agent
    await this.agent.initializeWithSystemMessage(systemMessage);
  }

  /**
   * 添加文件到对话上下文
   */
  addFilesToChat(files: Array<{ path: string; content: string; readonly?: boolean }>): void {
    const filesMessage = this.integration.formatFilesForChat(files);
    this.agent.addMessage('system', filesMessage);
  }

  /**
   * 处理工具执行结果
   */
  handleToolExecution(toolName: string, success: boolean, result?: string, error?: string): void {
    const resultMessage = this.integration.formatToolResult(toolName, success, result, error);
    this.agent.addMessage('system', resultMessage);
  }

  /**
   * 获取工具帮助信息
   */
  getToolHelp(toolName: string): string {
    return this.integration.getToolHelp(toolName);
  }

  /**
   * 切换工作模式
   */
  switchMode(mode: 'coding' | 'ask' | 'help'): void {
    this.integration.switchMode(mode);
  }

  /**
   * 检查当前模式是否支持某个操作
   */
  canPerformAction(action: 'edit' | 'create' | 'delete' | 'execute' | 'analyze'): boolean {
    return this.integration.canPerformAction(action);
  }
}

/**
 * 使用示例 1: 基本集成
 */
export function exampleBasicIntegration() {
  // 模拟现有的 Agent
  const mockAgent: ExistingAgent = {
    tools: [
      { name: 'file-manager', description: '文件管理工具' },
      { name: 'command-exec', description: '命令执行工具' },
      { name: 'web-search', description: '网络搜索工具' }
    ],
    async initializeWithSystemMessage(message: string) {
      console.log('初始化系统消息:', message.substring(0, 200) + '...');
    },
    addMessage(role: string, content: string) {
      console.log(`添加消息 [${role}]:`, content.substring(0, 100) + '...');
    },
    handleToolResult(toolName: string, success: boolean, result?: string, error?: string) {
      console.log(`工具结果 [${toolName}]:`, success ? '成功' : '失败', result || error);
    }
  };

  // 创建适配器
  const adapter = new AgentPromptAdapter(mockAgent, {
    mode: 'coding',
    projectContext: {
      name: 'ByteCraft',
      type: 'CLI Tool',
      language: 'TypeScript',
      framework: 'Node.js'
    }
  });

  return adapter;
}

/**
 * 使用示例 2: 完整工作流
 */
export async function exampleCompleteWorkflow() {
  console.log('=== 完整工作流示例 ===');
  
  const adapter = exampleBasicIntegration();
  
  // 1. 初始化
  await adapter.initialize();
  
  // 2. 添加文件到对话
  adapter.addFilesToChat([
    {
      path: 'src/index.ts',
      content: 'export * from "./main";\nconsole.log("ByteCraft started");'
    },
    {
      path: 'package.json',
      content: '{"name": "bytecraft", "version": "1.0.0"}',
      readonly: true
    }
  ]);
  
  // 3. 模拟工具执行
  adapter.handleToolExecution('file-manager', true, '文件读取成功');
  adapter.handleToolExecution('command-exec', false, undefined, '权限不足');
  
  // 4. 获取工具帮助
  const fileHelp = adapter.getToolHelp('file-manager');
  console.log('文件管理工具帮助:', fileHelp.substring(0, 100) + '...');
  
  // 5. 检查操作权限
  console.log('可以编辑文件:', adapter.canPerformAction('edit'));
  console.log('可以执行命令:', adapter.canPerformAction('execute'));
  
  // 6. 切换模式
  adapter.switchMode('ask');
  console.log('切换到分析模式后，可以编辑文件:', adapter.canPerformAction('edit'));
}

/**
 * 使用示例 3: 不同预设配置
 */
export function exampleDifferentConfigs() {
  console.log('\n=== 不同配置示例 ===');
  
  const mockAgent: ExistingAgent = {
    tools: [
      { name: 'file-manager', description: '文件管理' },
      { name: 'web-search', description: '网络搜索' }
    ],
    async initializeWithSystemMessage(message: string) {
      console.log('系统消息已设置');
    },
    addMessage() {},
    handleToolResult() {}
  };
  
  // 开发者模式
  const developerAdapter = new AgentPromptAdapter(mockAgent, presetConfigs.developer);
  console.log('开发者模式 - 可以编辑:', developerAdapter.canPerformAction('edit'));
  
  // 分析师模式
  const analystAdapter = new AgentPromptAdapter(mockAgent, presetConfigs.analyst);
  console.log('分析师模式 - 可以编辑:', analystAdapter.canPerformAction('edit'));
  
  // 助手模式
  const assistantAdapter = new AgentPromptAdapter(mockAgent, presetConfigs.assistant);
  console.log('助手模式 - 可以编辑:', assistantAdapter.canPerformAction('edit'));
}

// 导出便捷创建函数
export function createAgentAdapter(
  agent: ExistingAgent, 
  config?: Partial<AgentConfig>
): AgentPromptAdapter {
  return new AgentPromptAdapter(agent, config);
}

// 如果直接运行此文件，执行示例
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🚀 ByteCraft Agent 集成示例\n');
  
  exampleCompleteWorkflow().then(() => {
    exampleDifferentConfigs();
    console.log('\n✅ 所有示例运行完成！');
  });
}
