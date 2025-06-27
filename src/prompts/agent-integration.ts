/**
 * 将新的 Prompt 系统集成到 ByteCraft Agent 中
 */

import { PromptManager, TOOL_NAMES, type PromptOptions } from './index.js';

// 定义通用工具接口
export interface Tool {
  name: string;
  description?: string;
  [key: string]: any;
}

export interface AgentConfig {
  mode: 'coding' | 'ask' | 'help';
  language?: string;
  projectContext?: {
    name: string;
    type: string;
    language: string;
    framework?: string;
  };
  customReminders?: string[];
}

export class AgentPromptIntegration {
  private promptManager: PromptManager;
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
    this.promptManager = new PromptManager(config.mode);
  }

  /**
   * 初始化系统消息
   */
  async initializeSystemMessage(availableTools: Tool[]): Promise<string> {
    const toolNames = availableTools.map(tool => this.mapToolToPromptName(tool.name));
    
    const options: PromptOptions = {
      language: this.config.language || '中文',
      platform: 'node',
      availableTools: toolNames,
      projectContext: this.config.projectContext,
      finalReminders: [
        ...(this.config.customReminders || []),
        '🎯 优先使用工具执行操作，不要输出完整代码',
        '⚡ 理解需求后立即调用工具，无需等待确认',
        '📝 工具执行完成后提供简洁的状态说明',
        '🛡️ 确保代码质量和安全性',
        '📋 提供清晰的操作说明和错误处理'
      ]
    };

    return this.promptManager.formatSystemPrompt(options);
  }

  /**
   * 映射工具名称到 prompt 系统中的名称
   */
  private mapToolToPromptName(toolName: string): string {
    const mapping: Record<string, string> = {
      'file-manager': TOOL_NAMES.FILE_MANAGER,
      'fileManager': TOOL_NAMES.FILE_MANAGER,
      'command-exec': TOOL_NAMES.COMMAND_EXEC,
      'commandExec': TOOL_NAMES.COMMAND_EXEC,
      'code-executor': TOOL_NAMES.CODE_EXECUTOR,
      'codeExecutor': TOOL_NAMES.CODE_EXECUTOR,
      'web-search': TOOL_NAMES.WEB_SEARCH,
      'webSearch': TOOL_NAMES.WEB_SEARCH,
      'weather': TOOL_NAMES.WEATHER
    };

    return mapping[toolName] || toolName;
  }

  /**
   * 格式化文件内容消息
   */
  formatFilesForChat(files: Array<{ path: string; content: string; readonly?: boolean }>): string {
    const fileInfos = files.map(file => ({
      path: file.path,
      content: file.content,
      isReadonly: file.readonly
    }));

    return this.promptManager.formatFilesContent(fileInfos);
  }

  /**
   * 格式化工具执行结果
   */
  formatToolResult(toolName: string, success: boolean, result?: string, error?: string): string {
    if (success) {
      return this.promptManager.getToolSuccessMessage(toolName, result);
    } else {
      return this.promptManager.getToolErrorMessage(error || '未知错误', toolName);
    }
  }

  /**
   * 获取工具使用帮助
   */
  getToolHelp(toolName: string): string {
    const promptToolName = this.mapToolToPromptName(toolName);
    return this.promptManager.getToolDescription(promptToolName);
  }

  /**
   * 切换模式
   */
  switchMode(mode: 'coding' | 'ask' | 'help'): void {
    this.config.mode = mode;
    this.promptManager.switchMode(mode);
  }

  /**
   * 获取当前模式配置
   */
  getModeConfig() {
    return this.promptManager.getModeConfig();
  }

  /**
   * 检查当前模式是否允许某个操作
   */
  canPerformAction(action: 'edit' | 'create' | 'delete' | 'execute' | 'analyze'): boolean {
    const config = this.getModeConfig();
    
    switch (action) {
      case 'edit':
      case 'create':
      case 'delete':
        return config.canEditFiles;
      case 'execute':
        return config.canExecuteCommands;
      case 'analyze':
        return true; // 所有模式都支持分析
      default:
        return false;
    }
  }

  /**
   * 格式化仓库摘要信息
   */
  formatRepoSummary(summary: string): string {
    return this.promptManager.formatRepoContent(summary);
  }
}

// 便捷工厂函数
export function createAgentPromptIntegration(config: AgentConfig): AgentPromptIntegration {
  return new AgentPromptIntegration(config);
}

// 预定义配置
export const presetConfigs = {
  // 开发模式 - 完整的编程功能
  developer: {
    mode: 'coding' as const,
    language: '中文',
    customReminders: [
      '🚀 直接执行原则：理解需求后立即调用工具',
      '🛠️ 工具优先：所有操作通过工具完成，不输出代码',
      '⚡ 无需确认：明确需求直接执行，无需等待用户批准',
      '📊 简洁反馈：工具执行后只提供关键状态信息',
      '🔧 优先考虑代码的可读性和可维护性',
      '🔄 在重构代码时保持向后兼容性',
      '📝 添加适当的类型注解和文档注释'
    ]
  },

  // 分析师模式 - 只读分析
  analyst: {
    mode: 'ask' as const,
    language: '中文',
    customReminders: [
      '专注于代码分析和架构评估',
      '提供具体的改进建议',
      '考虑性能和安全性因素'
    ]
  },

  // 助手模式 - 帮助和指导
  assistant: {
    mode: 'help' as const,
    language: '中文',
    customReminders: [
      '提供详细的使用说明',
      '给出实用的示例',
      '考虑不同技能水平的用户'
    ]
  }
};

// 示例用法
export function exampleUsage() {
  // 创建开发模式的集成
  const integration = createAgentPromptIntegration({
    ...presetConfigs.developer,
    projectContext: {
      name: 'ByteCraft',
      type: 'AI Assistant',
      language: 'TypeScript',
      framework: 'Node.js'
    }
  });

  // 示例：检查是否可以执行某个操作
  console.log('可以编辑文件:', integration.canPerformAction('edit'));
  console.log('可以执行命令:', integration.canPerformAction('execute'));

  // 示例：获取工具帮助
  const fileHelp = integration.getToolHelp('file-manager');
  console.log('文件管理工具帮助:', fileHelp.substring(0, 100) + '...');

  return integration;
}
