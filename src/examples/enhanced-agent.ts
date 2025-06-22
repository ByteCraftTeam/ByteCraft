/**
 * 将新的 Prompt 系统集成到现有 ByteCraft Agent 的示例
 * 这个文件展示了如何在实际的 Agent 中使用新的 prompt 系统
 */

import { createAgentPromptIntegration, presetConfigs, TOOL_NAMES } from '../prompts/index.js';

// 模拟现有的 Agent 接口（基于当前的 ByteCraft 架构）
interface ByteCraftAgent {
  messages: Array<{ role: string; content: string }>;
  tools: Array<{ name: string; description: string }>;
  addMessage(role: string, content: string): void;
  processUserInput(input: string): Promise<string>;
}

/**
 * 增强的 ByteCraft Agent，集成了新的 Prompt 系统
 */
export class EnhancedByteCraftAgent implements ByteCraftAgent {
  public messages: Array<{ role: string; content: string }> = [];
  public tools: Array<{ name: string; description: string }> = [];
  
  private promptIntegration: ReturnType<typeof createAgentPromptIntegration>;
  private currentMode: 'coding' | 'ask' | 'help' = 'coding';

  constructor() {
    // 初始化工具列表
    this.tools = [
      { name: 'file-manager', description: '文件管理工具，用于读写文件' },
      { name: 'command-exec', description: '命令执行工具，用于运行shell命令' },
      { name: 'code-executor', description: '代码执行工具，用于运行代码' },
      { name: 'web-search', description: '网络搜索工具，用于搜索信息' }
    ];

    // 创建 prompt 集成
    this.promptIntegration = createAgentPromptIntegration({
      ...presetConfigs.developer,
      projectContext: {
        name: 'ByteCraft',
        type: 'AI Assistant',
        language: 'TypeScript',
        framework: 'Node.js'
      }
    });
  }

  /**
   * 初始化 Agent
   */
  async initialize(): Promise<void> {
    // 使用新的 prompt 系统生成系统消息
    const systemMessage = await this.promptIntegration.initializeSystemMessage(this.tools);
    
    // 添加系统消息
    this.addMessage('system', systemMessage);
    
    console.log('🤖 ByteCraft Agent 已初始化，使用增强的 Prompt 系统');
  }

  /**
   * 添加消息到对话历史
   */
  addMessage(role: string, content: string): void {
    this.messages.push({ role, content });
  }

  /**
   * 添加文件到对话上下文
   */
  addFilesToContext(files: Array<{ path: string; content: string; readonly?: boolean }>): void {
    const filesMessage = this.promptIntegration.formatFilesForChat(files);
    this.addMessage('system', filesMessage);
    
    console.log(`📁 已添加 ${files.length} 个文件到对话上下文`);
  }

  /**
   * 处理工具执行结果
   */
  handleToolResult(toolName: string, success: boolean, result?: string, error?: string): void {
    const resultMessage = this.promptIntegration.formatToolResult(toolName, success, result, error);
    this.addMessage('system', resultMessage);
    
    const status = success ? '成功' : '失败';
    console.log(`🛠️ 工具 ${toolName} 执行${status}`);
  }

  /**
   * 切换工作模式
   */
  switchMode(mode: 'coding' | 'ask' | 'help'): void {
    this.currentMode = mode;
    this.promptIntegration.switchMode(mode);
    
    const modeNames = {
      coding: '编程模式',
      ask: '分析模式', 
      help: '帮助模式'
    };
    
    console.log(`🔄 已切换到${modeNames[mode]}`);
    
    // 获取模式配置信息
    const config = this.promptIntegration.getModeConfig();
    console.log(`   - 可以编辑文件: ${config.canEditFiles ? '是' : '否'}`);
    console.log(`   - 可以执行命令: ${config.canExecuteCommands ? '是' : '否'}`);
  }

  /**
   * 获取工具使用帮助
   */
  getToolHelp(toolName: string): string {
    return this.promptIntegration.getToolHelp(toolName);
  }

  /**
   * 检查是否可以执行某个操作
   */
  canPerformAction(action: 'edit' | 'create' | 'delete' | 'execute' | 'analyze'): boolean {
    return this.promptIntegration.canPerformAction(action);
  }

  /**
   * 处理用户输入（简化版）
   */
  async processUserInput(input: string): Promise<string> {
    // 添加用户消息
    this.addMessage('user', input);
    
    // 简单的响应逻辑（实际实现中会调用 LLM）
    if (input.includes('帮助') || input.includes('help')) {
      if (this.currentMode !== 'help') {
        this.switchMode('help');
      }
      return '我已切换到帮助模式，现在可以为您解答 ByteCraft 的使用问题。';
    }
    
    if (input.includes('分析') || input.includes('analyze')) {
      if (this.currentMode !== 'ask') {
        this.switchMode('ask');
      }
      return '我已切换到分析模式，现在可以为您分析代码和提供建议。';
    }
    
    if (input.includes('编程') || input.includes('代码') || input.includes('code')) {
      if (this.currentMode !== 'coding') {
        this.switchMode('coding');
      }
      return '我已切换到编程模式，现在可以为您编写和修改代码。';
    }
    
    // 检查操作权限
    if (input.includes('创建文件') || input.includes('修改文件')) {
      if (!this.canPerformAction('edit')) {
        return `当前模式（${this.currentMode}）不支持文件编辑操作。请切换到编程模式。`;
      }
    }
    
    // 模拟 LLM 响应
    const response = `我理解您的请求："${input}"。当前模式：${this.currentMode}`;
    this.addMessage('assistant', response);
    
    return response;
  }

  /**
   * 获取当前状态信息
   */
  getStatus(): string {
    const config = this.promptIntegration.getModeConfig();
    return `
🤖 ByteCraft Agent 状态:
- 当前模式: ${this.currentMode}
- 消息数量: ${this.messages.length}
- 可用工具: ${this.tools.length}
- 文件编辑: ${config.canEditFiles ? '✅' : '❌'}
- 命令执行: ${config.canExecuteCommands ? '✅' : '❌'}
`;
  }
}

/**
 * 使用示例
 */
export async function demonstrateEnhancedAgent() {
  console.log('🚀 ByteCraft 增强 Agent 演示\n');
  
  // 创建增强的 Agent
  const agent = new EnhancedByteCraftAgent();
  
  // 初始化
  await agent.initialize();
  
  // 添加一些文件到上下文
  agent.addFilesToContext([
    {
      path: 'src/index.ts',
      content: `export * from './app';
console.log('ByteCraft started');`
    },
    {
      path: 'package.json',
      content: `{
  "name": "bytecraft",
  "version": "1.0.0",
  "main": "dist/index.js"
}`,
      readonly: true
    }
  ]);
  
  // 模拟一些工具执行
  agent.handleToolResult('file-manager', true, '文件读取成功');
  agent.handleToolResult('command-exec', false, undefined, '权限不足');
  
  // 演示不同模式的交互
  console.log('\n📝 模式切换演示:');
  
  // 编程模式
  let response = await agent.processUserInput('请帮我创建一个新的组件文件');
  console.log('用户:', '请帮我创建一个新的组件文件');
  console.log('助手:', response);
  
  // 分析模式
  response = await agent.processUserInput('请分析这个代码的性能问题');
  console.log('\n用户:', '请分析这个代码的性能问题');
  console.log('助手:', response);
  
  // 帮助模式
  response = await agent.processUserInput('ByteCraft 有哪些功能？');
  console.log('\n用户:', 'ByteCraft 有哪些功能？');
  console.log('助手:', response);
  
  // 显示最终状态
  console.log('\n' + agent.getStatus());
  
  // 获取工具帮助示例
  console.log('📖 工具帮助示例:');
  const fileHelp = agent.getToolHelp('file-manager');
  console.log('文件管理工具说明:', fileHelp.substring(0, 100) + '...');
  
  console.log('\n✨ 演示完成！增强的 Agent 已成功集成新的 Prompt 系统。');
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateEnhancedAgent().catch(console.error);
}
